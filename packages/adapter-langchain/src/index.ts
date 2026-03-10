/**
 * LangChain adapter for preflight.
 *
 * Like a LangChain ChatModel stand-in: instead of calling the real LLM API,
 * return deterministic replies from a mockLLM instance.
 */
import type { LLMMock } from '@preflight/core'

/** Minimal LangChain message shape */
export interface ChatMessage {
  readonly role: string
  readonly content: string
}

/** LangChain-compatible mock chat model response */
export interface MockChatModelResponse {
  readonly role: 'assistant'
  readonly content: string
}

/**
 * A mock LangChain-compatible chat model backed by an LLMMock.
 *
 * Matches `BaseChatModel.invoke()` shape so it can be used as a drop-in
 * in LangChain chains without importing the real @langchain/openai.
 */
export interface MockChatModel {
  invoke(messages: readonly ChatMessage[]): Promise<MockChatModelResponse>
}

/**
 * Create a LangChain-compatible mock chat model.
 *
 * @param mock - LLMMock from mockLLM()
 * @returns MockChatModel that matches the last message against mock rules
 *
 * @example
 * const mock = mockLLM({ responses: [{ prompt: /swap/, reply: 'swap ETH' }] })
 * const chatModel = createMockChatModel(mock)
 * const result = await chatModel.invoke([{ role: 'user', content: 'swap 1 ETH' }])
 */
export function createMockChatModel(mock: LLMMock): MockChatModel {
  return {
    async invoke(messages: readonly ChatMessage[]): Promise<MockChatModelResponse> {
      if (messages.length === 0) {
        throw new Error('createMockChatModel: messages array must not be empty')
      }
      // safe: empty-array guard above guarantees length >= 1
      const lastMessage = messages[messages.length - 1]!
      const content = mock.resolve(lastMessage.content)
      return { role: 'assistant', content }
    },
  }
}
