import { describe, it, expect } from 'vitest'
// Not yet implemented — this import will fail (RED state)
import { createAgentsMock } from './index'
import type { LLMMock } from '@preflight/core'

// Inline mock to keep test self-contained (per lead instruction)
function makeMock(responses: Array<{ prompt: string | RegExp; reply: string }>): LLMMock {
  return {
    resolve(input: string): string {
      for (const r of responses) {
        if (typeof r.prompt === 'string' && input.includes(r.prompt)) return r.reply
        if (r.prompt instanceof RegExp && r.prompt.test(input)) return r.reply
      }
      throw new Error(`No mock response found for: "${input}"`)
    },
  } as LLMMock
}

describe('createAgentsMock', () => {
  const mock = makeMock([
    { prompt: /swap/, reply: 'swap 1 ETH for USDC' },
    { prompt: /transfer/, reply: 'transfer 0.5 ETH to 0xabc' },
  ])

  describe('basic creation', () => {
    it('should return an object when given a LLMMock instance', () => {
      const agentsMock = createAgentsMock(mock)
      expect(agentsMock).toBeDefined()
      expect(typeof agentsMock).toBe('object')
    })

    it('should have a run method', () => {
      const agentsMock = createAgentsMock(mock)
      expect(agentsMock).toHaveProperty('run')
      expect(typeof agentsMock.run).toBe('function')
    })
  })

  describe('run', () => {
    it('should return { output } with matching reply', async () => {
      const agentsMock = createAgentsMock(mock)
      const result = await agentsMock.run('please swap my tokens')
      expect(result).toEqual({ output: 'swap 1 ETH for USDC' })
    })

    it('should match different patterns', async () => {
      const agentsMock = createAgentsMock(mock)
      const result = await agentsMock.run('transfer ETH to my wallet')
      expect(result).toEqual({ output: 'transfer 0.5 ETH to 0xabc' })
    })

    it('should throw when no pattern matches', async () => {
      const agentsMock = createAgentsMock(mock)
      await expect(
        agentsMock.run('do something unmatched')
      ).rejects.toThrow()
    })
  })

  describe('with empty responses', () => {
    it('should throw on any input when responses are empty', async () => {
      const emptyMock = makeMock([])
      const agentsMock = createAgentsMock(emptyMock)
      await expect(
        agentsMock.run('anything')
      ).rejects.toThrow()
    })
  })
})
