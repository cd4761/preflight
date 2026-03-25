import { createPublicClient, http, defineChain, type Chain, type PublicClient } from 'viem'
import { foundry } from 'viem/chains'
import * as viemChains from 'viem/chains'
import { createAnvil } from '@viem/anvil'

/** Standalone mode — Anvil runs as a local chain (chainId 31337) without forking. */
interface StandaloneForkOptions {
  readonly standalone: true
  readonly port?: number
}

/** Fork mode — Anvil forks a remote chain via RPC. */
interface RemoteForkOptions {
  readonly rpc: string
  readonly standalone?: false
  readonly blockNumber?: bigint
  readonly port?: number
}

/**
 * Options for creating an Anvil environment.
 *
 * Two modes:
 * - **Fork mode**: `{ rpc: 'https://...' }` — forks a remote chain
 * - **Standalone mode**: `{ standalone: true }` — local chain, 10 test accounts with 10k ETH
 */
export type ForkOptions = StandaloneForkOptions | RemoteForkOptions

/**
 * A running Anvil instance with a viem PublicClient.
 */
export interface Fork {
  /** viem PublicClient connected to the local Anvil instance */
  readonly client: PublicClient
  /** Local Anvil HTTP URL */
  readonly rpcUrl: string
  /** Detected chain ID (auto-detected from Anvil RPC in fork mode, 31337 in standalone) */
  readonly chainId: number
  /** Stops the Anvil process */
  readonly stop: () => Promise<void>
}

/**
 * Returns a random port in the ephemeral range (49152-65535).
 *
 * @viem/anvil detects startup by matching "Listening on host:port" in stdout,
 * so port 0 (OS auto-assign) does not work — we must specify an explicit port.
 */
function randomPort(): number {
  return 49152 + Math.floor(Math.random() * (65535 - 49152))
}

/**
 * Returns true if the error looks like an OS port-already-in-use failure.
 * Used to decide whether a retry with a different port is safe.
 */
function isPortConflict(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes('address already in use') || err.message.includes('EADDRINUSE'))
  )
}

/**
 * Lookup a viem built-in chain definition by chainId.
 * Cast to Chain[] because viem/chains exports a complex union type
 * that confuses type predicates.
 */
function getKnownChain(chainId: number): Chain | undefined {
  const allChains = Object.values(viemChains) as Chain[]
  return allChains.find(c => c.id === chainId)
}

/**
 * Creates a local Anvil environment.
 *
 * Like spinning up a local copy of Ethereum — you get a full blockchain
 * environment to test against without touching the real network.
 *
 * Two modes:
 * - Fork mode (`{ rpc: '...' }`) — forks a remote chain at an optional block.
 *   The chain is auto-detected via `eth_chainId` RPC call.
 * - Standalone mode (`{ standalone: true }`) — empty local chain (chainId 31337)
 *
 * When no explicit port is provided, up to 3 port-conflict retries are attempted
 * with fresh random ports before giving up.
 *
 * @param options - Anvil configuration (see ForkOptions)
 * @returns A Fork object with a connected PublicClient, chainId, and a stop function
 * @throws If Anvil fails to start, or if rpc is missing/empty in fork mode
 *
 * @example
 * // Fork mode — auto-detects chain
 * const fork = await createFork({ rpc: 'https://eth.drpc.org' })
 * console.log(fork.chainId) // 1 (mainnet)
 *
 * // Standalone mode
 * const fork = await createFork({ standalone: true })
 * console.log(fork.chainId) // 31337 (foundry)
 */
export async function createFork(options: ForkOptions): Promise<Fork> {
  // Narrow mode and extract fork-specific options via discriminant
  const rpc = options.standalone
    ? undefined
    // Convert empty/whitespace-only rpc to undefined (safety net for JS callers)
    : options.rpc.trim() || undefined
  const blockNumber = options.standalone ? undefined : options.blockNumber

  if (!options.standalone && !rpc) {
    throw new Error('createFork: rpc is required unless standalone is true')
  }

  const maxAttempts = options.port === undefined ? 3 : 1

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = options.port ?? randomPort()
    const anvil = createAnvil({
      ...(rpc ? { forkUrl: rpc, forkBlockNumber: blockNumber } : {}),
      port,
      startTimeout: 30_000,
    })

    try {
      await anvil.start()
    } catch (err) {
      // Ensure Anvil process is cleaned up if startup fails, to avoid port leaks.
      await anvil.stop().catch(() => undefined)
      if (attempt < maxAttempts - 1 && isPortConflict(err)) continue
      throw err
    }

    const rpcUrl = `http://${anvil.host}:${anvil.port}`

    // Auto-detect chainId: standalone uses 31337, fork mode queries Anvil
    const detectedChainId = options.standalone
      ? 31337
      : await createPublicClient({ transport: http(rpcUrl) }).getChainId()

    const chain = getKnownChain(detectedChainId) ?? defineChain({
      id: detectedChainId,
      name: `Chain ${detectedChainId}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    })

    const client = createPublicClient({ chain, transport: http(rpcUrl) })

    return {
      client,
      rpcUrl,
      chainId: detectedChainId,
      stop: () => anvil.stop(),
    }
  }

  // Unreachable — loop always returns or throws.
  throw new Error('createFork: exhausted port retry attempts')
}
