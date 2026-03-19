/**
 * Anvil Standalone E2E Tests
 *
 * Full flow E2E using Anvil standalone mode (no external RPC required).
 * Tests: createFork(standalone) → scenario → clearance → assertOnChain
 */
import { describe, it, expect, afterEach } from 'vitest'
import { createFork } from './fork'
import { preflight } from './scenario'
import { assertOnChain } from './assert'
import type { AssertContext } from './assert'
import { createClearance } from '@clearance/core'

/** Anvil default test account #0 */
const TEST_ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const
const TEN_THOUSAND_ETH = 10_000_000_000_000_000_000_000n

describe('E2E: Fork standalone basics', () => {
  let fork: Awaited<ReturnType<typeof createFork>>

  afterEach(async () => {
    await fork?.stop()
  }, 10_000)

  it('should start standalone Anvil and return a working client', async () => {
    fork = await createFork({ standalone: true })
    const blockNumber = await fork.client.getBlockNumber()
    expect(blockNumber).toBeGreaterThanOrEqual(0n)
    expect(fork.rpcUrl).toMatch(/^http:\/\//)
  }, 30_000)

  it('should have test accounts with default ETH balance', async () => {
    fork = await createFork({ standalone: true })
    const balance = await fork.client.getBalance({ address: TEST_ACCOUNT })
    expect(balance).toBe(TEN_THOUSAND_ETH)
  }, 30_000)

  it('should stop cleanly and reject subsequent requests', async () => {
    fork = await createFork({ standalone: true })
    const rpcUrl = fork.rpcUrl
    await fork.stop()

    const { createPublicClient, http } = await import('viem')
    const { mainnet } = await import('viem/chains')
    const deadClient = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl, { timeout: 2_000, retryCount: 0 }),
    })
    await expect(deadClient.getBlockNumber()).rejects.toThrow()

    // Prevent afterEach double-stop
    fork = undefined as unknown as typeof fork
  }, 30_000)
})

describe('E2E: Scenario + standalone fork', () => {
  it('should run a scenario callback with standalone fork context', async () => {
    const s = preflight.scenario('standalone e2e', {
      fork: { standalone: true },
    })

    let capturedBalance: bigint | null = null
    await s.run(async (ctx) => {
      capturedBalance = await ctx.fork.client.getBalance({
        address: TEST_ACCOUNT,
      })
    })

    expect(capturedBalance).toBe(TEN_THOUSAND_ETH)
  }, 30_000)

  it('should clean up Anvil after scenario completes', async () => {
    const s = preflight.scenario('cleanup e2e', {
      fork: { standalone: true },
    })

    let rpcUrl: string | null = null
    await s.run(async (ctx) => {
      rpcUrl = ctx.fork.rpcUrl
    })

    expect(rpcUrl).not.toBeNull()
    const { createPublicClient, http } = await import('viem')
    const { mainnet } = await import('viem/chains')
    const deadClient = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl!, { timeout: 2_000, retryCount: 0 }),
    })
    await expect(deadClient.getBlockNumber()).rejects.toThrow()
  }, 30_000)
})

describe('E2E: Clearance permission check', () => {
  it('should allow a valid call within permissions', () => {
    const clearance = createClearance({
      agent: 'test-agent',
      permissions: {
        allowedContracts: ['0x1234567890abcdef1234567890abcdef12345678'],
        allowedActions: ['swap'],
        spendLimit: { ETH: TEN_THOUSAND_ETH },
        expiry: 3600,
      },
    })

    expect(() =>
      clearance.check({
        action: 'swap',
        contract: '0x1234567890abcdef1234567890abcdef12345678',
        spend: { token: 'ETH', amount: 1_000_000_000_000_000_000n },
      })
    ).not.toThrow()
  })

  it('should reject a call to disallowed contract', () => {
    const clearance = createClearance({
      agent: 'test-agent',
      permissions: {
        allowedContracts: ['0x1234567890abcdef1234567890abcdef12345678'],
        allowedActions: ['swap'],
        spendLimit: {},
        expiry: 3600,
      },
    })

    expect(() =>
      clearance.check({
        action: 'swap',
        contract: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      })
    ).toThrow()
  })

  it('should reject spend exceeding limit via validate', () => {
    const clearance = createClearance({
      agent: 'test-agent',
      permissions: {
        allowedContracts: ['0x1234567890abcdef1234567890abcdef12345678'],
        allowedActions: ['swap'],
        spendLimit: { ETH: 1_000_000_000_000_000_000n },
        expiry: 3600,
      },
    })

    // First call within budget
    expect(() =>
      clearance.validate({
        action: 'swap',
        contract: '0x1234567890abcdef1234567890abcdef12345678',
        spend: { token: 'ETH', amount: 500_000_000_000_000_000n },
      })
    ).not.toThrow()

    // Second call exceeds cumulative budget
    expect(() =>
      clearance.validate({
        action: 'swap',
        contract: '0x1234567890abcdef1234567890abcdef12345678',
        spend: { token: 'ETH', amount: 600_000_000_000_000_000n },
      })
    ).toThrow()
  })
})

