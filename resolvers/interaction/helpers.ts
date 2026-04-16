type InteractionLike = Record<string, any> & {
  type?: string | null
  status?: string | null
  outcome?: string | null
}

export function normalizeContractInteraction<T extends InteractionLike | null | undefined>(
  value: T,
): T {
  if (!value || value.type !== 'Contract' || value.status !== 'Scheduled') {
    return value
  }

  return {
    ...value,
    status: 'Completed',
    outcome: value.outcome ?? 'ClosedWon',
  } as T
}
