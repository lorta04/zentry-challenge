export function logError(label: string, err: unknown, extra?: string) {
  const timestamp = new Date().toISOString();
  const message = err instanceof Error ? err.stack || err.message : String(err);
  console.error(`[${timestamp}] ❌ ${label}: ${message}`);
  if (extra) console.error(`[${timestamp}] 🔁 ${extra}`);
}
