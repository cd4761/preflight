import { describe, it, expect } from 'vitest'
// Not yet implemented — this import will fail (RED state)
import { createMockChatModel } from './index'
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

describe('createMockChatModel', () => {
  describe('basic creation', () => {
    it('should return an object when given a LLMMock', () => {
      const mock = makeMock([{ prompt: /swap/, reply: 'swap 1 ETH for USDC' }])
      const model = createMockChatModel(mock)
      expect(model).toBeDefined()
      expect(typeof model).toBe('object')
    })

    it('should return an object with invoke method', () => {
      const mock = makeMock([{ prompt: /hello/, reply: 'hi there' }])
      const model = createMockChatModel(mock)
      expect(model).toHaveProperty('invoke')
      expect(typeof model.invoke).toBe('function')
    })
  })

  describe('invoke', () => {
    it('should return { role, content } for matching pattern', async () => {
      const mock = makeMock([{ prompt: /swap/, reply: 'swap 1 ETH for USDC' }])
      const model = createMockChatModel(mock)
      const result = await model.invoke([
        { role: 'user', content: 'please swap my tokens' },
      ])
      expect(result).toEqual({
        role: 'assistant',
        content: 'swap 1 ETH for USDC',
      })
    })

    it('should match against the last message content', async () => {
      const mock = makeMock([{ prompt: /approve/, reply: 'approved USDC' }])
      const model = createMockChatModel(mock)
      const result = await model.invoke([
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'please approve the token' },
      ])
      expect(result).toEqual({
        role: 'assistant',
        content: 'approved USDC',
      })
    })

    it('should throw when no pattern matches', async () => {
      const mock = makeMock([{ prompt: /swap/, reply: 'swap ETH' }])
      const model = createMockChatModel(mock)
      await expect(
        model.invoke([{ role: 'user', content: 'do something else' }])
      ).rejects.toThrow()
    })

    it('should return first matching response when multiple patterns match', async () => {
      const mock = makeMock([
        { prompt: /swap/, reply: 'first swap reply' },
        { prompt: /swap ETH/, reply: 'second swap reply' },
      ])
      const model = createMockChatModel(mock)
      const result = await model.invoke([
        { role: 'user', content: 'swap ETH for USDC' },
      ])
      expect(result.content).toBe('first swap reply')
    })
  })

  describe('empty messages', () => {
    it('should throw when messages array is empty', async () => {
      const mock = makeMock([{ prompt: /swap/, reply: 'swap ETH' }])
      const model = createMockChatModel(mock)
      await expect(model.invoke([])).rejects.toThrow()
    })
  })
})
