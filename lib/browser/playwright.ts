import { chromium, type Browser } from "playwright";

export async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    throw new Error(`Browser configuration error: ${error instanceof Error ? error.message : "Playwright could not launch"}`);
  }
}
