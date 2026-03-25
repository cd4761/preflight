import { z } from 'zod'
import { getAuditLog, clearAuditLog } from '../state.js'
import { toolSuccess, toolError } from '../tool-helpers.js'

const getAuditTrailSchema = z.object({
  sessionId: z
    .string()
    .optional()
    .describe('Filter audit entries by session ID. Omit to get all entries.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of entries to return. Default: 50.'),
})

const clearAuditTrailSchema = z.object({})

async function getAuditTrailHandler(params: z.infer<typeof getAuditTrailSchema>) {
  const entries = getAuditLog(params.sessionId)
  const limit = params.limit ?? 50
  const sliced = entries.slice(-limit)

  return toolSuccess({
    total: entries.length,
    returned: sliced.length,
    entries: sliced,
  })
}

async function clearAuditTrailHandler(_params: z.infer<typeof clearAuditTrailSchema>) {
  clearAuditLog()
  return toolSuccess({ cleared: true })
}

export const getAuditTrailTool = {
  name: 'get_audit_trail' as const,
  description: 'Retrieve the audit trail of MCP tool invocations. Filter by session ID or get all entries.',
  schema: getAuditTrailSchema,
  handler: getAuditTrailHandler,
}

export const clearAuditTrailTool = {
  name: 'clear_audit_trail' as const,
  description: 'Clear all audit trail entries',
  schema: clearAuditTrailSchema,
  handler: clearAuditTrailHandler,
}
