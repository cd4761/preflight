import { describe, it, expect } from 'vitest'
import { assertOnChain } from './assert'
import type { AssertContext } from './assert'

describe('assertOnChain', () => {
  const mockCtx: AssertContext = {
    snapshots: {
      before: {
        balances: { '0xabc': { ETH: 10_000n, USDC: 5_000n } },
        blockNumber: 20_000_000n,
      },
      after: {
        balances: { '0xabc': { ETH: 8_000n, USDC: 7_000n } },
        blockNumber: 20_000_001n,
      },
    },
    gasUsed: 150_000n,
    approvals: [],
  }

  describe('balanceDecreased', () => {
    it('should pass when balance decreased by expected amount', () => {
      expect(() =>
        assertOnChain(mockCtx).balanceDecreased('ETH', {
          address: '0xabc',
          min: 2_000n,
        })
      ).not.toThrow()
    })

    it('should fail when balance did not decrease enough', () => {
      expect(() =>
        assertOnChain(mockCtx).balanceDecreased('ETH', {
          address: '0xabc',
          min: 5_000n,
        })
      ).toThrow('Expected ETH balance to decrease by at least 5000')
    })

    it('should treat unknown token as zero balance and fail if expected decrease exceeds 0', () => {
      expect(() =>
        assertOnChain(mockCtx).balanceDecreased('DAI', {
          address: '0xabc',
          min: 1n,
        })
      ).toThrow('Expected DAI balance to decrease by at least 1, but decreased by 0')
    })

    it('should handle missing address in snapshots', () => {
      expect(() =>
        assertOnChain(mockCtx).balanceDecreased('ETH', {
          address: '0xunknown',
          min: 1n,
        })
      ).toThrow('Address "0xunknown" not found in snapshots')
    })

    it('should pass with min: 0n (no-op decrease check)', () => {
      expect(() =>
        assertOnChain(mockCtx).balanceDecreased('ETH', {
          address: '0xabc',
          min: 0n,
        })
      ).not.toThrow()
    })

    it('should report "balance increased" when balance went up instead of down', () => {
      // USDC increased in mockCtx (5_000n → 7_000n), balanceDecreased should clarify this
      expect(() =>
        assertOnChain(mockCtx).balanceDecreased('USDC', {
          address: '0xabc',
          min: 1_000n,
        })
      ).toThrow('Expected USDC balance to decrease by at least 1000, but balance increased by 2000')
    })

    it('should detect token missing in after snapshot (silent sweep scenario)', () => {
      // Token exists in before but not in after — e.g., a full ETH sweep
      const sweepCtx: AssertContext = {
        snapshots: {
          before: {
            balances: { '0xvictim': { ETH: 1_000_000n } },
            blockNumber: 20_000_000n,
          },
          after: {
            // ETH key is absent — balance drained to zero by attacker
            balances: { '0xvictim': {} },
            blockNumber: 20_000_001n,
          },
        },
        gasUsed: 21_000n,
        approvals: [],
      }
      // actual = 1_000_000n - 0n = 1_000_000n, passes min check — this is the known limitation
      // The test documents current behavior: missing token treated as 0n
      expect(() =>
        assertOnChain(sweepCtx).balanceDecreased('ETH', {
          address: '0xvictim',
          min: 1_000_000n,
        })
      ).not.toThrow()
    })
  })

  describe('balanceIncreased', () => {
    it('should pass when balance increased by at least min', () => {
      expect(() =>
        assertOnChain(mockCtx).balanceIncreased('USDC', {
          address: '0xabc',
          min: 2_000n,
        })
      ).not.toThrow()
    })

    it('should fail when balance did not increase enough', () => {
      expect(() =>
        assertOnChain(mockCtx).balanceIncreased('USDC', {
          address: '0xabc',
          min: 5_000n,
        })
      ).toThrow('Expected USDC balance to increase by at least 5000, but increased by 2000')
    })

    it('should report "balance decreased" when balance went down instead of up', () => {
      // ETH decreased in mockCtx (10_000n → 8_000n), so balanceIncreased('ETH') should clarify this
      expect(() =>
        assertOnChain(mockCtx).balanceIncreased('ETH', {
          address: '0xabc',
          min: 1_000n,
        })
      ).toThrow('Expected ETH balance to increase by at least 1000, but balance decreased by 2000')
    })

    it('should throw for missing address', () => {
      expect(() =>
        assertOnChain(mockCtx).balanceIncreased('ETH', {
          address: '0xunknown',
          min: 1n,
        })
      ).toThrow('Address "0xunknown" not found in snapshots')
    })

    it('should pass when increase exceeds min', () => {
      expect(() =>
        assertOnChain(mockCtx).balanceIncreased('USDC', {
          address: '0xabc',
          min: 1_000n,
        })
      ).not.toThrow()
    })
  })

  describe('gasUsed', () => {
    it('should pass when gas is within limit', () => {
      expect(() =>
        assertOnChain(mockCtx).gasUsed({ max: 300_000n })
      ).not.toThrow()
    })

    it('should fail when gas exceeds limit', () => {
      expect(() =>
        assertOnChain(mockCtx).gasUsed({ max: 100_000n })
      ).toThrow('Expected gas used to be at most 100000')
    })

    it('should pass when gas equals max', () => {
      expect(() =>
        assertOnChain(mockCtx).gasUsed({ max: 150_000n })
      ).not.toThrow()
    })
  })

  describe('noUnexpectedApprovals', () => {
    it('should pass when approvals is empty', () => {
      expect(() =>
        assertOnChain(mockCtx).noUnexpectedApprovals()
      ).not.toThrow()
    })

    it('should fail when approvals exist', () => {
      const ctxWithApprovals: AssertContext = {
        ...mockCtx,
        approvals: ['0xUSDC->0xSpender'],
      }
      expect(() =>
        assertOnChain(ctxWithApprovals).noUnexpectedApprovals()
      ).toThrow('Expected no unexpected approvals')
    })
  })

  describe('chaining', () => {
    it('should support chaining multiple assertions', () => {
      expect(() =>
        assertOnChain(mockCtx)
          .balanceDecreased('ETH', { address: '0xabc', min: 2_000n })
          .balanceIncreased('USDC', { address: '0xabc', min: 2_000n })
          .gasUsed({ max: 300_000n })
          .noUnexpectedApprovals()
      ).not.toThrow()
    })

    it('should fail at first failing assertion in chain', () => {
      expect(() =>
        assertOnChain(mockCtx)
          .gasUsed({ max: 300_000n })
          .balanceDecreased('ETH', { address: '0xabc', min: 99_999n })
          .noUnexpectedApprovals()
      ).toThrow('Expected ETH balance to decrease by at least 99999')
    })
  })
})
