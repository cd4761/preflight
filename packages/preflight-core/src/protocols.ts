/**
 * Protocol address registry — well-known contract addresses per chain.
 *
 * Like a phone book for DeFi: look up the Uniswap router address
 * on any supported chain without hunting through docs.
 */

/** Supported protocol identifiers. */
export type Protocol = 'uniswap-v3' | 'uniswap-v2' | 'aave-v3' | 'compound-v3' | 'weth'

/** A single contract entry with address and human-readable label. */
export interface ProtocolContract {
  readonly address: string
  readonly label: string
}

/** Registry key: `${chainId}:${protocol}` */
type RegistryKey = `${number}:${Protocol}`

const REGISTRY: Readonly<Record<RegistryKey, readonly ProtocolContract[]>> = {
  // Mainnet (1)
  '1:uniswap-v3': [
    { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', label: 'SwapRouter' },
    { address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', label: 'Factory' },
  ],
  '1:uniswap-v2': [
    { address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', label: 'Router02' },
    { address: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', label: 'Factory' },
  ],
  '1:aave-v3': [
    { address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', label: 'Pool' },
    { address: '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e', label: 'PoolAddressesProvider' },
  ],
  '1:compound-v3': [
    { address: '0xc3d688B66703497DAA19211EEdff47f25384cdc3', label: 'cUSDCv3' },
    { address: '0xA17581A9E3356d9A858b789D68B4d866e593aE94', label: 'cWETHv3' },
  ],
  '1:weth': [
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', label: 'WETH9' },
  ],

  // Sepolia (11155111)
  '11155111:uniswap-v3': [
    { address: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E', label: 'SwapRouter' },
  ],
  '11155111:aave-v3': [
    { address: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951', label: 'Pool' },
  ],
  '11155111:weth': [
    { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', label: 'WETH9' },
  ],

  // Base (8453)
  '8453:uniswap-v3': [
    { address: '0x2626664c2603336E57B271c5C0b26F421741e481', label: 'SwapRouter02' },
    { address: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD', label: 'Factory' },
  ],
  '8453:aave-v3': [
    { address: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5', label: 'Pool' },
  ],
  '8453:weth': [
    { address: '0x4200000000000000000000000000000000000006', label: 'WETH' },
  ],

  // Arbitrum (42161)
  '42161:uniswap-v3': [
    { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', label: 'SwapRouter' },
    { address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', label: 'Factory' },
  ],
  '42161:aave-v3': [
    { address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', label: 'Pool' },
  ],
  '42161:weth': [
    { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', label: 'WETH' },
  ],

  // Optimism (10)
  '10:uniswap-v3': [
    { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', label: 'SwapRouter' },
    { address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', label: 'Factory' },
  ],
  '10:aave-v3': [
    { address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', label: 'Pool' },
  ],
  '10:weth': [
    { address: '0x4200000000000000000000000000000000000006', label: 'WETH' },
  ],

  // Polygon (137)
  '137:uniswap-v3': [
    { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', label: 'SwapRouter' },
    { address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', label: 'Factory' },
  ],
  '137:aave-v3': [
    { address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', label: 'Pool' },
  ],
  '137:weth': [
    { address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', label: 'WMATIC (wrapped native)' },
  ],
}

/**
 * Get contract addresses for a protocol on a specific chain.
 *
 * @param chainId - EVM chain ID (e.g. 1 for mainnet, 8453 for Base)
 * @param protocol - Protocol identifier (e.g. 'uniswap-v3', 'aave-v3')
 * @returns Array of contract addresses, or undefined if not registered
 *
 * @example
 * const contracts = getProtocolAddresses(1, 'uniswap-v3')
 * // [{ address: '0xE592...', label: 'SwapRouter' }, { address: '0x1F98...', label: 'Factory' }]
 */
export function getProtocolAddresses(chainId: number, protocol: Protocol): readonly ProtocolContract[] | undefined {
  const key: RegistryKey = `${chainId}:${protocol}`
  return REGISTRY[key]
}

/**
 * Get all registered protocols for a specific chain.
 *
 * @param chainId - EVM chain ID
 * @returns Array of protocol names available on this chain
 */
export function getSupportedProtocols(chainId: number): readonly Protocol[] {
  const prefix = `${chainId}:`
  return Object.keys(REGISTRY)
    .filter(k => k.startsWith(prefix))
    .map(k => k.slice(prefix.length) as Protocol)
}

/**
 * Get all chain IDs that have registered protocol addresses.
 */
export function getSupportedChainIds(): readonly number[] {
  const ids = new Set<number>()
  for (const key of Object.keys(REGISTRY)) {
    ids.add(parseInt(key.split(':')[0]!, 10))
  }
  return [...ids].sort((a, b) => a - b)
}
