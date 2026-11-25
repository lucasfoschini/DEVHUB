import { useSyncExternalStore } from 'react'
import { breakpoints } from '@devhub/design-tokens'

/** Window size class. Drives which shell layout is used (see docs/design/APPLICATION_SHELL.md). */
export type Tier = 'compact' | 'medium' | 'expanded' | 'large'

const order = ['large', 'expanded', 'medium'] as const
const queries = order.map((t) => matchMedia(`(min-width: ${breakpoints[t]}px)`))

function getTier(): Tier {
  const i = queries.findIndex((q) => q.matches)
  return i === -1 ? 'compact' : order[i]!
}

function subscribe(onChange: () => void) {
  queries.forEach((q) => q.addEventListener('change', onChange))
  return () => queries.forEach((q) => q.removeEventListener('change', onChange))
}

export const useTier = () => useSyncExternalStore(subscribe, getTier)
