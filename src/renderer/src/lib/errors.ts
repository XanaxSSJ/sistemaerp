export function parseIpcError(err: unknown): string {
  if (!(err instanceof Error)) return 'Error inesperado'
  try {
    const parsed = JSON.parse(err.message) as { message?: string }
    if (parsed.message) return parsed.message
  } catch {
    /* plain message */
  }
  return err.message || 'Error inesperado'
}
