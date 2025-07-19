export function logError(context: string, err: unknown) {
  const now = new Date().toISOString();
  console.error(`[${now}] ❌ ${context} | error=`, err);
}
