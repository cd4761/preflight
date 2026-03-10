# @preflight/adapter-langchain

LangChain adapter for preflight — deterministic mock chat model backed by mockLLM.

## 설치

```
pnpm add @preflight/adapter-langchain
```

## 빠른 시작

```ts
import { mockLLM } from '@preflight/core'
import { createMockChatModel } from '@preflight/adapter-langchain'

const mock = mockLLM({
  responses: [{ prompt: /swap/, reply: 'I will swap 1 ETH for USDC' }],
})

const chatModel = createMockChatModel(mock)

const result = await chatModel.invoke([
  { role: 'user', content: 'Please swap 1 ETH for USDC' },
])
console.log(result.content) // 'I will swap 1 ETH for USDC'
```

## API

- `createMockChatModel(mock)` — LangChain `BaseChatModel.invoke()` 호환 목 모델 생성
  - `mock`: `mockLLM()`이 반환한 `LLMMock` 인스턴스
  - 반환: `MockChatModel` (`invoke(messages)` 메서드 제공)
