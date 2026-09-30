const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
const goal = "Find suitable software engineering internships posted in the last 48 hours and prepare applications.";

async function main() {
	const response = await fetch(`${baseUrl}/api/missions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: "demo-user", goal }) });
	const body = await response.json() as { id?: string; error?: string };
	if (!response.ok || !body.id) throw new Error(body.error ?? "Could not create demo mission");
	console.info(`Demo mission created: ${baseUrl}/missions/${body.id}`);
	console.info("Open the mission and press Start execution. DEMO_MODE must be enabled on the Next.js server.");
}

void main();
