type ExecutionLog = { missionId: string; stepId?: string; tool?: string; action?: string; status?: string; eventType: string; message: string; error?: string };

export function logExecution(log: ExecutionLog) {
  const safeLog = { ...log, timestamp: new Date().toISOString() };
  if (log.error) console.error(JSON.stringify(safeLog));
  else console.info(JSON.stringify(safeLog));
}
