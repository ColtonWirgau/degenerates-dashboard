/**
 * WHICH DATA THE APP IS SERVING, decided in one place.
 *
 * This lived as `process.env.NEXT_PUBLIC_DATA_SOURCE ?? 'mock'` copied
 * into four files, and the default was the dangerous half: one missing
 * environment variable on the host and the deployed app quietly served
 * a FABRICATED league to real people. Invented members, invented legs
 * out of leg-library, invented standings, and nothing on screen saying
 * so. The three call sites that read `=== 'neon'` would each have
 * silently skipped the real schedule and the real ballot too.
 *
 * So: real unless you explicitly ask for mock, in exactly one function.
 * A typo in the env var now yields the truth, which is the only safe
 * direction for that mistake to fall.
 */
export type DataSource = 'neon' | 'mock'

export function dataSource(): DataSource {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === 'mock' ? 'mock' : 'neon'
}

/** The demo/dev store. Never true on a deployment unless someone asked. */
export function isMockData(): boolean {
  return dataSource() === 'mock'
}
