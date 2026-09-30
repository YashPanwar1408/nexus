import { MissionReplay } from "@/components/mission-replay";

export default async function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MissionReplay missionId={id} />;
}
