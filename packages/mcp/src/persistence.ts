/**
 * File-based persistence for MCP session metadata and audit logs.
 *
 * Like a black box flight recorder: sessions and audit entries are written
 * to disk so they survive server restarts. Anvil processes are ephemeral
 * and cannot be restored, so restored sessions are marked as stale.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import type { AuditEntry } from './types.js'

/** Serializable subset of ForkSession (excludes stop function and client). */
export interface PersistedSession {
  readonly id: string
  readonly rpcUrl: string
  readonly forkUrl: string
  readonly blockNumber: string  // bigint serialized as string
  readonly chainId: number
  readonly createdAt: string    // ISO date
  readonly stale: boolean       // true if restored after restart (Anvil process lost)
}

interface PersistenceData {
  readonly sessions: readonly PersistedSession[]
  readonly auditLog: readonly AuditEntry[]
  readonly savedAt: string
}

/** Runtime schema to validate loaded state — prevents deserialization attacks. */
const persistenceSchema = z.object({
  sessions: z.array(z.object({
    id: z.string(),
    rpcUrl: z.string(),
    forkUrl: z.string(),
    blockNumber: z.string(),
    chainId: z.number(),
    createdAt: z.string(),
    stale: z.boolean(),
  })),
  auditLog: z.array(z.object({
    timestamp: z.string(),
    tool: z.string(),
    sessionId: z.string().optional(),
    result: z.enum(['success', 'error']),
    detail: z.string().optional(),
  })),
  savedAt: z.string(),
})

const DEFAULT_DIR = join(process.cwd(), '.preflight')
const DATA_FILE = 'state.json'

function getDataPath(dir?: string): string {
  return join(dir ?? DEFAULT_DIR, DATA_FILE)
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

/**
 * Save session metadata and audit log to disk.
 *
 * @param sessions - Current session metadata (serializable subset)
 * @param auditLog - Current audit entries
 * @param dir - Directory to store the file (default: .preflight/)
 */
export function saveState(
  sessions: readonly PersistedSession[],
  auditLog: readonly AuditEntry[],
  dir?: string,
): void {
  const targetDir = dir ?? DEFAULT_DIR
  ensureDir(targetDir)

  const data: PersistenceData = {
    sessions,
    auditLog,
    savedAt: new Date().toISOString(),
  }

  writeFileSync(getDataPath(targetDir), JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 })
}

/**
 * Load persisted state from disk.
 *
 * @param dir - Directory to read from (default: .preflight/)
 * @returns Persisted data or null if file doesn't exist
 */
export function loadState(dir?: string): PersistenceData | null {
  const path = getDataPath(dir ?? DEFAULT_DIR)
  if (!existsSync(path)) return null

  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw)
    // Validate against schema to prevent deserialization attacks (CWE-502)
    const result = persistenceSchema.safeParse(parsed)
    if (!result.success) {
      process.stderr.write(`Warning: invalid state file ${path}: ${result.error.message}\n`)
      return null
    }
    return result.data as PersistenceData
  } catch (err) {
    process.stderr.write(`Warning: failed to load state from ${path}: ${err instanceof Error ? err.message : String(err)}\n`)
    return null
  }
}
