// Server-side helper to read the active scenario from cookies. Mirrors
// what mock-adapter does internally — exposed here so other server-side
// code (server actions, server components) can know "what time is it" in
// mock mode without importing the mock adapter directly.

import { cookies } from 'next/headers';
import { type Scenario, getScenario, DEFAULT_SCENARIO_ID } from './scenarios';

export const SCENARIO_COOKIE = 'degens_scenario';

export async function getActiveScenario(): Promise<Scenario> {
  try {
    const c = await cookies();
    const id = c.get(SCENARIO_COOKIE)?.value;
    return getScenario(id ?? DEFAULT_SCENARIO_ID);
  } catch {
    return getScenario(DEFAULT_SCENARIO_ID);
  }
}
