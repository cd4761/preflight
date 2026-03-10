import { test, expect } from 'vitest'

test('fixture: always fails', () => {
  expect(1 + 1).toBe(3) // intentionally fails
})
