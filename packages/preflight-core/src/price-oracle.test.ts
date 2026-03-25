import { describe, it, expect } from 'vitest'
import {
  createStaticPriceProvider,
  weiToUsd,
  usdToWei,
  checkUsdSpendLimit,
} from './price-oracle'

const ONE_ETH = 1_000_000_000_000_000_000n
const ONE_USDC = 1_000_000n

describe('createStaticPriceProvider', () => {
  const provider = createStaticPriceProvider({ ETH: 3500, USDC: 1.0, WBTC: 95000 })

  it('should return price for known token', async () => {
    const price = await provider.getPrice('ETH')
    expect(price).not.toBeNull()
    expect(price!.usdPrice).toBe(3500)
    expect(price!.token).toBe('ETH')
  })

  it('should be case-insensitive', async () => {
    const price = await provider.getPrice('eth')
    expect(price).not.toBeNull()
    expect(price!.usdPrice).toBe(3500)
  })

  it('should return null for unknown token', async () => {
    const price = await provider.getPrice('UNKNOWN')
    expect(price).toBeNull()
  })

  it('should include fetchedAt timestamp', async () => {
    const price = await provider.getPrice('ETH')
    expect(price!.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('weiToUsd', () => {
  it('should convert 1 ETH to USD', () => {
    expect(weiToUsd(ONE_ETH, 3500)).toBe(3500)
  })

  it('should convert 0.5 ETH to USD', () => {
    expect(weiToUsd(ONE_ETH / 2n, 3500)).toBe(1750)
  })

  it('should handle 6-decimal tokens (USDC)', () => {
    expect(weiToUsd(ONE_USDC, 1.0, 6)).toBe(1.0)
  })

  it('should return 0 for 0 wei', () => {
    expect(weiToUsd(0n, 3500)).toBe(0)
  })
})

describe('usdToWei', () => {
  it('should convert 3500 USD to 1 ETH', () => {
    expect(usdToWei(3500, 3500)).toBe(ONE_ETH)
  })

  it('should convert 1 USD to 1 USDC', () => {
    expect(usdToWei(1.0, 1.0, 6)).toBe(ONE_USDC)
  })

  it('should round down fractional wei', () => {
    const result = usdToWei(1, 3500)
    expect(result).toBeGreaterThan(0n)
    expect(typeof result).toBe('bigint')
  })
})

describe('checkUsdSpendLimit', () => {
  const ethPrice = { token: 'ETH', usdPrice: 3500, fetchedAt: new Date().toISOString() }

  it('should allow spend within limit', () => {
    const result = checkUsdSpendLimit(ONE_ETH, 5000, ethPrice)
    expect(result.allowed).toBe(true)
    expect(result.usdValue).toBe(3500)
    expect(result.remaining).toBe(1500)
  })

  it('should reject spend exceeding limit', () => {
    const result = checkUsdSpendLimit(ONE_ETH * 2n, 5000, ethPrice)
    expect(result.allowed).toBe(false)
    expect(result.usdValue).toBe(7000)
    expect(result.remaining).toBe(0)
  })

  it('should allow spend exactly at limit', () => {
    const result = checkUsdSpendLimit(ONE_ETH, 3500, ethPrice)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('should handle USDC with 6 decimals', () => {
    const usdcPrice = { token: 'USDC', usdPrice: 1.0, fetchedAt: new Date().toISOString() }
    const result = checkUsdSpendLimit(100_000_000n, 150, usdcPrice, 6) // 100 USDC
    expect(result.allowed).toBe(true)
    expect(result.usdValue).toBe(100)
  })
})
