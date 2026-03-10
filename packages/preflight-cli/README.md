# @preflight/cli

CLI runner for preflight AI agent behavioral tests.

## 설치

```
pnpm add -g @preflight/cli
```

## 빠른 시작

```bash
# 테스트 파일 실행
preflight test ./tests/agent.test.ts

# Anvil fork와 함께 실행
preflight test ./tests/*.test.ts --fork https://mainnet.infura.io/v3/...

# 라이브 네트워크 대상 실행
preflight test ./tests/*.test.ts --live mainnet
```

## API

```ts
import { runPreflight } from '@preflight/cli'

const result = await runPreflight(['./tests/agent.test.ts'], {
  fork: 'https://mainnet.infura.io/v3/...',
})
process.exit(result.exitCode)
```

## CLI 옵션

- `preflight test <files...>` — 지정한 테스트 파일 실행
- `--fork <rpcUrl>` — Anvil fork RPC URL 지정
- `--live <network>` — 라이브 네트워크 이름 지정
