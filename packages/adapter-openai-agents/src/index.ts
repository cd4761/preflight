/**
 * OpenAI Agents SDK adapter for preflight.
 *
 * Like a minimal OpenAI Agents runner stand-in: instead of calling the real API,
 * return deterministic output from a mockLLM instance.
 */
import type { LLMMock } from '@preflight/core'

/** Result of a mock agents run */
export interface MockAgentsRunResult {
  readonly output: string
}

/**
 * A minimal mock OpenAI Agents-compatible client.
 *
 * Provides a `run(input)` method that resolves input against mockLLM rules,
 * mimicking the core agent execution pattern of the OpenAI Agents SDK.
 */
export interface MockAgentsClient {
  run(input: string): Promise<MockAgentsRunResult>
}

/**
 * Create a mock OpenAI Agents-compatible client backed by an LLMMock.
 *
 * @param mock - LLMMock from mockLLM()
 * @returns MockAgentsClient with run() method
 *
 * @example
 * const mock = mockLLM({ responses: [{ prompt: /swap/, reply: 'swap ETH' }] })
 * const agent = createAgentsMock(mock)
 * const result = await agent.run('swap 1 ETH for USDC')
 */
export function createAgentsMock(mock: LLMMock): MockAgentsClient {
  return {
    async run(input: string): Promise<MockAgentsRunResult> {
      const output = mock.resolve(input)
      return { output }
    },
  }
}
