// Server-side Ably client. Used by Server Actions to publish events
// after writes. Uses the REST client (not Realtime) — we just need to
// fire-and-forget into a channel.
//
// All publishes are non-blocking and best-effort: a failure here must
// not break the underlying mutation. We swallow errors and log a
// warning so the polling fallback can still catch up the client.

import * as Ably from 'ably'

let _restClient: Ably.Rest | null = null

function getClient(): Ably.Rest | null {
  if (_restClient) return _restClient
  const key = process.env.ABLY_API_KEY
  if (!key) {
    // No key → silently no-op. Useful in dev / mock mode where Ably
    // isn't configured yet, and in tests.
    return null
  }
  _restClient = new Ably.Rest({ key })
  return _restClient
}

/**
 * Publish a message to an Ably channel. Best-effort, non-blocking.
 * Returns `true` if the message was queued for publish, `false` if Ably
 * isn't configured (in which case clients still get updates via the
 * TanStack Query polling fallback).
 */
export async function publish(
  channel: string,
  event: string,
  data: unknown
): Promise<boolean> {
  const client = getClient()
  if (!client) return false
  try {
    await client.channels.get(channel).publish(event, data)
    return true
  } catch (err) {
    // Ably outage / network blip — log and move on. Polling backfills.
    console.warn(`[ably] publish failed on ${channel}/${event}:`, err)
    return false
  }
}
