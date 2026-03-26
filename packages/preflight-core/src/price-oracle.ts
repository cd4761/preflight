/**
 * Token price oracle — convert between token amounts and USD values.
 *
 * Like a currency exchange counter at the airport: you hand over tokens,
 * it tells you the dollar value (or vice versa).
 *
 * Designed for clearance spend limit validation in USD terms.
 * Uses a simple provider interface so consumers can plug in any price source.
 */

/** A price quote for a token in USD. */
export interface TokenPrice {
  /** Token identifier (symbol or address) */
  readonly token: string
  /** USD price per whole token (e.g. 3500.00 for ETH) */
  readonly usdPrice: number
  /** When this price was fetched (ISO string) */
  readonly fetchedAt: string
}

/** Interface for pluggable price providers. */
export interface PriceProvider {
  /** Fetch USD price for a token. Returns null if token is not supported. */
  getPrice(token: string): Promise<TokenPrice | null>
}

/**
 * A static price provider with manually set prices.
 * Useful for testing and development without external API dependencies.
 *
 * @example
 * const provider = createStaticPriceProvider({
 *   ETH: 3500,
 *   USDC: 1.0,
 *   WBTC: 95000,
 * })
 */
export function createStaticPriceProvider(prices: Readonly<Record<string, number>>): PriceProvider {
  return {
    async getPrice(token: string): Promise<TokenPrice | null> {
      const key = token.toUpperCase()
      const usdPrice = prices[key]
      if (usdPrice === undefined) return null

      return {
        token: key,
        usdPrice,
        fetchedAt: new Date().toISOString(),
      }
    },
  }
}

/**
 * Convert a token amount (in wei) to USD value.
 *
 * @param amountWei - Token amount in wei (bigint)
 * @param usdPrice - USD price per whole token
 * @param decimals - Token decimals (default: 18 for ETH)
 * @returns USD value as a number
 *
 * @example
 * weiToUsd(1_000_000_000_000_000_000n, 3500, 18) // 3500.0
 * weiToUsd(1_000_000n, 1.0, 6) // 1.0 (USDC)
 */
export function weiToUsd(amountWei: bigint, usdPrice: number, decimals: number = 18): number {
  // Split into whole + fractional to preserve precision for amounts > 2^53 wei
  const divisor = BigInt(10 ** decimals)
  const whole = amountWei / divisor
  const frac = amountWei % divisor
  const tokenAmount = Number(whole) + Number(frac) / Number(divisor)
  return tokenAmount * usdPrice
}

/**
 * Convert a USD value to token amount (in wei).
 *
 * @param usdValue - Target USD value
 * @param usdPrice - USD price per whole token
 * @param decimals - Token decimals (default: 18 for ETH)
 * @returns Token amount in wei (bigint)
 *
 * @remarks Rounds down (conservative) — the returned wei is at most the requested USD value.
 *
 * @example
 * usdToWei(3500, 3500, 18) // 1_000_000_000_000_000_000n (1 ETH)
 */
export function usdToWei(usdValue: number, usdPrice: number, decimals: number = 18): bigint {
  const tokenAmount = usdValue / usdPrice
  const weiAmount = tokenAmount * (10 ** decimals)
  return BigInt(Math.floor(weiAmount))
}

/**
 * Check if a spend amount in wei exceeds a USD limit.
 *
 * @param amountWei - Proposed spend in wei
 * @param usdLimit - Maximum allowed USD value
 * @param price - Token price info
 * @param decimals - Token decimals (default: 18)
 * @returns Object with allowed status and USD values
 */
export function checkUsdSpendLimit(
  amountWei: bigint,
  usdLimit: number,
  price: TokenPrice,
  decimals: number = 18,
): { readonly allowed: boolean; readonly usdValue: number; readonly usdLimit: number; readonly remaining: number } {
  const usdValue = weiToUsd(amountWei, price.usdPrice, decimals)
  return {
    allowed: usdValue <= usdLimit,
    usdValue,
    usdLimit,
    remaining: Math.max(0, usdLimit - usdValue),
  }
}
