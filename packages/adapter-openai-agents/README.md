# @preflight/adapter-openai-agents

OpenAI Agents SDK adapter for preflight — deterministic mock agent runner backed by mockLLM.

## 설치

```
pnpm add @preflight/adapter-openai-agents
```

## 빠른 시작

```ts
import { mockLLM } from '@preflight/core'
import { createAgentsMock } from '@preflight/adapter-openai-agents'

const mock = mockLLM({
  responses: [{ prompt: /swap/, reply: 'Swapping 1 ETH for USDC now' }],
})

const agent = createAgentsMock(mock)

const result = await agent.run('swap 1 ETH for USDC')
console.log(result.output) // 'Swapping 1 ETH for USDC now'
```

## API

- `createAgentsMock(mock)` — OpenAI Agents SDK `run()` 호환 목 클라이언트 생성
  - `mock`: `mockLLM()`이 반환한 `LLMMock` 인스턴스
  - 반환: `MockAgentsClient` (`run(input)` 메서드 제공)
