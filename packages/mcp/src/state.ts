import type { ForkSession, ClearancePolicy, AuditEntry } from './types.js'

const parsedMaxSessions = parseInt(process.env.PREFLIGHT_MAX_SESSIONS ?? '5', 10)
const MAX_SESSIONS = Number.isNaN(parsedMaxSessions) || parsedMaxSessions < 1 ? 5 : Math.min(parsedMaxSessions, 20)
const sessions = new Map<string, ForkSession>()
const clientCache = new Map<string, unknown>()
let policy: ClearancePolicy | null = null

export function getSession(id: string): ForkSession | undefined {
  return sessions.get(id)
}

export function addSession(session: ForkSession): void {
  if (sessions.size >= MAX_SESSIONS) {
    throw new Error(`Max sessions (${MAX_SESSIONS}) reached`)
  }
  sessions.set(session.id, session)
}

export function removeSession(id: string): boolean {
  clientCache.delete(id)
  return sessions.delete(id)
}

export function getAllSessions(): ReadonlyMap<string, ForkSession> {
  return sessions
}

export function getCachedClient(id: string): unknown {
  return clientCache.get(id)
}

export function setCachedClient(id: string, client: unknown): void {
  clientCache.set(id, client)
}

export function clearCachedClient(id: string): void {
  clientCache.delete(id)
}

export function getPolicy(): ClearancePolicy | null {
  return policy
}

export function setPolicy(p: ClearancePolicy): void {
  policy = p
}

export function clearPolicy(): void {
  policy = null
}

const auditLog: AuditEntry[] = []
const MAX_AUDIT_ENTRIES = 1000

export function addAuditEntry(entry: AuditEntry): void {
  auditLog.push(entry)
  if (auditLog.length > MAX_AUDIT_ENTRIES) {
    auditLog.splice(0, auditLog.length - MAX_AUDIT_ENTRIES)
  }
}

export function getAuditLog(sessionId?: string): readonly AuditEntry[] {
  if (sessionId) {
    return auditLog.filter(e => e.sessionId === sessionId)
  }
  return [...auditLog]
}

export function clearAuditLog(): void {
  auditLog.length = 0
}
