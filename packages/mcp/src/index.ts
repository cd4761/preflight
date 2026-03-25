#!/usr/bin/env node
import { startServer } from './server.js'

const httpPortArg = process.argv.find((_, i, a) => a[i - 1] === '--http')
const httpPort = parseInt(httpPortArg ?? process.env.PREFLIGHT_HTTP_PORT ?? '', 10) || undefined

startServer(httpPort ? { httpPort } : undefined).catch((err) => {
  process.stderr.write(`preflight MCP server error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})

export { createServer } from './server.js'
export type { ServerOptions } from './server.js'
export * from './types.js'
