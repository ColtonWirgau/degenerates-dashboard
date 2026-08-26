// Auth bridge — resolves "who is the current user" in either supported mode:
//   • mock — dev-toolbar cookie names a fixture user (fallback to first)
//   • neon — Auth.js v5 session (`auth()` from auth.ts) is the truth
//
// Returns null when nobody's signed in and we can't infer.

import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { dataSource } from './data-source';
import rawProfiles from './fixtures/user_profiles.json';
import rawMembers from './fixtures/league_members.json';

export const MOCK_USER_COOKIE = 'degens_mock_user';

interface RawProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}
interface RawMember {
  user_id: string;
  league_id: string;
  role: string;
}

const PROFILES = rawProfiles as RawProfile[];
const MEMBERS = rawMembers as RawMember[];

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
}

const profileToCurrent = (p: RawProfile): CurrentUser => ({
  id: p.id,
  email: p.email,
  fullName: p.full_name,
  avatarUrl: p.avatar_url,
});

/** Returns the active user, or null if nobody is logged in (and we can't
 *  infer one from the dev toolbar). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const source = dataSource();

  if (source === 'mock') {
    const c = await cookies();
    const requestedId = c.get(MOCK_USER_COOKIE)?.value;
    if (requestedId) {
      const profile = PROFILES.find((p) => p.id === requestedId);
      if (profile) return profileToCurrent(profile);
    }
    // Fallback: first member of the first fixture league with a known profile.
    // This makes "just open localhost and stuff renders" actually work
    // without setup.
    for (const member of MEMBERS) {
      const profile = PROFILES.find((p) => p.id === member.user_id);
      if (profile) return profileToCurrent(profile);
    }
    // Last fallback: first profile.
    return PROFILES[0] ? profileToCurrent(PROFILES[0]) : null;
  }

  // Default (and only non-mock) path: Auth.js v5.
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    fullName: session.user.name ?? null,
    avatarUrl: session.user.image ?? null,
  };
}

/** All fixture profiles — exposed for the dev toolbar's "I am ___" picker. */
export function getMockUserOptions(): CurrentUser[] {
  return PROFILES.map(profileToCurrent);
}
