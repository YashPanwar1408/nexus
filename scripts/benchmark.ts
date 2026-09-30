import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runScenario, scenarioNames } from "@/lib/testing/scenarios";

async function main() {
	const results = scenarioNames.map(runScenario);
	const report = { generatedAt: new Date().toISOString(), harness: "deterministic-agent-policy-scenarios", note: "These are reproducible harness results, not production metrics.", scenarios: results, summary: { total: results.length, passed: results.filter((result) => result.success).length, failed: results.filter((result) => !result.success).length } };
	const outputPath = path.join(process.cwd(), "benchmark-report.json");
	await mkdir(path.dirname(outputPath), { recursive: true });
	await writeFile(outputPath, JSON.stringify(report, null, 2));
	console.info(`Wrote ${outputPath}`);
}

void main();
