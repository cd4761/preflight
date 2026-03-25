import { z } from 'zod'
import { getPolicy, setPolicy, clearPolicy } from '../state.js'
import { toolSuccess, toolError } from '../tool-helpers.js'
import type { ClearancePolicy } from '../types.js'

const INTEGER_STRING = /^\d+$/

const clearanceSchema = z.object({
  token: z.string().describe('Token identifier: "native" or ERC20 address'),
  amount: z
    .string()
    .regex(INTEGER_STRING, 'amount must be a non-negative integer string (wei)')
    .describe('Spend amount in wei as decimal string'),
  recipient: z.string().optional().describe('Recipient address to check against whitelist'),
  policy: z
    .object({
      maxAmount: z
        .string()
        .regex(INTEGER_STRING, 'maxAmount must be a non-negative integer string (wei)')
        .describe('Max spend in wei as decimal string'),
      token: z.string().describe('Token identifier'),
      recipient: z.string().optional(),
      expiresAt: z.number().optional().describe('Unix timestamp in seconds'),
    })
    .optional()
    .describe('Policy to set; uses existing in-memory policy if omitted'),
})

async function clearanceHandler(params: z.infer<typeof clearanceSchema>) {
  const { token, amount, recipient, policy: policyInput } = params

  if (policyInput) {
    const existingPolicy = getPolicy()
    // Preserve cumulative spend history when updating policy for the same token.
    // To reset history, change the token identifier or restart the server.
    const spentAmounts =
      existingPolicy !== null &&
      existingPolicy.token.toUpperCase() === policyInput.token.toUpperCase()
        ? existingPolicy.spentAmounts
        : new Map<string, bigint>()

    const newPolicy: ClearancePolicy = {
      maxAmount: BigInt(policyInput.maxAmount),
      token: policyInput.token,
      recipient: policyInput.recipient,
      expiresAt: policyInput.expiresAt,
      spentAmounts,
    }
    setPolicy(newPolicy)
  }

  const currentPolicy = getPolicy()
  if (!currentPolicy) {
    return toolSuccess({
      allowed: false,
      reason: 'no policy',
      remaining: '0',
    })
  }

  // Check expiry
  if (currentPolicy.expiresAt !== undefined) {
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (nowSeconds >= currentPolicy.expiresAt) {
      const spentSoFar = currentPolicy.spentAmounts.get(token.toUpperCase()) ?? 0n
      const remaining = currentPolicy.maxAmount - spentSoFar
      return toolSuccess({
        allowed: false,
        reason: 'expired',
        remaining: remaining.toString(),
      })
    }
  }

  // Check recipient whitelist
  if (currentPolicy.recipient && recipient) {
    if (currentPolicy.recipient.toLowerCase() !== recipient.toLowerCase()) {
      const normalizedToken = token.toUpperCase()
      const spentSoFar = currentPolicy.spentAmounts.get(normalizedToken) ?? 0n
      const remaining = currentPolicy.maxAmount - spentSoFar
      return toolSuccess({
        allowed: false,
        reason: 'recipient not allowed',
        remaining: remaining.toString(),
      })
    }
  }

  let spendAmount: bigint
  try {
    spendAmount = BigInt(amount)
  } catch {
    return toolSuccess({ allowed: false, reason: 'invalid amount', remaining: '0' })
  }
  const normalizedToken = token.toUpperCase()
  const spentSoFar = currentPolicy.spentAmounts.get(normalizedToken) ?? 0n
  const totalAfterSpend = spentSoFar + spendAmount
  const remaining = currentPolicy.maxAmount - spentSoFar

  if (totalAfterSpend > currentPolicy.maxAmount) {
    return toolSuccess({
      allowed: false,
      reason: 'exceeds limit',
      remaining: remaining.toString(),
    })
  }

  // Record the approved spend so subsequent checks reflect cumulative usage
  currentPolicy.spentAmounts.set(normalizedToken, totalAfterSpend)

  return toolSuccess({
    allowed: true,
    remaining: (remaining - spendAmount).toString(),
  })
}

export const checkClearanceTool = {
  name: 'check_clearance' as const,
  description: 'Check whether a proposed spend is within the clearance policy limits',
  schema: clearanceSchema,
  handler: clearanceHandler,
}

// --- CRUD tools ---

const setPolicySchema = z.object({
  maxAmount: z
    .string()
    .regex(INTEGER_STRING, 'maxAmount must be a non-negative integer string (wei)')
    .describe('Maximum spend in wei'),
  token: z.string().describe('Token identifier: "native" or ERC20 address'),
  recipient: z.string().optional().describe('Optional recipient whitelist address'),
  expiresAt: z.number().optional().describe('Expiry as Unix timestamp (seconds)'),
})

async function setPolicyHandler(params: z.infer<typeof setPolicySchema>) {
  const policy: ClearancePolicy = {
    maxAmount: BigInt(params.maxAmount),
    token: params.token,
    recipient: params.recipient,
    expiresAt: params.expiresAt,
    spentAmounts: new Map<string, bigint>(),
  }
  setPolicy(policy)

  return toolSuccess({
    set: true,
    token: policy.token,
    maxAmount: policy.maxAmount.toString(),
    recipient: policy.recipient ?? null,
    expiresAt: policy.expiresAt ?? null,
  })
}

const getPolicySchema = z.object({})

async function getPolicyHandler(_params: z.infer<typeof getPolicySchema>) {
  const policy = getPolicy()
  if (!policy) {
    return toolSuccess({ exists: false })
  }

  const spentEntries: Record<string, string> = {}
  for (const [k, v] of policy.spentAmounts) {
    spentEntries[k] = v.toString()
  }

  return toolSuccess({
    exists: true,
    token: policy.token,
    maxAmount: policy.maxAmount.toString(),
    recipient: policy.recipient ?? null,
    expiresAt: policy.expiresAt ?? null,
    spentAmounts: spentEntries,
    remaining: (policy.maxAmount - (policy.spentAmounts.get(policy.token.toUpperCase()) ?? 0n)).toString(),
  })
}

const deletePolicySchema = z.object({})

async function deletePolicyHandler(_params: z.infer<typeof deletePolicySchema>) {
  const existed = getPolicy() !== null
  clearPolicy()
  return toolSuccess({ deleted: existed })
}

export const setPolicyTool = {
  name: 'set_policy' as const,
  description: 'Create or replace the clearance policy with fresh spend tracking',
  schema: setPolicySchema,
  handler: setPolicyHandler,
}

export const getPolicyTool = {
  name: 'get_policy' as const,
  description: 'Get the current clearance policy including spend amounts and remaining budget',
  schema: getPolicySchema,
  handler: getPolicyHandler,
}

export const deletePolicyTool = {
  name: 'delete_policy' as const,
  description: 'Delete the current clearance policy',
  schema: deletePolicySchema,
  handler: deletePolicyHandler,
}
