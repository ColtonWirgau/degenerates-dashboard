/**
 * Utilities for managing the last visited league in localStorage
 */

const LAST_LEAGUE_KEY = 'degenerates_last_league_id'

export function saveLastLeague(leagueId: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LAST_LEAGUE_KEY, leagueId)
    } catch (error) {
      console.error('Failed to save last league to localStorage:', error)
    }
  }
}

export function getLastLeague(): string | null {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem(LAST_LEAGUE_KEY)
    } catch (error) {
      console.error('Failed to get last league from localStorage:', error)
      return null
    }
  }
  return null
}

export function clearLastLeague(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(LAST_LEAGUE_KEY)
    } catch (error) {
      console.error('Failed to clear last league from localStorage:', error)
    }
  }
}
