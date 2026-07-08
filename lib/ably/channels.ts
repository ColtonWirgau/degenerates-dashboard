// Channel name helpers — one source of truth so server publishes and
// client subscribes never drift. Match the design in PLAN.md B5.

export const channelName = {
  /** Poll vote tallies + option add/promote/react for a league. */
  polls: (leagueId: string) => `league:${leagueId}:polls`,
  /** Charter proposals + approvals + lock transitions for a league. */
  charter: (leagueId: string) => `league:${leagueId}:charter`,
  /** Leg submissions / locks / results for a specific parlay. */
  parlayLegs: (leagueId: string, parlayId: string) =>
    `league:${leagueId}:parlay:${parlayId}:legs`,
  /** Member joins, role changes — rare but worth pushing. */
  roster: (leagueId: string) => `league:${leagueId}:roster`,
  /** League settings (slate config, lock offset) — pushes refreshes when
   *  the commish changes them so other tabs re-render lock times. */
  settings: (leagueId: string) => `league:${leagueId}:settings`,
  /** Live NFL game state — score updates, kickoff, final. League-agnostic. */
  weekGames: (globalWeekId: string) => `nfl:games:week:${globalWeekId}`,
} as const

// Event names within each channel. Keep these stable; clients filter by event.
export const event = {
  // Polls
  pollVoteCast: 'poll-vote-cast',
  pollOptionAdded: 'poll-option-added',
  pollOptionPromoted: 'poll-option-promoted',
  pollOptionReacted: 'poll-option-reacted',
  pollStatusChanged: 'poll-status-changed',
  // Charter
  charterEntryProposed: 'charter-entry-proposed',
  charterEntryApproved: 'charter-entry-approved',
  charterEntryLocked: 'charter-entry-locked',
  // Parlay
  legSubmitted: 'leg-submitted',
  legDeleted: 'leg-deleted',
  legResultSet: 'leg-result-set',
  // Roster
  memberJoined: 'member-joined',
  memberRoleChanged: 'member-role-changed',
  // Settings
  settingsUpdated: 'settings-updated',
  lockAtRecomputed: 'lock-at-recomputed',
  // NFL games
  gameKickedOff: 'game-kicked-off',
  gameScoreUpdated: 'game-score-updated',
  gameFinal: 'game-final',
} as const
