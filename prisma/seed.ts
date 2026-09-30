import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const mission = await prisma.mission.create({ data: { userId: "seed-user", goal: "Find suitable software engineering internships posted in the last 48 hours, shortlist relevant opportunities, prepare applications, and ask me before submitting anything." } });
  await prisma.executionEvent.create({ data: { missionId: mission.id, eventType: "mission_created", message: "Seed mission created" } });
  console.info(`Created seed mission ${mission.id}`);
}

main().finally(() => prisma.$disconnect());
