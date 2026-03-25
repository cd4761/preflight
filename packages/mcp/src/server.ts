import { randomUUID } from 'crypto'
import { createServer as nodeCreateServer } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createForkTool, resetForkTool } from './tools/fork.js'
import { simulateTransactionTool } from './tools/simulate.js'
import { checkClearanceTool, setPolicyTool, getPolicyTool, deletePolicyTool } from './tools/clearance.js'
import { signAuthorizationTool, verifyAuthorizationTool } from './tools/eip7702.js'
import { assertOnChainTool } from './tools/assert.js'
import { getAuditTrailTool, clearAuditTrailTool } from './tools/audit.js'

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'preflight',
    version: '0.1.0',
  })

  server.tool(createForkTool.name, createForkTool.schema.shape, createForkTool.handler)
  server.tool(resetForkTool.name, resetForkTool.schema.shape, resetForkTool.handler)
  server.tool(simulateTransactionTool.name, simulateTransactionTool.schema.shape, simulateTransactionTool.handler)
  server.tool(checkClearanceTool.name, checkClearanceTool.schema.shape, checkClearanceTool.handler)
  server.tool(signAuthorizationTool.name, signAuthorizationTool.schema.shape, signAuthorizationTool.handler)
  server.tool(verifyAuthorizationTool.name, verifyAuthorizationTool.schema.shape, verifyAuthorizationTool.handler)
  server.tool(assertOnChainTool.name, assertOnChainTool.schema.shape, assertOnChainTool.handler)
  server.tool(setPolicyTool.name, setPolicyTool.schema.shape, setPolicyTool.handler)
  server.tool(getPolicyTool.name, getPolicyTool.schema.shape, getPolicyTool.handler)
  server.tool(deletePolicyTool.name, deletePolicyTool.schema.shape, deletePolicyTool.handler)
  server.tool(getAuditTrailTool.name, getAuditTrailTool.schema.shape, getAuditTrailTool.handler)
  server.tool(clearAuditTrailTool.name, clearAuditTrailTool.schema.shape, clearAuditTrailTool.handler)

  return server
}

/** Options for starting the MCP server. */
export interface ServerOptions {
  /** If set, start an HTTP server on this port instead of stdio. */
  readonly httpPort?: number
}

/**
 * Start the MCP server with either stdio or Streamable HTTP transport.
 *
 * Like choosing between a walkie-talkie (stdio, direct line) and a radio tower
 * (HTTP, anyone can tune in) — same messages, different delivery.
 *
 * @param options - Server configuration. Omit or pass `{}` for stdio (default).
 *
 * @example
 * // stdio (default)
 * await startServer()
 *
 * // HTTP on port 3000
 * await startServer({ httpPort: 3000 })
 */
export async function startServer(options?: ServerOptions): Promise<void> {
  if (!process.env.PREFLIGHT_FORK_URL) {
    process.stderr.write('Warning: PREFLIGHT_FORK_URL not set. simulate_transaction and create_fork will fail.\n')
  }

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