describe('E2E: assertOnChain with standalone context', () => {
  it('should pass balance assertions with test account data', () => {
    const ctx: AssertContext = {
      snapshots: {
        before: {
          balances: { [TEST_ACCOUNT]: { ETH: TEN_THOUSAND_ETH } },
          blockNumber: 0n,
        },
        after: {
          balances: { [TEST_ACCOUNT]: { ETH: TEN_THOUSAND_ETH - 2_000_000_000_000_000_000n } },
          blockNumber: 1n,
        },
      },
      gasUsed: 21_000n,
      approvals: [],
    }

    expect(() =>
      assertOnChain(ctx)
        .balanceDecreased('ETH', { address: TEST_ACCOUNT, min: 2_000_000_000_000_000_000n })
        .gasUsed({ max: 100_000n })
        .noUnexpectedApprovals()
    ).not.toThrow()
  })

  it('should fail when gas exceeds limit', () => {
    const ctx: AssertContext = {
      snapshots: {
        before: {
          balances: { [TEST_ACCOUNT]: { ETH: TEN_THOUSAND_ETH } },
          blockNumber: 0n,
        },
        after: {
          balances: { [TEST_ACCOUNT]: { ETH: TEN_THOUSAND_ETH } },
          blockNumber: 1n,
        },
      },
      gasUsed: 500_000n,
      approvals: [],
    }

    expect(() =>
      assertOnChain(ctx).gasUsed({ max: 100_000n })
    ).toThrow('Expected gas used to be at most 100000')
  })

  it('should chain clearance + assert in a single flow', async () => {
    // Simulate: clearance check → action → assert result
    const clearance = createClearance({
      agent: 'e2e-agent',
      permissions: {
        allowedContracts: ['0x1234567890abcdef1234567890abcdef12345678'],
        allowedActions: ['transfer'],
        spendLimit: { ETH: 5_000_000_000_000_000_000n },
        expiry: 3600,
      },
    })

    // Step 1: Clearance validates the call
    clearance.validate({
      action: 'transfer',
      contract: '0x1234567890abcdef1234567890abcdef12345678',
      spend: { token: 'ETH', amount: 2_000_000_000_000_000_000n },
    })

    // Step 2: Assert the (simulated) on-chain result
    const ctx: AssertContext = {
      snapshots: {
        before: {
          balances: { [TEST_ACCOUNT]: { ETH: TEN_THOUSAND_ETH } },
          blockNumber: 0n,
        },
        after: {
          balances: { [TEST_ACCOUNT]: { ETH: TEN_THOUSAND_ETH - 2_000_000_000_000_000_000n } },
          blockNumber: 1n,
        },
      },
      gasUsed: 21_000n,
      approvals: [],
    }

    expect(() =>
      assertOnChain(ctx)
        .balanceDecreased('ETH', { address: TEST_ACCOUNT, min: 2_000_000_000_000_000_000n })
        .gasUsed({ max: 50_000n })
        .noUnexpectedApprovals()
    ).not.toThrow()

    // Verify clearance tracked the spend
    expect(clearance.spentAmounts['ETH']).toBe(2_000_000_000_000_000_000n)
  })
})
