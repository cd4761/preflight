import { startVitest } from 'vitest/node'

export interface PreflightOptions {
  readonly fork?: string
  readonly live?: string
}

export interface PreflightResult {
  readonly exitCode: 0 | 1
  readonly results: {
    readonly passed: number
    readonly failed: number
    /** Total tests attempted; passed + failed when accurate, failed when only failure count is available */
    readonly total: number
  }
}

export async function runPreflight(
  files: readonly string[],
  options: PreflightOptions
): Promise<PreflightResult> {
  if (files.length === 0) {
    throw new Error('No test files specified')
  }

  const vitest = await startVitest('test', [...files], {
    run: true,
    reporters: ['dot'],
    // Pass fork/live as vitest env so process.env is not mutated globally
    env: {
      ...(options.fork !== undefined && { PREFLIGHT_FORK_URL: options.fork }),
      ...(options.live !== undefined && { PREFLIGHT_LIVE_NETWORK: options.live }),
    },
  })

  try {
    const failed = vitest.state.getCountOfFailedTests()
    const exitCode: 0 | 1 = failed > 0 ? 1 : 0
    // passed count is not available via the state mock API;
    // total equals failed since passed is reported as 0
    return { exitCode, results: { passed: 0, failed, total: failed } }
  } finally {
    await vitest.close()
  }
}
