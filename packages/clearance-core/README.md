# @clearance/core

AI 에이전트 실행 전 권한 스코프를 검증하는 SDK.

## 설치

```
pnpm add @clearance/core
```

## 빠른 시작

```ts
import { createClearance } from '@clearance/core'

const clearance = createClearance({
  allowedContracts: ['0xUniswapV3Router'],
  maxSpend: { ETH: 1_000_000_000_000_000_000n },
  expiresAt: Date.now() + 3600_000,
})

clearance.validate({ contract: '0xUniswapV3Router', action: 'swap' })
```

## API

- `createClearance(options)` — 권한 스코프 생성
- `clearance.validate(action)` — 허용되지 않은 액션 시 throw
- `clearance.check(action)` — boolean 반환
- `clearance.isExpired()` — 만료 여부
- `clearance.spentAmounts` — 누적 지출
