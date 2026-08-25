// The small shared vocabulary of voting — the shapes and name-formatting
// that both the preseason ballot and a week's own question need, kept out
// of either so neither owns it.

import type { RankedSelection } from '@/lib/data/mock-polls'

export interface PollMember {
  id: string
  fullName: string | null
  email: string
  avatarUrl: string | null
}

/**
 * The viewer's answer, held in session on top of whatever the server last
 * said. Writes go out to the action immediately; this is what makes the
 * bar move on the same frame as the tap rather than a round trip later.
 *
 * An EMPTY object is meaningful: it's "I withdrew my vote", and it has to
 * beat the server's still-present response until the refresh lands.
 */
export type SessionVote = {
  choiceId?: string
  choiceIds?: string[]
  text?: string
  rankings?: RankedSelection[]
}

export function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

export function displayNameOf(
  member: PollMember | undefined,
  fallbackId: string
): string {
  if (!member) return fallbackId.slice(0, 6)
  return member.fullName ?? member.email.split('@')[0]
}

/**
 * Has the viewer actually answered? Skipped polls read false even after
 * the viewer has scrolled past them — "seen" is not "answered".
 */
export function hasAnyAnswer(v: SessionVote | null): boolean {
  if (!v) return false
  if (v.choiceId) return true
  if (v.choiceIds && v.choiceIds.length > 0) return true
  if (v.text && v.text.trim().length > 0) return true
  if (v.rankings && v.rankings.length > 0) return true
  return false
}

/**
 * The viewer's answer to one poll: their session overlay if they've
 * touched it, otherwise whatever the server has on file.
 */
export function viewerVoteFor(
  poll: LeaguePollLike | null,
  sessionVotes: Map<string, SessionVote>,
  currentUserId: string
): SessionVote | null {
  if (!poll) return null
  // `has`, not a truthiness check: a CLEARED vote is stored as `{}`, and
  // it has to beat the server's still-present response until the refresh
  // lands. Falling through to the fixture there would put the withdrawn
  // vote straight back on screen.
  if (sessionVotes.has(poll.id)) return sessionVotes.get(poll.id) ?? null
  const fixture = poll.responses.find((r) => r.userId === currentUserId)
  if (!fixture) return null
  return {
    choiceId: fixture.choiceId ?? undefined,
    choiceIds: fixture.choiceIds ?? undefined,
    text: fixture.text ?? undefined,
    rankings: fixture.rankings ?? undefined,
  }
}

/** Just enough of a poll to find the viewer's response in it. */
type LeaguePollLike = {
  id: string
  responses: Array<{
    userId: string
    choiceId?: string | null
    choiceIds?: string[] | null
    text?: string | null
    rankings?: RankedSelection[] | null
  }>
}
