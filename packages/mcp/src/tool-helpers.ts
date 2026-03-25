import { addAuditEntry } from './state.js'

export function toolError(message: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  }
}

export function toolSuccess(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
  }
}

/** Record a tool invocation in the audit trail. */
export function audit(tool: string, result: 'success' | 'error', detail?: string, sessionId?: string): void {
  addAuditEntry({
    timestamp: new Date().toISOString(),
    tool,
    sessionId,
    result,
    detail,
  })
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
