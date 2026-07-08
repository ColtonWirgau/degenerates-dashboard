'use client'

// Browser-side Ably Realtime client. Singleton — one connection per tab,
// shared across all subscriptions. Token auth is delegated to
// /api/ably/token so we never leak the root API key to the browser.
//
// Usage in a React component:
//
//   const client = getAblyClient()
//   useEffect(() => {
//     const channel = client.channels.get(channelName.polls(leagueId))
//     const listener = (msg) => { /* update local state */ }
//     channel.subscribe(event.pollVoteCast, listener)
//     return () => { channel.unsubscribe(event.pollVoteCast, listener) }
//   }, [leagueId])

import * as Ably from 'ably'

let _client: Ably.Realtime | null = null

export function getAblyClient(): Ably.Realtime {
  if (_client) return _client
  _client = new Ably.Realtime({
    // Server endpoint signs scoped capability tokens — see
    // app/api/ably/token/route.ts. Auth.js cookie comes along for free.
    authUrl: '/api/ably/token',
    authMethod: 'POST',
    autoConnect: true,
    // Auto-reconnect with backoff is built into the SDK — defaults are fine
  })
  return _client
}

/**
 * Close the singleton connection. Rarely needed (the tab going away
 * already cleans up), but exposed for tests.
 */
export function disconnectAblyClient(): void {
  if (_client) {
    _client.close()
    _client = null
  }
}
