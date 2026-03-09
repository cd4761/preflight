import { describe, it, expect } from 'vitest'
import { mockLLM, createMockOpenAI } from './mock-llm'

describe('mockLLM', () => {
  it('should return mocked response for a regex-matching prompt', async () => {
    const mock = mockLLM({
      responses: [{ prompt: /swap/, reply: 'swap 1 ETH for USDC' }],
    })
    const openai = createMockOpenAI(mock)
    const result = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'please swap my tokens' }],
    })
    expect(result.choices[0].message.content).toBe('swap 1 ETH for USDC')
  })

  it('should return mocked response for a string-matching prompt', async () => {
    const mock = mockLLM({
      responses: [{ prompt: 'transfer', reply: 'transfer 0.5 ETH to 0xabc' }],
    })
    const openai = createMockOpenAI(mock)
    const result = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'please transfer ETH' }],
    })
    expect(result.choices[0].message.content).toBe('transfer 0.5 ETH to 0xabc')
  })

  it('should use the last message as the prompt', async () => {
    const mock = mockLLM({
      responses: [{ prompt: /approve/, reply: 'approve USDC' }],
    })
    const openai = createMockOpenAI(mock)
    const result = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'please approve the token' },
      ],
    })
    expect(result.choices[0].message.content).toBe('approve USDC')
  })

  it('should not match patterns in earlier messages — only the last message is tested', async () => {
    const mock = mockLLM({
      responses: [{ prompt: /swap/, reply: 'swap reply' }],
    })
    const openai = createMockOpenAI(mock)
    // "swap" appears only in the first message, not the last
    await expect(
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: 'swap my tokens' },
          { role: 'user', content: 'actually, never mind' },
        ],
      })
    ).rejects.toThrow('No mock response found for: "actually, never mind"')
  })

  it('should throw for unmatched prompt with the prompt content in the error', async () => {
    const mock = mockLLM({ responses: [] })
    const openai = createMockOpenAI(mock)

    await expect(
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'do something unmatched' }],
      })
    ).rejects.toThrow('No mock response found for: "do something unmatched"')
  })

  it('should throw a specific error when messages array is empty', async () => {
    const mock = mockLLM({ responses: [] })
    const openai = createMockOpenAI(mock)

    await expect(
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [],
      })
    ).rejects.toThrow('createMockOpenAI: messages array must not be empty')
  })

  it('should resolve prompt directly via mockLLM.resolve() — regex match', () => {
    const mock = mockLLM({
      responses: [{ prompt: /swap/, reply: 'swap ETH' }],
    })
    expect(mock.resolve('please swap my tokens')).toBe('swap ETH')
  })

  it('should resolve prompt directly via mockLLM.resolve() — string includes match', () => {
    const mock = mockLLM({
      responses: [{ prompt: 'transfer', reply: 'transfer ETH' }],
    })
    expect(mock.resolve('please transfer ETH to 0xabc')).toBe('transfer ETH')
  })

  it('should throw from resolve() when no pattern matches', () => {
    const mock = mockLLM({ responses: [{ prompt: /swap/, reply: 'swap ETH' }] })
    expect(() => mock.resolve('do something else')).toThrow(
      'No mock response found for: "do something else"'
    )
  })

  it('should throw when content is empty string and no catch-all rule matches', async () => {
    const mock = mockLLM({
      responses: [{ prompt: /swap/, reply: 'swap ETH' }],
    })
    const openai = createMockOpenAI(mock)
    await expect(
      openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: '' }],
      })
    ).rejects.toThrow('No mock response found for: ""')
  })

  it('should warn: empty string prompt matches all string-pattern rules (catch-all hazard)', () => {
    // A string rule with '' as pattern will match every prompt via includes('')
    const mock = mockLLM({
      responses: [{ prompt: '', reply: 'catch-all' }],
    })
    // includes('') is always true — this is documented behavior, not a bug to hide
    expect(mock.resolve('completely unrelated prompt')).toBe('catch-all')
    expect(mock.resolve('')).toBe('catch-all')
  })

  it('should match the first matching response when multiple patterns exist', async () => {
    const mock = mockLLM({
      responses: [
        { prompt: /swap/, reply: 'first swap reply' },
        { prompt: /swap ETH/, reply: 'second swap reply' },
      ],
    })
    const openai = createMockOpenAI(mock)
    const result = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'swap ETH for USDC' }],
    })
    expect(result.choices[0].message.content).toBe('first swap reply')
  })
})
