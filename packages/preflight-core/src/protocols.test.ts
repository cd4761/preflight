import { describe, it, expect } from 'vitest'
import {
  getProtocolAddresses,
  getSupportedProtocols,
  getSupportedChainIds,
} from './protocols'

describe('getProtocolAddresses', () => {
  it('should return Uniswap V3 SwapRouter on mainnet', () => {
    const contracts = getProtocolAddresses(1, 'uniswap-v3')
    expect(contracts).toBeDefined()
    expect(contracts!.find(c => c.label === 'SwapRouter')).toBeDefined()
    expect(contracts![0]!.address).toMatch(/^0x[0-9a-fA-F]{40}$/)
  })

  it('should return Aave V3 Pool on Base', () => {
    const contracts = getProtocolAddresses(8453, 'aave-v3')
    expect(contracts).toBeDefined()
    expect(contracts!.find(c => c.label === 'Pool')).toBeDefined()
  })

  it('should return WETH on Arbitrum', () => {
    const contracts = getProtocolAddresses(42161, 'weth')
    expect(contracts).toBeDefined()
    expect(contracts!).toHaveLength(1)
  })

  it('should return undefined for unregistered chain+protocol', () => {
    expect(getProtocolAddresses(999999, 'uniswap-v3')).toBeUndefined()
  })

  it('should return Sepolia Uniswap V3', () => {
    const contracts = getProtocolAddresses(11155111, 'uniswap-v3')
    expect(contracts).toBeDefined()
  })
})

describe('getSupportedProtocols', () => {
  it('should list protocols for mainnet', () => {
    const protocols = getSupportedProtocols(1)
    expect(protocols).toContain('uniswap-v3')
    expect(protocols).toContain('aave-v3')
    expect(protocols).toContain('weth')
  })

  it('should return empty for unknown chain', () => {
    expect(getSupportedProtocols(999999)).toHaveLength(0)
  })
})

describe('getSupportedChainIds', () => {
  it('should include mainnet, sepolia, base, arbitrum, optimism, polygon', () => {
    const chains = getSupportedChainIds()
    expect(chains).toContain(1)
    expect(chains).toContain(11155111)
    expect(chains).toContain(8453)
    expect(chains).toContain(42161)
    expect(chains).toContain(10)
    expect(chains).toContain(137)
  })

  it('should return sorted chain IDs', () => {
    const chains = getSupportedChainIds()
    for (let i = 1; i < chains.length; i++) {
      expect(chains[i]!).toBeGreaterThan(chains[i - 1]!)
    }
  })
})
