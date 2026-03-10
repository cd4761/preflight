import { describe, it, expect } from 'vitest'
import { mockLLM } from '@preflight/core'
import { createClearance } from '@clearance/core'
import { createMockChatModel } from '@preflight/adapter-langchain'
import { runSwapAgent } from './agent.js'

const UNISWAP_V3_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564'

describe('Uniswap Swap Agent — preflight 시나리오', () => {
  // ────────────────────────────────────
  // 1. 에이전트 유닛 테스트 (Anvil 불필요)
  // ────────────────────────────────────
  describe('에이전트 파싱', () => {
    it('ETH→USDC 스왑 메시지를 올바르게 파싱해야 한다', async () => {
      const intent = await runSwapAgent('Please swap my ETH to USDC')
      expect(intent).not.toBeNull()
      expect(intent?.tokenIn).toBe('ETH')
      expect(intent?.tokenOut).toBe('USDC')
      expect(intent?.amountIn).toBe(1000000000000000000n)
    })

    it('스왑이 아닌 액션은 null을 반환해야 한다', async () => {
      const intent = await runSwapAgent('Please check balance')
      expect(intent).toBeNull()
    })
  })

  // ────────────────────────────────────
  // 2. clearance 권한 검증 테스트
  // ────────────────────────────────────
  describe('clearance 권한 검증', () => {
    it('허용된 컨트랙트+액션은 통과해야 한다', () => {
      const clearance = createClearance({
        agent: 'swap-agent',
        permissions: {
          allowedContracts: [UNISWAP_V3_ROUTER],
          allowedActions: ['swap'],
          spendLimit: { ETH: 2_000_000_000_000_000_000n }, // 2 ETH
          expiry: 3600, // 1 hour in seconds
        },
      })

      expect(() =>
        clearance.validate({
          contract: UNISWAP_V3_ROUTER,
          action: 'swap',
          spend: { token: 'ETH', amount: 1_000_000_000_000_000_000n },
        })
      ).not.toThrow()
    })

    it('허용되지 않은 컨트랙트는 차단해야 한다', () => {
      const clearance = createClearance({
        agent: 'swap-agent',
        permissions: {
          allowedContracts: [UNISWAP_V3_ROUTER],
          allowedActions: ['swap'],
          spendLimit: { ETH: 2_000_000_000_000_000_000n },
          expiry: 3600,
        },
      })

      expect(() =>
        clearance.validate({
          contract: '0xMaliciousContract',
          action: 'swap',
          spend: { token: 'ETH', amount: 1_000_000_000_000_000_000n },
        })
      ).toThrow()
    })

    it('한도 초과 지출은 차단해야 한다', () => {
      const clearance = createClearance({
        agent: 'swap-agent',
        permissions: {
          allowedContracts: [UNISWAP_V3_ROUTER],
          allowedActions: ['swap'],
          spendLimit: { ETH: 500_000_000_000_000_000n }, // 0.5 ETH
          expiry: 3600,
        },
      })

      expect(() =>
        clearance.validate({
          contract: UNISWAP_V3_ROUTER,
          action: 'swap',
          spend: { token: 'ETH', amount: 1_000_000_000_000_000_000n }, // 1 ETH — 초과
        })
      ).toThrow()
    })
  })

  // ────────────────────────────────────
  // 3. LLM mock 직접 테스트
  // ────────────────────────────────────
  describe('LLM mock 패턴 매칭', () => {
    it('mockLLM이 regex 패턴을 올바르게 매칭해야 한다', () => {
      const mock = mockLLM({
        responses: [
          { prompt: /swap.*ETH/i, reply: 'confirmed' },
        ],
      })
      expect(mock.resolve('swap 1 ETH to USDC')).toBe('confirmed')
    })

    it('createMockChatModel이 마지막 메시지 기준으로 매칭해야 한다', async () => {
      const mock = mockLLM({
        responses: [{ prompt: /approve/i, reply: 'approved' }],
      })
      const model = createMockChatModel(mock)
      const result = await model.invoke([
        { role: 'system', content: 'You are a DeFi agent' },
        { role: 'user', content: 'please approve the USDC spend' },
      ])
      expect(result.content).toBe('approved')
    })
  })
})
