import { describe, it, expect, afterEach } from 'vitest'
import { createFork } from './fork'

describe('createFork', () => {
  let fork: Awaited<ReturnType<typeof createFork>>

  afterEach(async () => {
    await fork?.stop()
  }, 10_000)

  it('should start an Anvil fork and return a public client', async () => {
    fork = await createFork({
      rpc: 'https://rpc.mevblocker.io',
    })
    const blockNumber = await fork.client.getBlockNumber()
    expect(blockNumber).toBeGreaterThan(0n)
  }, 60_000)

  it('should fork at a specific block number', async () => {
    fork = await createFork({
      rpc: 'https://rpc.mevblocker.io',
      blockNumber: 20_000_000n,
    })
    const blockNumber = await fork.client.getBlockNumber()
    expect(blockNumber).toBe(20_000_000n)
  }, 60_000)
})
