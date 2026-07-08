import { cookies } from 'next/headers'
import { SCENARIOS, DEFAULT_SCENARIO_ID } from '@/lib/data/scenarios'
import { SCENARIO_COOKIE } from '@/lib/data/active-scenario'
import { MOCK_USER_COOKIE, getMockUserOptions } from '@/lib/data/auth-bridge'
import { DEV_PHASE_COOKIE } from '@/lib/data/dev-now'

export type DevSeasonPhase =
  | 'auto'
  | 'offseason'
  | 'preseason'
  | 'regular-season'
  | 'playoffs'
  | 'super-bowl'

export const DEV_SEASON_PHASES: Array<{ id: DevSeasonPhase; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'offseason', label: 'Offseason' },
  { id: 'preseason', label: 'Preseason' },
  { id: 'regular-season', label: 'In Season' },
  { id: 'playoffs', label: 'Playoffs' },
  { id: 'super-bowl', label: 'Super Bowl' },
]

export interface DevPhaseData {
  phases: Array<{ id: DevSeasonPhase; label: string }>
  active: DevSeasonPhase
}

/**
 * Neon-mode dev control: which season phase the UI is previewing via the
 * time-travel cookie. Null outside `next dev` or when running mock (mock
 * mode already has the scenario picker).
 */
export async function getDevPhaseData(): Promise<DevPhaseData | null> {
  if (process.env.NODE_ENV !== 'development') return null
  if ((process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'mock') !== 'neon') return null
  const c = await cookies()
  const active = (c.get(DEV_PHASE_COOKIE)?.value ?? 'auto') as DevSeasonPhase
  return { phases: DEV_SEASON_PHASES, active }
}

export interface DevToolbarData {
  scenarios: Array<{ id: string; name: string; hint: string }>
  activeScenarioId: string
  users: Array<{ id: string; fullName: string | null; email: string }>
  activeUserId: string | null
}

/**
 * Server-side reader for the mock dev toolbar. Returns null when running
 * against a real backend (NEXT_PUBLIC_DATA_SOURCE !== 'mock'), so callers
 * can hide the toolbar surface entirely outside dev/mock.
 */
export async function getDevToolbarData(): Promise<DevToolbarData | null> {
  if ((process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'mock') !== 'mock') return null

  const c = await cookies()
  const activeScenarioId = c.get(SCENARIO_COOKIE)?.value ?? DEFAULT_SCENARIO_ID
  const activeUserId = c.get(MOCK_USER_COOKIE)?.value ?? null

  return {
    scenarios: SCENARIOS.map((s) => ({ id: s.id, name: s.name, hint: s.hint })),
    activeScenarioId,
    users: getMockUserOptions().map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
    })),
    activeUserId,
  }
}
