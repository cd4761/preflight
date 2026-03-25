# Streamable HTTP Transport for MCP Server

> **Date:** 2026-03-25
> **Status:** Draft
> **Scope:** `@preflight/mcp` — add Streamable HTTP transport alongside stdio

---

## Problem

MCP 서버가 stdio transport만 지원한다. Claude Code 같은 로컬 CLI에서는 stdio가 적합하지만, 웹 기반 AI 에이전트나 원격 클라이언트는 HTTP로 MCP 서버에 접근해야 한다.

## Solution

MCP SDK의 `StreamableHTTPServerTransport`를 활용하여 HTTP 모드를 추가한다. CLI flag(`--http <port>`) 또는 환경변수(`PREFLIGHT_HTTP_PORT`)로 전환. 기본은 stdio 유지.

---

## Design

### 1. `startServer` 옵션 확장

```typescript
export interface ServerOptions {
  readonly httpPort?: number
}

export async function startServer(options?: ServerOptions): Promise<void> {
  const server = createServer()

  if (options?.httpPort) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    })
    const httpServer = nodeCreateServer((req, res) => {
      transport.handleRequest(req, res)
    })
    httpServer.listen(options.httpPort, () => {
      process.stderr.write(`Preflight MCP server listening on http://localhost:${options.httpPort}/mcp\n`)
    })
    await server.connect(transport)
  } else {
    const transport = new StdioServerTransport()
    await server.connect(transport)
  }
}
```

### 2. CLI entrypoint (`index.ts`)

```typescript
const httpPortArg = process.argv.find((_, i, a) => a[i - 1] === '--http')
const httpPort = parseInt(httpPortArg ?? process.env.PREFLIGHT_HTTP_PORT ?? '', 10) || undefined

await startServer(httpPort ? { httpPort } : undefined)
```

### 3. 사용법

```bash
# stdio (기본, 변경 없음)
npx @preflight/mcp

# HTTP mode
npx @preflight/mcp --http 3000

# 환경변수
PREFLIGHT_HTTP_PORT=3000 npx @preflight/mcp
```

### 4. 파일 변경 목록

| File | Change |
|------|--------|
| `packages/mcp/src/server.ts` | `ServerOptions` interface, HTTP transport 분기, import 추가 |
| `packages/mcp/src/index.ts` | CLI arg / env var 파싱 |

### 5. 테스트

HTTP transport 테스트는 실제 HTTP 서버를 띄우고 요청을 보내야 하므로 integration test로 분류:
- `--http` 옵션으로 서버 시작 → HTTP POST로 MCP 요청 → 응답 검증
- 기존 stdio 테스트는 변경 없음

### 6. 기존 코드 호환성

- `createServer()` 함수는 변경 없음 (transport-agnostic)
- `startServer()` 시그니처에 optional parameter 추가 — 기존 호출자 영향 없음
- stdio 모드가 기본 — 기존 동작 보존

### 7. Success Criteria

- `npx @preflight/mcp` → stdio 모드 (기존과 동일)
- `npx @preflight/mcp --http 3000` → HTTP 서버 시작, port 3000 listen
- HTTP POST `/mcp` → MCP JSON-RPC 응답
- 기존 58 MCP tests 전부 통과
