# Example: Uniswap Swap Agent

preflight + clearance를 사용하여 AI DeFi 에이전트를 테스트하는 예제.

## 이 예제가 보여주는 것

1. **에이전트 파싱 테스트** — LLM mock으로 에이전트 로직을 단위 테스트
2. **clearance 권한 검증** — 에이전트가 허용된 컨트랙트와 지출 한도 내에서만 동작하는지 확인
3. **LLM mock 패턴 매칭** — regex/string 기반 LLM 응답 제어

## 실행

```bash
pnpm install
pnpm test
```

## 핵심 패턴

```ts
import { mockLLM } from '@preflight/core'
import { createClearance } from '@clearance/core'
import { createMockChatModel } from '@preflight/adapter-langchain'

// 1. LLM mock 정의
const mock = mockLLM({
  responses: [
    { prompt: /swap.*ETH/i, reply: '{"action":"swap","amountIn":"1000000000000000000"}' },
  ],
})

// 2. LangChain 호환 mock 모델 생성
const chatModel = createMockChatModel(mock)

// 3. clearance로 에이전트 권한 스코핑
const clearance = createClearance({
  agent: 'swap-agent',
  permissions: {
    allowedContracts: ['0xE592427A0AEce92De3Edee1F18E0157C05861564'],
    allowedActions: ['swap'],
    spendLimit: { ETH: 2_000_000_000_000_000_000n },
    expiry: 3600, // seconds
  },
})
```
