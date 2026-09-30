import { MissionView } from "@/components/mission-view";

export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MissionView missionId={id} />;
}
