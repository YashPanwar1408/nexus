export function canRetry(attempts: number, maxAttempts = 2) {
  return attempts < maxAttempts;
}

export function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message = "Operation timed out") {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); });
  return Promise.race([operation, timeout]).finally(() => { if (timer) clearTimeout(timer); });
}
