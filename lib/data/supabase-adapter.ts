// Supabase DataAdapter implementation. Intentionally stubbed during the
// mock-first UI iteration phase — flip NEXT_PUBLIC_DATA_SOURCE=supabase to
// re-enable, and at that point fill in each method by porting the existing
// queries from app/actions/*.ts into this file.
//
// When we cut over to Neon, this file gets replaced (or sits alongside) a
// `neon-adapter.ts` of the same shape.

import type { DataAdapter } from './adapter';

const NOT_IMPLEMENTED = (method: string) => () => {
  throw new Error(
    `supabase-adapter.${method}() not implemented yet. ` +
    `We're in mock-first mode — set NEXT_PUBLIC_DATA_SOURCE=mock or implement this.`
  );
};

export const supabaseAdapter: DataAdapter = {
  getLeaguesForUser: NOT_IMPLEMENTED('getLeaguesForUser'),
  getLeague: NOT_IMPLEMENTED('getLeague'),
  getLeagueMembers: NOT_IMPLEMENTED('getLeagueMembers'),
  getUserRole: NOT_IMPLEMENTED('getUserRole'),
  getWeeksForSeason: NOT_IMPLEMENTED('getWeeksForSeason'),
  getCurrentWeek: NOT_IMPLEMENTED('getCurrentWeek'),
  getSeasonState: NOT_IMPLEMENTED('getSeasonState'),
  getWeekParlay: NOT_IMPLEMENTED('getWeekParlay'),
  getParlay: NOT_IMPLEMENTED('getParlay'),
  getLeagueParlays: NOT_IMPLEMENTED('getLeagueParlays'),
  getLeaderboard: NOT_IMPLEMENTED('getLeaderboard'),
  getUserStats: NOT_IMPLEMENTED('getUserStats'),
  submitLeg: NOT_IMPLEMENTED('submitLeg'),
  deleteLeg: NOT_IMPLEMENTED('deleteLeg'),
  updateLegResult: NOT_IMPLEMENTED('updateLegResult'),
  getCharter: NOT_IMPLEMENTED('getCharter'),
  seedCharterForLeague: NOT_IMPLEMENTED('seedCharterForLeague'),
  seedPollsForLeague: NOT_IMPLEMENTED('seedPollsForLeague'),
  proposeCharterEntry: NOT_IMPLEMENTED('proposeCharterEntry'),
  approveCharterEntry: NOT_IMPLEMENTED('approveCharterEntry'),
  createCharterEntry: NOT_IMPLEMENTED('createCharterEntry'),
  getPolls: NOT_IMPLEMENTED('getPolls'),
  getPoll: NOT_IMPLEMENTED('getPoll'),
  submitPollResponse: NOT_IMPLEMENTED('submitPollResponse'),
  addPollOption: NOT_IMPLEMENTED('addPollOption'),
  reactToPollOption: NOT_IMPLEMENTED('reactToPollOption'),
  createPoll: NOT_IMPLEMENTED('createPoll'),
  promotePollOption: NOT_IMPLEMENTED('promotePollOption'),
  closePoll: NOT_IMPLEMENTED('closePoll'),
  reopenPoll: NOT_IMPLEMENTED('reopenPoll'),
  archivePoll: NOT_IMPLEMENTED('archivePoll'),
};
