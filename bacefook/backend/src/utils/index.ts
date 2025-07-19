export function logError(context: string, err: unknown) {
  const now = new Date().toISOString();
  console.error(`[${now}] ❌ ${context} | error=`, err);
}

export function parseEventDate(input: string): Date {
  // Input format: "20250718T205354320Z"
  // Truncate to 20 chars: "20250718T205354320Z"
  // Convert to valid ISO format: "2025-07-18T20:53:54.320Z"
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z$/.exec(input);
  if (!match) throw new Error(`Invalid created_at format: ${input}`);

  const [_, yyyy, MM, dd, hh, mm, ss, SSS] = match;
  return new Date(`${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}.${SSS}Z`);
}
