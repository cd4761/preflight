import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { saveState, loadState, type PersistedSession } from '../persistence.js'
import type { AuditEntry } from '../types.js'

const TEST_DIR = join(tmpdir(), `preflight-test-${Date.now()}`)

beforeEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true })
})

const SESSION: PersistedSession = {
  id: 'test-session',
  rpcUrl: 'http://127.0.0.1:54321',
  forkUrl: 'https://eth.drpc.org',
  blockNumber: '21500000',
  chainId: 1,
  createdAt: '2026-03-25T00:00:00.000Z',
  stale: false,
}

const AUDIT: AuditEntry = {
  timestamp: '2026-03-25T00:00:00.000Z',
  tool: 'create_fork',
  sessionId: 'test-session',
  result: 'success',
  detail: 'chainId=1',
}

describe('saveState', () => {
  it('should create directory and file', () => {
    saveState([SESSION], [AUDIT], TEST_DIR)
    expect(existsSync(join(TEST_DIR, 'state.json'))).toBe(true)
  })

  it('should save valid JSON', () => {
    saveState([SESSION], [AUDIT], TEST_DIR)
    const loaded = loadState(TEST_DIR)
    expect(loaded).not.toBeNull()
    expect(loaded!.sessions).toHaveLength(1)
    expect(loaded!.auditLog).toHaveLength(1)
    expect(loaded!.savedAt).toBeDefined()
  })
})

describe('loadState', () => {
  it('should return null when no file exists', () => {
    expect(loadState(TEST_DIR)).toBeNull()
  })

  it('should restore session data correctly', () => {
    saveState([SESSION], [AUDIT], TEST_DIR)
    const loaded = loadState(TEST_DIR)!
    expect(loaded.sessions[0]!.id).toBe('test-session')
    expect(loaded.sessions[0]!.chainId).toBe(1)
    expect(loaded.sessions[0]!.blockNumber).toBe('21500000')
    expect(loaded.auditLog[0]!.tool).toBe('create_fork')
  })

  it('should handle corrupted file gracefully', () => {
    mkdirSync(TEST_DIR, { recursive: true })
    const { writeFileSync } = require('node:fs')
    writeFileSync(join(TEST_DIR, 'state.json'), '{invalid json', 'utf-8')
    expect(loadState(TEST_DIR)).toBeNull()
  })

  it('should handle empty sessions and audit log', () => {
    saveState([], [], TEST_DIR)
    const loaded = loadState(TEST_DIR)!
    expect(loaded.sessions).toHaveLength(0)
    expect(loaded.auditLog).toHaveLength(0)
  })
})
