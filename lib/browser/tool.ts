import { mkdir } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import path from "node:path";
import { launchBrowser } from "@/lib/browser/playwright";
import type { ToolResult } from "@/lib/tools/registry";
import { getEnv } from "@/lib/env";

export type BrowserObservation = {
  url: string;
  title: string;
  text: string;
  screenshotPath: string;
};

export type BrowserLink = { text: string; href: string };
export type BrowserFormField = { selector: string; label: string; type: string; required: boolean };

export class BrowserTool {
  private readonly browserPromise = launchBrowser();
  private pagePromise = this.browserPromise.then(async (browser) => (await browser.newContext()).newPage());

  private async page() {
    return this.pagePromise;
  }

  async navigate(url: string): Promise<ToolResult> {
    await this.assertUrl(url);
    const page = await this.page();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      return { success: true, output: `Navigated to ${page.url()}` };
    } catch (error) {
      return { success: false, output: this.failureMessage(error, "Navigation failed") };
    }
  }

  async search(query: string): Promise<ToolResult> {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    const navigation = await this.navigate(url);
    if (!navigation.success) return navigation;
    const text = await this.getPageText();
    if (!text.trim()) return { success: false, output: "Search page loaded without observable results" };
    return { success: true, output: `Search results loaded for ${query}\n${text.slice(0, 12_000)}` };
  }

  async click(selector: string): Promise<ToolResult> {
    const page = await this.page();
    try {
      await page.locator(selector).first().click({ timeout: 10_000 });
      return { success: true, output: `Clicked ${selector}` };
    } catch (error) {
      return { success: false, output: this.failureMessage(error, `Could not click ${selector}`) };
    }
  }

  async type(selector: string, text: string): Promise<ToolResult> {
    const page = await this.page();
    try {
      await page.locator(selector).first().fill(text, { timeout: 10_000 });
      return { success: true, output: `Entered text into ${selector}` };
    } catch (error) {
      return { success: false, output: this.failureMessage(error, `Could not type into ${selector}`) };
    }
  }

  async extract(selector?: string): Promise<ToolResult> {
    const page = await this.page();
    try {
      const locator = selector ? page.locator(selector).first() : page.locator("body");
      const text = (await locator.innerText({ timeout: 10_000 })).trim();
      if (!text) return { success: false, output: "Extraction returned no text" };
      return { success: true, output: text.slice(0, 20_000) };
    } catch (error) {
      return { success: false, output: this.failureMessage(error, "Extraction failed") };
    }
  }

  async screenshot(missionId: string, stepId: string): Promise<string> {
    const page = await this.page();
    const directory = path.join(process.cwd(), "public", "evidence", missionId);
    await mkdir(directory, { recursive: true });
    const screenshotPath = path.join(directory, `${stepId}-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return `/evidence/${missionId}/${path.basename(screenshotPath)}`;
  }

  async getCurrentUrl() { return (await this.page()).url(); }

  async getPageText() { return (await this.page()).locator("body").innerText({ timeout: 10_000 }).catch(() => ""); }

  async getLinks(selector = "a") {
    const page = await this.page();
    return page.locator(selector).evaluateAll((elements) => elements.map((element) => ({ text: (element.textContent ?? "").trim(), href: (element as HTMLAnchorElement).href })).filter((link): link is BrowserLink => Boolean(link.href)));
  }

  async inspectFormFields() {
    const page = await this.page();
    return page.locator("input, textarea, select").evaluateAll((elements) => elements.map((element, index) => { const input = element as HTMLInputElement; const id = input.id; const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent : undefined; return { selector: id ? `#${CSS.escape(id)}` : `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`, label: `${label ?? input.getAttribute("aria-label") ?? input.getAttribute("placeholder") ?? input.getAttribute("name") ?? ""}`.trim(), type: input.type || element.tagName.toLowerCase(), required: input.required }; }));
  }

  async fillField(selector: string, value: string) {
    const page = await this.page();
    try { await page.locator(selector).first().fill(value, { timeout: 10_000 }); return { success: true, output: `Filled ${selector}` }; } catch (error) { return { success: false, output: this.failureMessage(error, `Could not fill ${selector}`) }; }
  }

  async observe(missionId: string, stepId: string): Promise<BrowserObservation> {
    const page = await this.page();
    const screenshotPath = await this.screenshot(missionId, stepId);
    const text = (await this.getPageText()).slice(0, 20_000);
    const authWall = /\b(sign in|log in|authentication required|verify you are human|captcha)\b/i.test(text);
    return { url: page.url(), title: await page.title(), text: authWall ? `[AUTHENTICATION_WALL]\n${text}` : text, screenshotPath };
  }

  async close() {
    const browser = await this.browserPromise;
    await browser.close();
  }

  async execute(action: string, target: string | undefined, missionId: string, stepId: string): Promise<ToolResult> {
    switch (action) {
      case "navigate": return target ? this.navigate(target) : { success: false, output: "navigate requires an HTTP(S) target" };
      case "search": return this.search(target ?? "software engineering internships posted in the last 48 hours");
      case "click": return target ? this.click(target) : { success: false, output: "click requires a selector" };
      case "submit": return target ? this.click(target).then((result) => result.success ? { ...result, output: "Submit action clicked" } : result) : { success: false, output: "submit requires a selector" };
      case "type": {
        if (!target) return { success: false, output: "type requires JSON with selector and text" };
        try {
          const input = JSON.parse(target) as { selector?: unknown; text?: unknown };
          if (typeof input.selector !== "string" || typeof input.text !== "string") return { success: false, output: "type requires JSON with string selector and text" };
          return this.type(input.selector, input.text);
        } catch { return { success: false, output: "type target must be valid JSON" }; }
      }
      case "extract": case "read": case "observe": return this.extract(target);
      case "screenshot": return { success: true, output: await this.screenshot(missionId, stepId) };
      default: return { success: false, output: `Unsupported browser action: ${action}` };
    }
  }

  private async assertUrl(url: string) {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Only HTTP(S) navigation is allowed");
    const env = getEnv();
    const allowedHosts = env.BROWSER_ALLOWED_HOSTS.split(",").map((host) => host.trim()).filter(Boolean);
    if (allowedHosts.length > 0 && !allowedHosts.includes(parsed.hostname)) throw new Error("Navigation target is not in the browser host allowlist");
    if (!env.ALLOW_LOCAL_BROWSER && isPrivateHost(parsed.hostname)) throw new Error("Private and local browser targets are blocked");
    const address = isIP(parsed.hostname) ? parsed.hostname : (await lookup(parsed.hostname)).address;
    if (!env.ALLOW_LOCAL_BROWSER && isPrivateAddress(address)) throw new Error("Navigation resolved to a private address");
  }

  private failureMessage(error: unknown, prefix: string) {
    const message = error instanceof Error ? error.message : "unknown browser error";
    return `${prefix}: ${message}`;
  }
}

function isPrivateHost(hostname: string) {
  return hostname === "localhost" || hostname.endsWith(".local") || isPrivateAddress(hostname);
}

function isPrivateAddress(address: string) {
  return address === "127.0.0.1" || address === "::1" || address.startsWith("10.") || address.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(address) || address.startsWith("169.254.") || address === "0.0.0.0" || address.startsWith("fc") || address.startsWith("fd");
}
