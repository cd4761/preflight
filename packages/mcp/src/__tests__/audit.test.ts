import { describe, it, expect, beforeEach } from 'vitest'
import { getAuditTrailTool, clearAuditTrailTool } from '../tools/audit.js'
import { addAuditEntry, clearAuditLog } from '../state.js'

beforeEach(() => {
  clearAuditLog()
})

describe('get_audit_trail tool', () => {
  it('should exist and have correct name', () => {
    expect(getAuditTrailTool.name).toBe('get_audit_trail')
  })

  it('should return empty entries when no audit data', async () => {
    const result = await getAuditTrailTool.handler({})
    const data = JSON.parse(result.content[0].text)
    expect(data.total).toBe(0)
    expect(data.entries).toHaveLength(0)
  })

  it('should return audit entries after tool invocations', async () => {
    addAuditEntry({
      timestamp: new Date().toISOString(),
      tool: 'create_fork',
      sessionId: 'session-1',
      result: 'success',
      detail: 'chainId=1',
    })
    addAuditEntry({
      timestamp: new Date().toISOString(),
      tool: 'simulate_transaction',
      sessionId: 'session-1',
      result: 'error',
      detail: 'revert',
    })

    const result = await getAuditTrailTool.handler({})
    const data = JSON.parse(result.content[0].text)
    expect(data.total).toBe(2)
    expect(data.entries).toHaveLength(2)
    expect(data.entries[0].tool).toBe('create_fork')
    expect(data.entries[1].result).toBe('error')
  })

  it('should filter by sessionId', async () => {
    addAuditEntry({ timestamp: new Date().toISOString(), tool: 'create_fork', sessionId: 'a', result: 'success' })
    addAuditEntry({ timestamp: new Date().toISOString(), tool: 'create_fork', sessionId: 'b', result: 'success' })
    addAuditEntry({ timestamp: new Date().toISOString(), tool: 'simulate_transaction', sessionId: 'a', result: 'success' })

    const result = await getAuditTrailTool.handler({ sessionId: 'a' })
    const data = JSON.parse(result.content[0].text)
    expect(data.total).toBe(2)
    expect(data.entries.every((e: { sessionId: string }) => e.sessionId === 'a')).toBe(true)
  })

  it('should respect limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      addAuditEntry({ timestamp: new Date().toISOString(), tool: `tool-${i}`, result: 'success' })
    }

    const result = await getAuditTrailTool.handler({ limit: 3 })
    const data = JSON.parse(result.content[0].text)
    expect(data.total).toBe(10)
    expect(data.returned).toBe(3)
    expect(data.entries).toHaveLength(3)
    // Should return the last 3 entries
    expect(data.entries[0].tool).toBe('tool-7')
  })
})

describe('clear_audit_trail tool', () => {
  it('should exist and have correct name', () => {
    expect(clearAuditTrailTool.name).toBe('clear_audit_trail')
  })

  it('should clear all audit entries', async () => {
    addAuditEntry({ timestamp: new Date().toISOString(), tool: 'test', result: 'success' })

    const clearResult = await clearAuditTrailTool.handler({})
    const clearData = JSON.parse(clearResult.content[0].text)
    expect(clearData.cleared).toBe(true)

    const getResult = await getAuditTrailTool.handler({})
    const getData = JSON.parse(getResult.content[0].text)
    expect(getData.total).toBe(0)
  })
})
