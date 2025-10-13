/**
 * Season utility functions
 * Automatically determines the current season based on the date
 */

export interface Season {
  id: string // e.g., "2025-2026"
  displayName: string // e.g., "2025-2026 Season"
  startYear: number
  endYear: number
}

/**
 * Get the current season based on today's date
 * NFL/NBA style seasons that span two calendar years
 * Season starts in August and ends in July of the following year
 */
export function getCurrentSeason(): Season {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-12

  // If we're in Aug-Dec, the season is currentYear-nextYear
  // If we're in Jan-Jul, the season is previousYear-currentYear
  const startYear = currentMonth >= 8 ? currentYear : currentYear - 1
  const endYear = startYear + 1

  const id = `${startYear}-${endYear}`

  return {
    id,
    displayName: `${startYear}-${endYear} Season`,
    startYear,
    endYear,
  }
}

/**
 * Get a list of available seasons (current + past few years)
 */
export function getAvailableSeasons(yearsBack: number = 3): Season[] {
  const current = getCurrentSeason()
  const seasons: Season[] = []

  for (let i = 0; i < yearsBack + 1; i++) {
    const startYear = current.startYear - i
    const endYear = startYear + 1
    const id = `${startYear}-${endYear}`

    seasons.push({
      id,
      displayName: `${startYear}-${endYear} Season`,
      startYear,
      endYear,
    })
  }

  return seasons
}

/**
 * Parse a season ID into a Season object
 */
export function parseSeason(seasonId: string): Season | null {
  const match = seasonId.match(/^(\d{4})-(\d{4})$/)

  if (!match) {
    return null
  }

  const startYear = parseInt(match[1])
  const endYear = parseInt(match[2])

  return {
    id: seasonId,
    displayName: `${startYear}-${endYear} Season`,
    startYear,
    endYear,
  }
}

/**
 * Format season for display
 */
export function formatSeason(seasonId: string): string {
  const season = parseSeason(seasonId)
  return season ? season.displayName : seasonId
}
