# Multi-chain Auto-detection

> **Date:** 2026-03-25
> **Status:** Draft
> **Scope:** `@preflight/core` + `@preflight/mcp` — fork mode chain auto-detection + `Fork.chainId`

---

## Problem

`createFork` fork 모드에서 `chain: mainnet`이 하드코딩되어 있다. Sepolia(`rpc: 'https://sepolia-rpc...'`)를 fork하면 `fork.client.chain.id`가 11155111이 아닌 1을 반환한다. 이는 EIP-155 서명, chain-aware 로직, MCP 세션 메타데이터에서 잘못된 정보를 제공한다.

## Solution

Anvil 시작 후 `eth_chainId` RPC 호출로 실제 chainId를 감지하고, viem의 built-in chain DB에서 매칭한다. 미등록 chain은 `defineChain()`으로 custom chain을 생성한다.

---

## Design

### 1. `getKnownChain` helper

```typescript
import { type Chain, defineChain } from 'viem'
import * as chains from 'viem/chains'

/**
 * Lookup a viem built-in chain definition by chainId.
 * Object.values(chains) may include non-Chain exports (re-exports, types),
 * so the type guard filters to actual Chain objects only.
 */
function getKnownChain(chainId: number): Chain | undefined {
  return Object.values(chains).find(
    (c): c is Chain => typeof c === 'object' && c !== null && 'id' in c && c.id === chainId
  )
}
```

Covers: mainnet(1), sepolia(11155111), base(8453), base-sepolia(84532), arbitrum(42161), optimism(10), polygon(137), foundry(31337), etc.

### 2. `Fork` interface 확장

```typescript
export interface Fork {
  readonly client: PublicClient
  readonly rpcUrl: string
  readonly chainId: number  // NEW — detected from Anvil RPC
  readonly stop: () => Promise<void>
}
```

### 3. `createFork` 변경

```typescript
export async function createFork(options: ForkOptions): Promise<Fork> {
  // ... existing narrowing + validation ...

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // ... existing Anvil start logic ...

    const rpcUrl = `http://${anvil.host}:${anvil.port}`

    // Auto-detect chain from Anvil RPC
    const detectedChainId = options.standalone
      ? 31337
      : await createPublicClient({ transport: http(rpcUrl) }).getChainId()

    const chain = getKnownChain(detectedChainId) ?? defineChain({
      id: detectedChainId,
      name: `Chain ${detectedChainId}`,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    })

    const client = createPublicClient({ chain, transport: http(rpcUrl) })

    return { client, rpcUrl, chainId: detectedChainId, stop: () => anvil.stop() }
  }

  throw new Error('createFork: exhausted port retry attempts')
}
```

**Key decisions:**
- Standalone mode: skip RPC call, use 31337 directly (Anvil default)
- Fork mode: 1 RPC call to local Anvil (~<1ms)
- Unknown chainId: `defineChain()` with generic name, ETH as native currency

### 4. `LiveFork` chainId pass-through

`LiveFork = Omit<Fork, 'stop'> & { ... }` — `Omit<Fork, 'stop'>`이 자동으로 `chainId`를 포함하므로 `LiveFork` 타입 정의 자체는 변경 불필요. `createLiveFork` 반환값에 `chainId`가 spread로 전달됨:

```typescript
const { stop, ...fork } = await createFork({ rpc: rpcUrl })
// fork는 { client, rpcUrl, chainId } — chainId 자동 포함
return { ...fork, network, dispose: stop }
```

### 5. MCP `launchFork` / `resetForkHandler` 업데이트

**launchFork:** `fork.client.getChainId()` 호출을 `fork.chainId` 직접 사용으로 교체 (중복 RPC 호출 제거):

```typescript
// BEFORE
[resolvedBlockNumber, chainId] = await Promise.all([
  blockNumber !== undefined ? Promise.resolve(blockNumber) : fork.client.getBlockNumber(),
  fork.client.getChainId(),  // redundant RPC call
])

// AFTER
const resolvedBlockNumber = blockNumber !== undefined
  ? blockNumber
  : await fork.client.getBlockNumber()
const chainId = fork.chainId  // already detected
```

**resetForkHandler:** 기존 세션의 chainId를 재사용하지 않고, 새 fork에서 감지된 `fork.chainId`를 사용:

```typescript
// BEFORE
chainId: existing.chainId,  // stale if chain changed

// AFTER
chainId: fork.chainId,  // fresh from new fork
```

### 6. 파일 변경 목록

| File | Change |
|------|--------|
| `packages/preflight-core/src/fork.ts` | `getKnownChain` helper, `Fork.chainId`, auto-detect, remove `mainnet` import |
| `packages/preflight-core/src/fork.test.ts` | standalone chainId=31337 (기존), fork mode chainId 검증 추가 |
| `packages/preflight-core/src/e2e.test.ts` | `fork.chainId === 31337` assertion 추가 |
| `packages/preflight-core/src/live-fork.ts` | 변경 없음 (`Omit<Fork, 'stop'>`이 자동 포함) |
| `packages/preflight-core/src/index.ts` | 변경 없음 |
| `packages/mcp/src/tools/fork.ts` | `launchFork`: `fork.chainId` 사용, `resetForkHandler`: 새 fork의 chainId 사용 |

### 7. 기존 코드 호환성

- `Fork` interface에 `chainId` 추가는 additive change — 기존 소비자가 무시해도 됨
- `fork.client.chain.id`가 실제 chainId와 일치하므로 chain-aware 코드가 정확해짐
- MCP `launchFork`는 `fork.chainId`로 교체하여 중복 RPC 호출 제거
- MCP `resetForkHandler`는 새 fork의 chainId를 정확히 사용

### 8. Out of Scope

- Protocol-specific helpers (Uniswap, Aave address lookup by chain)
- `RemoteForkOptions`에 explicit `chainId` 파라미터 (auto-detect로 충분)
- `LiveForkOptions` network 확장 (기존 sepolia/base-sepolia 유지)

### 9. Success Criteria

- `createFork({ rpc: sepoliaRpc }).chainId === 11155111`
- `createFork({ standalone: true }).chainId === 31337`
- `fork.client.chain.id === fork.chainId` (일치 보장)
- MCP `launchFork`가 `fork.chainId` 직접 사용 (중복 RPC 제거)
- MCP `resetForkHandler`가 새 fork의 chainId 사용
- 기존 테스트 전부 통과 + 신규 chainId 테스트 추가
