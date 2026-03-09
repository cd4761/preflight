import { describe, it, expect, afterEach } from 'vitest'
import { createFork } from './fork'

/** Use FORK_RPC_URL env var, or skip the test suite if not set. */
const FORK_RPC = process.env.FORK_RPC_URL ?? 'https://eth.drpc.org'

describe('createFork', () => {
  let fork: Awaited<ReturnType<typeof createFork>>

  afterEach(async () => {
    await fork?.stop()
  }, 10_000)

  it('should start an Anvil fork and return a public client', async () => {
    fork = await createFork({ rpc: FORK_RPC })
    const blockNumber = await fork.client.getBlockNumber()
    expect(blockNumber).toBeGreaterThan(0n)
    expect(fork.rpcUrl).toMatch(/^http:\/\//)
    expect(fork.stop).toBeTypeOf('function')
  }, 60_000)

  it('should fork at a specific block number', async () => {
    fork = await createFork({
      rpc: FORK_RPC,
      blockNumber: 20_000_000n,
    })
    const blockNumber = await fork.client.getBlockNumber()
    expect(blockNumber).toBe(20_000_000n)
  }, 60_000)
})
