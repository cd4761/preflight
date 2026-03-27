import { z } from 'zod'
import { randomUUID } from 'crypto'
import { createFork } from '@preflight/core'
import { addSession, getSession, removeSession } from '../state.js'
import { toolError, toolSuccess, withTimeout, audit } from '../tool-helpers.js'
import type { ForkSession } from '../types.js'

const FORK_TIMEOUT_MS = 30_000
const INTEGER_STRING = /^\d+$/

/**
 * Block internal/cloud metadata IPs to prevent SSRF.
 * Rejects: loopback, RFC1918 private, link-local, AWS/GCP metadata, IPv6 variants.
 *
 * Limitation: DNS rebinding can bypass hostname checks. In production,
 * combine with outbound firewall rules to fully prevent SSRF.
 */
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,          // link-local + AWS metadata
  /^metadata\.google/i,   // GCP metadata
  /^\[?::1\]?$/,          // IPv6 loopback (bracketed and bare)
  /^::ffff:/i,            // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  /^\[?::\]?$/,           // IPv6 any (::)
  /^0\.0\.0\.0$/,         // IPv4 any
]

function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return BLOCKED_HOST_PATTERNS.some(p => p.test(parsed.hostname))
  } catch {
    return true // malformed URL → block
  }
}

const createForkSchema = z.object({
  forkUrl: z
    .string()
    .url('Invalid RPC URL')
    .refine(url => /^https?:\/\//i.test(url), 'Only http:// and https:// schemes are allowed')
    .refine(url => !isBlockedUrl(url), 'Internal/private network URLs are blocked (SSRF protection)')
    .optional(),
  blockNumber: z
    .string()
    .regex(INTEGER_STRING, 'blockNumber must be a non-negative integer string')
    .optional(),
})

const resetForkSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
})

interface ForkHandle {
  rpcUrl: string
  blockNumber: bigint
  chainId: number
  stop: () => Promise<void>
}

/** Creates an Anvil fork and resolves its block number and chain ID. Cleans up on failure. */
async function launchFork(
  rpc: string,
  blockNumber: bigint | undefined,
): Promise<{ error: string } | ForkHandle> {
  let fork: Awaited<ReturnType<typeof createFork>>
  try {
    fork = await withTimeout(createFork({ rpc, blockNumber }), FORK_TIMEOUT_MS)
  } catch (err) {
    return { error: `Failed to create fork: ${err instanceof Error ? err.message : String(err)}` }
  }

  let resolvedBlockNumber: bigint
  try {
    resolvedBlockNumber = blockNumber !== undefined
      ? blockNumber
      : await withTimeout(fork.client.getBlockNumber(), FORK_TIMEOUT_MS)
  } catch (err) {
    await fork.stop().catch(() => undefined)
    return { error: `Failed to query fork state: ${err instanceof Error ? err.message : String(err)}` }
  }

  return { rpcUrl: fork.rpcUrl, blockNumber: resolvedBlockNumber, chainId: fork.chainId, stop: fork.stop }
}

async function createForkHandler(params: z.infer<typeof createForkSchema>) {
  const forkUrl = params.forkUrl || process.env.PREFLIGHT_FORK_URL
  if (!forkUrl) return toolError('No fork URL provided. Set PREFLIGHT_FORK_URL or pass forkUrl parameter.')

  const blockNumber = params.blockNumber !== undefined ? BigInt(params.blockNumber) : undefined
  const fork = await launchFork(forkUrl, blockNumber)
  if ('error' in fork) {
    audit('create_fork', 'error', fork.error)
    return toolError(fork.error)
  }

  const session: ForkSession = {
    id: randomUUID(),
    rpcUrl: fork.rpcUrl,
    forkUrl,
    blockNumber: fork.blockNumber,
    chainId: fork.chainId,
    createdAt: new Date(),
    stop: fork.stop,
  }

  try {
    addSession(session)
  } catch (err) {
    await fork.stop().catch(() => undefined)
    return toolError(err instanceof Error ? err.message : String(err))
  }

  audit('create_fork', 'success', `chainId=${session.chainId}`, session.id)
  return toolSuccess({
    sessionId: session.id,
    rpcUrl: session.rpcUrl,
    blockNumber: String(session.blockNumber),
    createdAt: session.createdAt.toISOString(),
  })
}

async function resetForkHandler(params: z.infer<typeof resetForkSchema>) {
  const existing = getSession(params.sessionId)
  if (!existing) return toolError(`Session not found: ${params.sessionId}`)

  // Create new fork BEFORE removing old session so we don't lose state on failure
  let fork: Awaited<ReturnType<typeof createFork>>
  try {
    fork = await withTimeout(
      createFork({ rpc: existing.forkUrl, blockNumber: existing.blockNumber }),
      FORK_TIMEOUT_MS,
    )
  } catch (err) {
    return toolError(`Failed to reset fork: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    await existing.stop()
  } catch {
    // Best-effort cleanup of old fork process
  }

  removeSession(params.sessionId)

  const session: ForkSession = {
    id: randomUUID(),
    rpcUrl: fork.rpcUrl,
    forkUrl: existing.forkUrl,
    blockNumber: existing.blockNumber,
    chainId: fork.chainId,
    createdAt: new Date(),
    stop: fork.stop,
  }

  addSession(session)

  audit('reset_fork', 'success', `prev=${params.sessionId}`, session.id)
  return toolSuccess({
    sessionId: session.id,
    rpcUrl: session.rpcUrl,
    blockNumber: String(session.blockNumber),
    previousSessionId: params.sessionId,
    createdAt: session.createdAt.toISOString(),
  })
}

export const createForkTool = {
  name: 'create_fork' as const,
  description: 'Create a new Anvil fork of an EVM chain for transaction simulation',
  schema: createForkSchema,
  handler: createForkHandler,
}

export const resetForkTool = {
  name: 'reset_fork' as const,
  description: 'Reset an existing fork session to its original block state',
  schema: resetForkSchema,
  handler: resetForkHandler,
}
