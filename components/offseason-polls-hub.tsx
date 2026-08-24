'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  submitPollVote,
  addPollOption as addPollOptionAction,
  reactToPollOption as reactToPollOptionAction,
} from '@/app/actions/polls'
import { approveCharter, createCharter } from '@/app/actions/charter'
import { getAblyClient } from '@/lib/ably/client'
import { channelName } from '@/lib/ably/channels'
import {
  Check,
  ChevronRight,
  Circle,
  Crown,
  DollarSign,
  Hammer,
  Repeat,
  Trophy,
  Hourglass,
  Layers,
  Lock,
  ScrollText,
  Skull,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Vote,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionHeader } from '@/components/ui/section-header'
import {
  ResponsiveSheet,
  SheetPage,
  useResponsiveSheet,
} from '@/components/ui/responsive-sheet'
import type {
  LeaguePoll,
  PollOption,
  PollOptionPolicy,
  RankedSelection,
} from '@/lib/data/mock-polls'
import type {
  CharterEntry,
  CharterApprovalRule,
  CharterCategory,
  CharterStatus,
  KeeperRosterRow,
} from '@/lib/data/mock-charter'
import type { SeasonState } from '@/lib/data/types'

export interface PollMember {
  id: string
  fullName: string | null
  email: string
  avatarUrl: string | null
}

interface OffseasonPollsHubProps {
  /** League id — needed so write handlers can target the right channels
   *  + revalidate the right cache path. */
  leagueId: string
  polls: LeaguePoll[]
  charter: CharterEntry[]
  seasonState: SeasonState
  currentUserId: string
  /** Total league member count — used as denominator for participation. */
  membersCount: number
  /** Roster — drives avatars on chart bars and open-text responses. */
  members: PollMember[]
}

// In-session vote overlay. Keys are poll IDs. Each entry replaces the
// viewer's existing response in the merged view.
type SessionVote = {
  choiceId?: string
  choiceIds?: string[]
  text?: string
  rankings?: RankedSelection[]
}

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function displayNameOf(member: PollMember | undefined, fallbackId: string): string {
  if (!member) return fallbackId.slice(0, 6)
  return member.fullName ?? member.email.split('@')[0]
}

// Has the viewer provided any answer for this poll (any of the three
// kinds)? Skipped polls return false even after the viewer navigated
// past them.
function hasAnyAnswer(v: SessionVote | null): boolean {
  if (!v) return false
  if (v.choiceId) return true
  if (v.choiceIds && v.choiceIds.length > 0) return true
  if (v.text && v.text.trim().length > 0) return true
  if (v.rankings && v.rankings.length > 0) return true
  return false
}

// Ranked-choice tally — plurality-weighted (3 pts for 1st, 2 for 2nd, 1
// for 3rd). Same shape regardless of `maxRanks`; we just slice the
// `RANK_POINTS` table.
const RANK_POINTS: Record<number, number> = { 1: 3, 2: 2, 3: 1, 4: 0.5, 5: 0.25 }

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// ─── Hub ────────────────────────────────────────────────────────────────────

/**
 * Off-/preseason dual-dock — paired top + bottom dock that swap out the
 * in-season parlay flow for league-business polls. Shares vote state in
 * React (mock-only) so changes made in the bottom dock instantly reflect
 * in the top dock's aggregate. Server-persisted votes land with the
 * Phase C polls schema.
 */
export function OffseasonPollsHub({
  leagueId,
  polls,
  charter,
  seasonState,
  currentUserId,
  membersCount,
  members,
}: OffseasonPollsHubProps) {
  void seasonState
  void membersCount
  const membersById = useMemo(() => {
    const m = new Map<string, PollMember>()
    for (const member of members) m.set(member.id, member)
    return m
  }, [members])
  const [sessionVotes, setSessionVotes] = useState<Map<string, SessionVote>>(
    () => new Map()
  )

  // Initial bottom-dock position: first open poll the viewer hasn't
  // Recording a vote — overlays the viewer's session pick on top of
  // any fixture response so the UI feels instant. In neon mode we also
  // fire the server action (revalidates + publishes to Ably so other
  // members see the new tally in real time).
  const router = useRouter()
  const recordVote = (pollId: string, vote: SessionVote) => {
    setSessionVotes((prev) => {
      const next = new Map(prev)
      next.set(pollId, vote)
      return next
    })
    // Translate session-overlay shape → server action payload. An empty
    // vote withdraws the member's response entirely.
    if (vote.choiceId) {
      void submitPollVote(leagueId, pollId, { choiceId: vote.choiceId })
    } else if (vote.choiceIds && vote.choiceIds.length > 0) {
      void submitPollVote(leagueId, pollId, { choiceIds: vote.choiceIds })
    } else if (vote.rankings && vote.rankings.length > 0) {
      void submitPollVote(leagueId, pollId, { rankings: vote.rankings })
    } else {
      void submitPollVote(leagueId, pollId, { clear: true })
    }
  }

  // Session overlay for poll-option up/down reactions (pending options
  // only). Keyed by `${pollId}::${optionId}`.
  const [sessionOptionReactions, setSessionOptionReactions] = useState<
    Map<string, 1 | -1 | null>
  >(() => new Map())
  const setOptionReaction = (
    pollId: string,
    optionId: string,
    value: 1 | -1 | null
  ) => {
    const key = `${pollId}::${optionId}`
    setSessionOptionReactions((prev) => {
      const next = new Map(prev)
      next.set(key, value)
      return next
    })
    void reactToPollOptionAction(leagueId, pollId, optionId, value)
  }

  // Session overlay for member-added options. Keyed by pollId — array of
  // options the viewer has added this session. They appear in the poll's
  // pending lane (for curated) or approved lane (for open). Mock — no
  // server persistence until the schema lands.
  const [sessionAddedOptions, setSessionAddedOptions] = useState<
    Map<string, PollOption[]>
  >(() => new Map())
  const addOption = (pollId: string, label: string, policy: PollOptionPolicy) => {
    const text = label.trim()
    if (!text) return
    const newOption: PollOption = {
      id: `viewer::${pollId}::${Date.now()}`,
      label: text,
      addedBy: currentUserId,
      addedAt: new Date().toISOString(),
      status: policy === 'open' ? 'approved' : 'pending',
      reactions: [],
    }
    setSessionAddedOptions((prev) => {
      const next = new Map(prev)
      next.set(pollId, [...(next.get(pollId) ?? []), newOption])
      return next
    })
    void addPollOptionAction(leagueId, pollId, text)
  }

  // Lifted approvals state — shared between SeasonSetup's inline UI and
  // the BottomDock action queue so an approval done in one surface
  // removes the action from the other.
  const [approvals, setApprovals] = useState<Map<string, boolean>>(() => new Map())
  const approveEntry = (entryId: string) => {
    setApprovals((prev) => {
      const next = new Map(prev)
      next.set(entryId, true)
      return next
    })
    void approveCharter(leagueId, entryId, true)
  }

  // Real-time refresh — when another member votes / reacts / approves
  // anywhere in this league, Ably pushes the event and we re-fetch the
  // server data. Optimistic local state stays in place between the push
  // and the next render so there's no visual flicker.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DATA_SOURCE !== 'neon') return
    let client: ReturnType<typeof getAblyClient> | null = null
    try {
      client = getAblyClient()
    } catch {
      return
    }
    const pollsCh = client.channels.get(channelName.polls(leagueId))
    const charterCh = client.channels.get(channelName.charter(leagueId))
    const onAny = () => router.refresh()
    pollsCh.subscribe(onAny)
    charterCh.subscribe(onAny)
    return () => {
      pollsCh.unsubscribe(onAny)
      charterCh.unsubscribe(onAny)
    }
  }, [leagueId, router])

  return (
    <SeasonSetup
      leagueId={leagueId}
      charter={charter}
      polls={polls}
      membersById={membersById}
      membersCount={membersCount}
      currentUserId={currentUserId}
      season={charter[0]?.season ?? ''}
      sessionPollVotes={sessionVotes}
      onPollVote={recordVote}
      sessionOptionReactions={sessionOptionReactions}
      onOptionReaction={setOptionReaction}
      sessionAddedOptions={sessionAddedOptions}
      onAddOption={addOption}
      approvals={approvals}
      onApprove={approveEntry}
    />
  )
}

// ─── Top dock (poll results aggregate) ──────────────────────────────────────

// ─── SectionDock helpers ────────────────────────────────────────────────────

// ─── Season Setup section (Charter) ───────────────────────────────────────
//
// Charter entries grouped by functional topic (Draft, Stakes, etc.).
// Status is conveyed by per-row color + icon rather than by ordering.

type EntryGroup =
  | 'Draft'
  | 'Stakes'
  | 'Trading'
  | 'Playoffs'
  | 'Punishment'
  | 'Rules'
  | 'Logistics'

const ENTRY_GROUP_ORDER: EntryGroup[] = [
  'Draft',
  'Stakes',
  'Trading',
  'Playoffs',
  'Punishment',
  'Rules',
  'Logistics',
]

const ENTRY_GROUP: Record<string, EntryGroup> = {
  // Draft — date, format (incl. 3rd-round-reversal mechanic), location
  // and all keeper rules (keeper machinery happens at draft, so it
  // lives here).
  'draft-date': 'Draft',
  'draft-format': 'Draft',
  'draft-location': 'Draft',
  'keeper-slots': 'Draft',
  'keeper-cost': 'Draft',
  'keeper-restrictions': 'Draft',
  'keeper-traded-pick': 'Draft',
  'keeper-deadline': 'Draft',
  'eligible-keepers': 'Draft',

  // Stakes — money in/out
  'buy-in': 'Stakes',
  payouts: 'Stakes',
  'weekly-pot': 'Stakes',
  'dues-tracking': 'Stakes',

  // Trading
  'trade-veto-policy': 'Trading',
  'collusion-process': 'Trading',
  'trade-deadline': 'Trading',

  // Playoffs
  'playoff-format': 'Playoffs',
  'regular-season-length': 'Playoffs',
  'last-place-penalty': 'Playoffs',

  // Punishment / Rules / Logistics
  punishment: 'Punishment',
  'missed-deadline': 'Rules',
  'tie-breaker': 'Rules',
  'mid-season-catchup': 'Rules',
  commissioner: 'Logistics',
  'kickoff-meet': 'Logistics',
  trophy: 'Logistics',
}

function groupFor(entry: CharterEntry): EntryGroup {
  return ENTRY_GROUP[entry.key] ?? 'Rules'
}

// Per-group card visuals. `icon` is the semantic glyph rendered large
// behind the slanted dual-color header. `palette` is the [left, right]
// pair that paints the header. Each pair is pulled from the cyberpunk
// vegas tokens so the set reads cohesive but each card stays distinct.
const GROUP_META: Record<
  EntryGroup,
  {
    icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
    palette: [string, string]
  }
> = {
  Draft: { icon: Layers, palette: ['#FF69B4', '#00D9FF'] },
  Stakes: { icon: DollarSign, palette: ['#00D9FF', '#FF69B4'] },
  Trading: { icon: Repeat, palette: ['#00D9FF', '#FF69B4'] },
  Playoffs: { icon: Trophy, palette: ['#00D9FF', '#FF69B4'] },
  Punishment: { icon: Skull, palette: ['#FF69B4', '#00D9FF'] },
  Rules: { icon: ScrollText, palette: ['#00D9FF', '#FF69B4'] },
  Logistics: { icon: Hourglass, palette: ['#FF69B4', '#00D9FF'] },
}

// 1–2-line preview shown on each group card. Prefers the first two locked
// values; falls back to a pending proposal; otherwise muted placeholder.
function groupPreview(entries: CharterEntry[]): string {
  const locked = entries.filter((e) => e.status === 'locked' && e.value)
  if (locked.length === 0) {
    const pending = entries.find((e) => e.status === 'pending' && e.pending)
    if (pending && pending.pending) return `Proposed: ${pending.pending.value}`
    return 'Nothing locked yet'
  }
  return locked
    .slice(0, 2)
    .map((e) => e.value!)
    .join(' · ')
}

const CHARTER_ICON: Record<CharterCategory, React.ComponentType<{ className?: string }>> = {
  logistics: Hourglass,
  rules: ScrollText,
  punishment: Skull,
  format: Layers,
  custom: Sparkles,
  stakes: DollarSign,
  keepers: Lock,
  trading: Repeat,
  playoffs: Trophy,
}

const APPROVAL_LABEL: Record<CharterApprovalRule, string> = {
  commish: 'Commish call',
  majority: 'Majority',
  supermajority: 'Supermajority',
  unanimous: 'Unanimous',
  poll: 'Poll vote',
}

// Bridges a Charter entry to a Suggestion category, so an entry can host
// a "Pitch an idea" affordance that feeds the suggestion pool for that
// topic. Entries with no natural suggestion mapping (logistics) skip it.
function SeasonSetup({
  leagueId,
  charter,
  polls,
  membersById,
  membersCount,
  currentUserId,
  season,
  sessionPollVotes,
  onPollVote,
  sessionOptionReactions,
  onOptionReaction,
  sessionAddedOptions,
  onAddOption,
  approvals,
  onApprove,
}: {
  leagueId: string
  charter: CharterEntry[]
  polls: LeaguePoll[]
  membersById: Map<string, PollMember>
  membersCount: number
  currentUserId: string
  season: string
  sessionPollVotes: Map<string, SessionVote>
  onPollVote: (pollId: string, vote: SessionVote) => void
  sessionOptionReactions: Map<string, 1 | -1 | null>
  onOptionReaction: (pollId: string, optionId: string, value: 1 | -1 | null) => void
  sessionAddedOptions: Map<string, PollOption[]>
  onAddOption: (pollId: string, label: string, policy: PollOptionPolicy) => void
  approvals: Map<string, boolean>
  onApprove: (entryId: string) => void
}) {
  const pollsById = useMemo(() => {
    const m = new Map<string, LeaguePoll>()
    for (const p of polls) m.set(p.id, p)
    return m
  }, [polls])

  const byGroup = useMemo(() => {
    const m = new Map<EntryGroup, CharterEntry[]>()
    for (const g of ENTRY_GROUP_ORDER) m.set(g, [])
    for (const e of charter) {
      // User-added entries render in their own named groups below.
      if (e.category === 'custom') continue
      const arr = m.get(groupFor(e))
      if (arr) arr.push(e)
    }
    return m
  }, [charter])

  // User-added groups + entries. The server truth is charter entries with
  // category 'custom' carrying their group name in metadata.group; local
  // state holds just-created empty groups and optimistic entries until the
  // refresh brings the real rows back.
  const router = useRouter()
  const [localGroups, setLocalGroups] = useState<CustomGroupState[]>([])
  const [customError, setCustomError] = useState<string | null>(null)

  const serverCustomGroups = useMemo(() => {
    const m = new Map<string, CharterEntry[]>()
    for (const e of charter) {
      if (e.category !== 'custom') continue
      const g = e.metadata?.group ?? 'Custom'
      const arr = m.get(g) ?? []
      arr.push(e)
      m.set(g, arr)
    }
    return m
  }, [charter])

  const customGroups: CustomGroupState[] = useMemo(() => {
    const out: CustomGroupState[] = []
    const seen = new Set<string>()
    for (const [name, entries] of serverCustomGroups) {
      const local = localGroups.find(
        (g) => g.name.toLowerCase() === name.toLowerCase()
      )
      // Optimistic entries drop out once the server row with the same key
      // arrives via refresh.
      const extra =
        local?.entries.filter((le) => !entries.some((se) => se.key === le.key)) ?? []
      out.push({ name, entries: [...entries, ...extra] })
      seen.add(name.toLowerCase())
    }
    for (const g of localGroups) {
      if (!seen.has(g.name.toLowerCase())) out.push(g)
    }
    return out
  }, [serverCustomGroups, localGroups])

  const addCustomGroup = (name: string) => {
    setLocalGroups((prev) => {
      if (
        prev.some((g) => g.name.toLowerCase() === name.toLowerCase()) ||
        [...serverCustomGroups.keys()].some(
          (n) => n.toLowerCase() === name.toLowerCase()
        )
      ) {
        return prev
      }
      return [...prev, { name, entries: [] }]
    })
  }

  const addCustomEntry = (
    groupName: string,
    label: string,
    rule: CharterApprovalRule
  ) => {
    setCustomError(null)
    const entry = makeCustomEntry(groupName, label, rule, season)
    // Optimistic: show it immediately; the server row (same key) replaces
    // it on refresh.
    setLocalGroups((prev) => {
      const existing = prev.find((g) => g.name.toLowerCase() === groupName.toLowerCase())
      if (existing) {
        return prev.map((g) =>
          g.name.toLowerCase() === groupName.toLowerCase()
            ? { ...g, entries: [...g.entries, entry] }
            : g
        )
      }
      return [...prev, { name: groupName, entries: [entry] }]
    })
    void createCharter({
      leagueId,
      season,
      key: entry.key,
      label,
      category: 'custom',
      approvalRule: rule,
      threshold: rule === 'supermajority' ? 0.75 : undefined,
      metadata: { group: groupName },
    }).then((res) => {
      if (res.error) {
        // Roll the optimistic entry back and say why.
        setLocalGroups((prev) =>
          prev.map((g) => ({
            ...g,
            entries: g.entries.filter((e) => e.key !== entry.key),
          }))
        )
        setCustomError(res.error)
      } else {
        router.refresh()
      }
    })
  }

  // Which group's sheet is open (built-in or custom). Null = list view
  // only. `entryId` deep-links the sheet straight to that entry's page —
  // tapping "Location" on the main page lands on Location, with Back
  // returning to the group list.
  const [openGroup, setOpenGroup] = useState<
    | { kind: 'builtin'; group: EntryGroup; entryId?: string }
    | { kind: 'custom'; name: string; entryId?: string }
    | null
  >(null)


  // Resolve the entries + sheet header info for whatever group is open.
  const sheetData = (() => {
    if (!openGroup) return null
    if (openGroup.kind === 'builtin') {
      const entries = byGroup.get(openGroup.group) ?? []
      return {
        name: openGroup.group as string,
        icon: GROUP_META[openGroup.group].icon,
        entries,
        onAddCustomEntry: null as
          | ((label: string, rule: CharterApprovalRule) => void)
          | null,
      }
    }
    const cg = customGroups.find((g) => g.name === openGroup.name)
    if (!cg) return null
    return {
      name: cg.name,
      icon: Sparkles,
      entries: cg.entries,
      onAddCustomEntry: (label: string, rule: CharterApprovalRule) =>
        addCustomEntry(cg.name, label, rule),
    }
  })()

  return (
    <section className="mt-10 sm:mt-12">
      <SectionHeader
        kicker={season || 'This Season'}
        title="Season Setup"
        icon={Crown}
        accent="blue"
      />

      {/* One panel per category — a prominent clickable header bar
          (opens the group's sheet summary) over a quiet list of charter
          rows. Rows with a live poll carry a small pink voting accent;
          the header aggregates what still needs the viewer. */}
      {ENTRY_GROUP_ORDER.map((group) => {
        const entries = byGroup.get(group) ?? []
        if (entries.length === 0) return null
        const lockedInGroup = entries.filter(
          (e) => e.status === 'locked'
        ).length
        return (
          <div
            key={group}
            className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
          >
            <GroupHeaderRow
              name={group}
              icon={GROUP_META[group].icon}
              lockedCount={lockedInGroup}
              total={entries.length}
              onOpen={() => setOpenGroup({ kind: 'builtin', group })}
            />
            <ul className="divide-y divide-white/5">
              {entries.map((entry) => {
                const poll = entry.pollId
                  ? pollsById.get(entry.pollId) ?? null
                  : null
                return (
                  <CharterRow
                    key={entry.id}
                    entry={entry}
                    poll={poll}
                    myVote={viewerVoteFor(poll, sessionPollVotes, currentUserId)}
                    onOpen={() =>
                      setOpenGroup({
                        kind: 'builtin',
                        group,
                        entryId: entry.id,
                      })
                    }
                  />
                )
              })}
            </ul>
          </div>
        )
      })}

      {/* Custom user-added groups — same panel pattern. */}
      {customGroups.map((cg) => (
        <div
          key={cg.name}
          className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
        >
          <GroupHeaderRow
            name={cg.name}
            icon={Sparkles}
            lockedCount={cg.entries.filter((e) => e.status === 'locked').length}
            total={cg.entries.length}
            onOpen={() => setOpenGroup({ kind: 'custom', name: cg.name })}
          />
          {cg.entries.length === 0 ? (
            <button
              type="button"
              onClick={() => setOpenGroup({ kind: 'custom', name: cg.name })}
              className="w-full px-3.5 py-3 text-left text-[11px] italic text-muted-foreground hover:bg-white/[0.03] transition-colors"
            >
              Nothing here yet — tap to add the first item.
            </button>
          ) : (
            <ul className="divide-y divide-white/5">
              {cg.entries.map((entry) => (
                <CharterRow
                  key={entry.id}
                  entry={entry}
                  poll={null}
                  onOpen={() =>
                    setOpenGroup({
                      kind: 'custom',
                      name: cg.name,
                      entryId: entry.id,
                    })
                  }
                />
              ))}
            </ul>
          )}
        </div>
      ))}

      {customError && (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {customError}
        </p>
      )}

      {/* Add-a-topic affordance — lives at the very bottom now that
          the masonry is gone. */}
      <div>
        <AddTopicCard onAdd={addCustomGroup} />
      </div>

      {sheetData && (
        <GroupSheet
          open={openGroup !== null}
          onClose={() => setOpenGroup(null)}
          defaultEntryId={openGroup?.entryId ?? null}
          groupName={sheetData.name}
          icon={sheetData.icon}
          entries={sheetData.entries}
          pollsById={pollsById}
          membersById={membersById}
          membersCount={membersCount}
          currentUserId={currentUserId}
          sessionPollVotes={sessionPollVotes}
          onPollVote={onPollVote}
          sessionOptionReactions={sessionOptionReactions}
          onOptionReaction={onOptionReaction}
          sessionAddedOptions={sessionAddedOptions}
          onAddOption={onAddOption}
          approvals={approvals}
          onApprove={onApprove}
          onAddCustomEntry={sheetData.onAddCustomEntry}
        />
      )}
    </section>
  )
}

// Local container for custom user-added Charter groups + their entries —
// just-created empty groups and optimistic adds; the server rows (category
// 'custom', metadata.group) are the durable truth.
interface CustomGroupState {
  name: string
  entries: CharterEntry[]
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function makeCustomEntry(
  groupName: string,
  label: string,
  rule: CharterApprovalRule,
  season: string
): CharterEntry {
  // The key is generated up front and shared with the server insert, so
  // the optimistic copy dedupes away when the real row arrives.
  const key = `custom:${slugify(groupName)}:${slugify(label)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
  return {
    id: key,
    key,
    label,
    category: 'custom',
    value: null,
    season,
    source: 'manual',
    pollId: null,
    approvalRule: rule,
    threshold: rule === 'supermajority' ? 0.75 : null,
    status: 'draft',
    proposedBy: null,
    proposedAt: null,
    lockedAt: null,
    pending: null,
    metadata: { group: groupName },
  }
}

// ─── Charter row ──────────────────────────────────────────────────────
// One charter entry as a compact row: status chip + label on the left,
// current value on the right. Entries with a live poll get the loud
// neon treatment — everything else stays quiet so actionable rows pop.
// Clicking any row opens the group sheet.

// Viewer's effective vote for a poll — session overlay wins outright
// (an empty session vote means "cleared"), then the fixture response.
function viewerVoteFor(
  poll: LeaguePoll | null,
  sessionPollVotes: Map<string, SessionVote>,
  currentUserId: string
): SessionVote | null {
  if (!poll) return null
  if (sessionPollVotes.has(poll.id)) return sessionPollVotes.get(poll.id) ?? null
  const r = poll.responses.find((x) => x.userId === currentUserId)
  if (!r) return null
  return {
    choiceId: r.choiceId ?? undefined,
    choiceIds: r.choiceIds ?? undefined,
    text: r.text ?? undefined,
    rankings: r.rankings ?? undefined,
  }
}

// Short label for what the viewer picked — shown on voting rows once
// they've voted. Multi/ranked collapse to "first pick +N".
function myPickSummary(poll: LeaguePoll, vote: SessionVote): string | null {
  const labelOf = (id: string) =>
    poll.options.find((o) => o.id === id)?.label ?? null
  if (vote.choiceId) return labelOf(vote.choiceId)
  if (vote.choiceIds && vote.choiceIds.length > 0) {
    const first = labelOf(vote.choiceIds[0]!)
    if (!first) return null
    return vote.choiceIds.length > 1
      ? `${first} +${vote.choiceIds.length - 1}`
      : first
  }
  if (vote.rankings && vote.rankings.length > 0) {
    const top = [...vote.rankings].sort((a, b) => a.rank - b.rank)[0]!
    const label = labelOf(top.choiceId)
    if (!label) return null
    return vote.rankings.length > 1
      ? `${label} +${vote.rankings.length - 1}`
      : label
  }
  return null
}

// Prominent header bar atop each category panel. Opens the group's
// sheet on its summary (main) page. The per-row "needs your vote"
// treatment carries the attention signal; the header stays quiet.
function GroupHeaderRow({
  name,
  icon: Icon,
  lockedCount,
  total,
  onOpen,
}: {
  name: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
  lockedCount: number
  total: number
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 border-b border-white/10 bg-white/[0.05] px-3.5 py-3 text-left hover:bg-white/[0.08] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
    >
      <Icon className="h-4 w-4 shrink-0 text-foreground/80" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-black tracking-[0.28em] uppercase text-foreground">
        {name}
      </span>
      <span className="shrink-0 text-[10px] font-bold tabular-nums tracking-[0.2em] uppercase text-muted-foreground">
        {lockedCount}/{total}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

function CharterRow({
  entry,
  poll,
  myVote,
  onOpen,
}: {
  entry: CharterEntry
  poll?: LeaguePoll | null
  myVote?: SessionVote | null
  onOpen: () => void
}) {
  const isLocked = entry.status === 'locked'
  const isPending = entry.status === 'pending' && !!entry.pending
  const isVoting = !isLocked && !!poll && poll.status === 'open'

  // Voting rows carry the viewer's own state: hollow pulsing circle +
  // "needs your vote" until they vote; filled circle + their pick after.
  // The overall leading option stays hidden until the vote solidifies.
  if (isVoting && poll) {
    const voted = hasAnyAnswer(myVote ?? null)
    const pick = voted && myVote ? myPickSummary(poll, myVote) : null
    return (
      <li>
        <button
          type="button"
          onClick={onOpen}
          className="group flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-neon-pink/[0.05] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/40"
        >
          {voted ? (
            <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-neon-pink ring-1 ring-neon-pink/40">
              <Check className="h-2 w-2 text-black" strokeWidth={4} />
            </span>
          ) : (
            <span className="inline-flex h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-inset ring-neon-pink bg-neon-pink/10 animate-pulse" />
          )}
          <span className="shrink-0 text-[12px] font-medium tracking-wide text-muted-foreground">
            {entry.label}
          </span>
          <span className="flex-1 min-w-0 truncate text-right text-[12px]">
            {voted ? (
              <span className="inline-flex max-w-full items-center gap-1.5">
                <span className="shrink-0 font-bold tracking-widest uppercase text-[10px] text-neon-pink">
                  Voting now
                </span>
                <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                  · You: {pick ?? 'voted'}
                </span>
              </span>
            ) : (
              <span className="font-bold tracking-widest uppercase text-[10px] text-neon-pink animate-pulse">
                Needs your vote
              </span>
            )}
          </span>
          <ChevronRight className="h-3 w-3 shrink-0 text-neon-pink/0 group-hover:text-neon-pink/70 transition-colors" />
        </button>
      </li>
    )
  }

  const valueText =
    isLocked && entry.value
      ? entry.value
      : isPending && entry.pending
        ? entry.pending.value
        : 'Awaiting'

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-white/[0.03] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
      >
        <span
          className={cn(
            'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full',
            isLocked
              ? 'bg-neon-blue ring-1 ring-neon-blue/40'
              : isPending
                ? 'bg-neon-pink ring-1 ring-neon-pink/40'
                : 'bg-white/[0.06] ring-1 ring-white/15'
          )}
        >
          {isLocked ? (
            <Check className="h-2 w-2 text-black" strokeWidth={4} />
          ) : isPending ? (
            <Hourglass className="h-2 w-2 text-black" strokeWidth={3} />
          ) : null}
        </span>
        <span className="shrink-0 text-[12px] font-medium tracking-wide text-muted-foreground">
          {entry.label}
        </span>
        <span
          className={cn(
            'flex-1 min-w-0 truncate text-right text-[12px] tabular-nums',
            isLocked
              ? 'font-semibold text-foreground/95'
              : isPending
                ? 'italic text-neon-pink/80'
                : 'italic text-muted-foreground/50'
          )}
        >
          {isPending ? `${valueText} · pending` : valueText}
        </span>
        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors" />
      </button>
    </li>
  )
}

// One card per group in the Season Setup grid. Tappable surface that
// summarizes the group at a glance and opens the GroupSheet for full
// detail + actions.
//
// Layout (matches the betting-slate cards' vocabulary below):
//   1. Slanted dual-color header — visual identity for the category.
//      Big faded category icon sits across the diagonal. Halftone
//      texture overlay adds grain.
//   2. Body — list of every charter entry with a status chip
//      (locked / pending / awaiting), label, and current value.
//   3. Footer — locked count + progress bar.
//
// Heights vary by entry count; consumer wraps in a CSS-columns masonry
// so tall cards (Draft, 10 entries) don't force short cards (Punishment,
// 1 entry) to leave empty space.
function GroupCard({
  groupName,
  icon: Icon,
  palette,
  entries,
  pendingCount,
  onOpen,
}: {
  groupName: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
  palette: [string, string]
  entries: CharterEntry[]
  pendingCount: number
  onOpen: () => void
}) {
  const total = entries.length
  const locked = entries.filter((e) => e.status === 'locked').length
  const pct = total === 0 ? 0 : (locked / total) * 100
  const done = total > 0 && locked === total
  const [colorA, colorB] = palette

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative w-full text-left rounded-xl overflow-hidden border border-white/10 bg-charcoal-panel/40 hover:border-white/25 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
    >
      {/* Slanted dual-color header */}
      <div className="relative h-16 sm:h-[72px]">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(110deg, ${colorA} 0%, ${colorA} 48%, ${colorB} 52%, ${colorB} 100%)`,
          }}
        />
        {/* Halftone dot texture for tactile grain */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-25 mix-blend-overlay"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.9) 1px, transparent 0)',
            backgroundSize: '6px 6px',
          }}
        />
        {/* Big faded category icon — spans the diagonal */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="h-9 w-9 sm:h-11 sm:w-11 text-black/35" strokeWidth={2.5} />
        </div>
        {/* Bottom inset shadow for separation from body */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-b from-transparent to-black/40"
        />
        {/* Pending badge */}
        {pendingCount > 0 && (
          <span className="absolute top-2 right-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-black px-1.5 text-[10px] font-black text-white ring-2 ring-white/80 tabular-nums">
            {pendingCount}
          </span>
        )}
      </div>

      {/* Title row */}
      <div className="flex items-baseline justify-between gap-2 px-3.5 pt-3 pb-1.5">
        <h3 className="text-[13px] font-black tracking-[0.28em] uppercase text-foreground truncate">
          {groupName}
        </h3>
        <span
          className={cn(
            'shrink-0 text-[10px] font-bold tabular-nums tracking-[0.2em] uppercase',
            done ? 'text-neon-blue' : 'text-muted-foreground'
          )}
        >
          {locked}/{total}
        </span>
      </div>

      {/* Item list — every entry with status chip + value */}
      <ul className="px-3.5 pb-3 space-y-1.5">
        {entries.length === 0 ? (
          <li className="text-[11px] italic text-muted-foreground/70">
            Nothing here yet.
          </li>
        ) : (
          entries.map((entry) => {
            const isLocked = entry.status === 'locked'
            const isPending = entry.status === 'pending'
            const valueText = isLocked && entry.value
              ? entry.value
              : isPending && entry.pending
                ? entry.pending.value
                : 'Awaiting'
            return (
              <li key={entry.id} className="flex items-center gap-2 text-[11px] min-w-0">
                <span
                  className={cn(
                    'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full',
                    isLocked
                      ? 'bg-neon-blue ring-1 ring-neon-blue/40'
                      : isPending
                        ? 'bg-neon-pink ring-1 ring-neon-pink/40'
                        : 'bg-white/[0.08] ring-1 ring-white/15'
                  )}
                >
                  {isLocked ? (
                    <Check className="h-2 w-2 text-black" strokeWidth={4} />
                  ) : isPending ? (
                    <Hourglass className="h-2 w-2 text-black" strokeWidth={3} />
                  ) : null}
                </span>
                <span className="shrink-0 font-medium text-muted-foreground/90 tracking-wide max-w-[40%] truncate">
                  {entry.label}:
                </span>
                <span
                  className={cn(
                    'flex-1 min-w-0 truncate text-right tabular-nums',
                    isLocked
                      ? 'text-foreground/95'
                      : isPending
                        ? 'italic text-neon-pink/70'
                        : 'italic text-muted-foreground/55'
                  )}
                >
                  {valueText}
                </span>
              </li>
            )
          })
        )}
      </ul>

      {/* Progress footer */}
      <div className="px-3.5 pb-3 pt-1 border-t border-white/5">
        <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className={cn(
              'h-full transition-[width] duration-500',
              done ? 'bg-neon-blue' : 'bg-neon-pink'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </button>
  )
}

// Sheet shown when a charter row is tapped. Multi-page: 'main' lists the
// group's entries as nav rows; each entry gets its own SheetPage hosting
// the action UI (vote, approve, propose). `defaultEntryId` deep-links
// straight to an entry's page — the sheet seeds history as
// ['main', entry] so Back still returns to the group list. Custom groups
// also get an AddEntryControl on main.
function GroupSheet({
  open,
  onClose,
  defaultEntryId,
  groupName,
  icon: Icon,
  entries,
  pollsById,
  membersById,
  membersCount,
  currentUserId,
  sessionPollVotes,
  onPollVote,
  sessionOptionReactions,
  onOptionReaction,
  sessionAddedOptions,
  onAddOption,
  approvals,
  onApprove,
  onAddCustomEntry,
}: {
  open: boolean
  onClose: () => void
  defaultEntryId: string | null
  groupName: string
  icon: React.ComponentType<{ className?: string }>
  entries: CharterEntry[]
  pollsById: Map<string, LeaguePoll>
  membersById: Map<string, PollMember>
  membersCount: number
  currentUserId: string
  sessionPollVotes: Map<string, SessionVote>
  onPollVote: (pollId: string, vote: SessionVote) => void
  sessionOptionReactions: Map<string, 1 | -1 | null>
  onOptionReaction: (pollId: string, optionId: string, value: 1 | -1 | null) => void
  sessionAddedOptions: Map<string, PollOption[]>
  onAddOption: (pollId: string, label: string, policy: PollOptionPolicy) => void
  approvals: Map<string, boolean>
  onApprove: (entryId: string) => void
  onAddCustomEntry: ((label: string, rule: CharterApprovalRule) => void) | null
}) {
  const total = entries.length
  const locked = entries.filter((e) => e.status === 'locked').length

  // Persistent sheet header — stays put while pages slide underneath
  // (and doubles as the drag area on mobile). Adapts to the active
  // page: group identity + locked tally on main; entry label + status
  // chip when paged into an entry.
  const chipBase =
    'shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase tabular-nums ring-1'
  const renderHeader = (ctx: { currentPage: string }) => {
    const entry =
      ctx.currentPage === 'main'
        ? null
        : entries.find((e) => e.id === ctx.currentPage) ?? null
    const poll = entry?.pollId ? pollsById.get(entry.pollId) ?? null : null
    const isVoting =
      !!entry && entry.status !== 'locked' && !!poll && poll.status === 'open'
    const chip = !entry ? (
      <span className={cn(chipBase, 'bg-white/[0.04] ring-white/10 text-muted-foreground')}>
        {locked}/{total} locked
      </span>
    ) : entry.status === 'locked' ? (
      <span className={cn(chipBase, 'bg-neon-blue/10 ring-neon-blue/30 text-neon-blue')}>
        Locked
      </span>
    ) : entry.status === 'pending' ? (
      <span className={cn(chipBase, 'bg-neon-pink/10 ring-neon-pink/30 text-neon-pink')}>
        Pending
      </span>
    ) : isVoting ? (
      <span className={cn(chipBase, 'bg-neon-pink/10 ring-neon-pink/40 text-neon-pink animate-pulse')}>
        Voting now
      </span>
    ) : (
      <span className={cn(chipBase, 'bg-white/[0.04] ring-white/10 text-muted-foreground')}>
        Open
      </span>
    )
    return (
      <div className="px-5 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2.5 min-w-0">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10">
              <Icon className="h-4 w-4 text-foreground/90" />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground truncate">
                {entry ? `Season Setup · ${groupName}` : 'Season Setup'}
              </p>
              <p className="text-base font-bold tracking-wide uppercase text-foreground truncate">
                {entry ? entry.label : groupName}
              </p>
            </div>
          </div>
          {chip}
        </div>
      </div>
    )
  }

  return (
    <ResponsiveSheet
      open={open}
      onClose={onClose}
      defaultPage={defaultEntryId ?? 'main'}
      sheetMaxHeight="92dvh"
      maxWidth="max-w-2xl"
      panelClassName="glass-intense border-t border-white/15 md:border md:rounded-2xl"
      header={renderHeader}
    >
      <SheetPage name="main">
        <ul className="space-y-1.5 px-5 pb-6 pt-3">
          {entries.length === 0 && !onAddCustomEntry && (
            <li className="rounded-lg border border-dashed border-white/10 bg-white/[0.015] px-4 py-6 text-center text-xs text-muted-foreground">
              Nothing here yet.
            </li>
          )}
          {entries.map((entry) => {
            const poll = entry.pollId
              ? pollsById.get(entry.pollId) ?? null
              : null
            return (
              <EntryNavRow
                key={entry.id}
                entry={entry}
                poll={poll}
                myVote={viewerVoteFor(poll, sessionPollVotes, currentUserId)}
              />
            )
          })}
          {onAddCustomEntry && (
            <li className="pt-1">
              <AddEntryControl onSubmit={onAddCustomEntry} />
            </li>
          )}
        </ul>
      </SheetPage>

      {entries.map((entry) => (
        // No page `title` — the persistent sheet header already shows
        // the entry label, so the back bar stays a lone "Back".
        <SheetPage key={entry.id} name={entry.id}>
          <div className="px-5 pb-6">
            <EntryAction
              entry={entry}
              poll={entry.pollId ? pollsById.get(entry.pollId) ?? null : null}
              membersById={membersById}
              membersCount={membersCount}
              currentUserId={currentUserId}
              sessionVoteForPoll={
                entry.pollId ? sessionPollVotes.get(entry.pollId) ?? null : null
              }
              onPollVote={
                entry.pollId
                  ? (vote) => onPollVote(entry.pollId!, vote)
                  : null
              }
              viewerApproved={approvals.get(entry.id) ?? null}
              onApprove={() => onApprove(entry.id)}
              sessionOptionReactions={sessionOptionReactions}
              onOptionReaction={onOptionReaction}
              sessionAddedOptions={sessionAddedOptions}
              onAddOption={onAddOption}
            />
          </div>
        </SheetPage>
      ))}
    </ResponsiveSheet>
  )
}

// "+ Add a topic" — the dashed trailing card in the grid. Collapsed
// state matches a card's footprint so the grid stays even; tapping
// expands an inline input in place.
function AddTopicCard({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full min-h-[7.25rem] items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.015] p-4 text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:border-neon-pink/30 hover:text-neon-pink hover:bg-white/[0.03] transition-colors"
      >
        <Sparkles className="h-3 w-3" />
        Add a topic
      </button>
    )
  }
  const submit = () => {
    const name = draft.trim()
    if (!name) return
    onAdd(name)
    setDraft('')
    setOpen(false)
  }
  return (
    <div className="rounded-xl border border-neon-pink/30 bg-neon-pink/[0.04] p-3.5 min-h-[7.25rem] space-y-2">
      <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-neon-pink">
        New Topic
      </p>
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Side bets, prop pool, etc."
        className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-neon-pink/50"
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') {
            setOpen(false)
            setDraft('')
          }
        }}
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setDraft('')
          }}
          className="px-3 py-1.5 text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={draft.trim().length === 0}
          className="px-3 py-1.5 rounded-md text-[11px] font-bold tracking-widest uppercase text-black bg-neon-pink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neon-pink/90 transition-colors"
        >
          Add topic
        </button>
      </div>
    </div>
  )
}

function AddEntryControl({
  onSubmit,
}: {
  onSubmit: (label: string, rule: CharterApprovalRule) => void
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [rule, setRule] = useState<CharterApprovalRule>('majority')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-2 rounded-lg border border-dashed border-white/10 bg-white/[0.015] px-4 py-2.5 text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:border-neon-pink/30 hover:text-neon-pink hover:bg-white/[0.03] transition-colors"
      >
        <Sparkles className="h-3 w-3" />
        Add an entry
      </button>
    )
  }
  const submit = () => {
    const text = label.trim()
    if (!text) return
    onSubmit(text, rule)
    setLabel('')
    setRule('majority')
    setOpen(false)
  }

  return (
    <div className="space-y-2 rounded-lg border border-white/15 bg-white/[0.03] p-3">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Entry label (e.g. 'Side bet ledger')"
        className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-white/30"
      />
      <div className="flex flex-wrap gap-1.5">
        {(['commish', 'majority', 'supermajority', 'unanimous'] as const).map(
          (r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRule(r)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors',
                rule === r
                  ? 'bg-neon-blue text-black'
                  : 'bg-white/[0.04] text-muted-foreground ring-1 ring-white/10 hover:bg-white/[0.08]'
              )}
            >
              {APPROVAL_LABEL[r]}
            </button>
          )
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setLabel('')
          }}
          className="px-3 py-1.5 text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={label.trim().length === 0}
          className="px-3 py-1.5 rounded-md text-[11px] font-bold tracking-widest uppercase text-primary-foreground bg-neon-blue disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neon-blue/90 transition-colors"
        >
          Add entry
        </button>
      </div>
    </div>
  )
}

// ─── EntryDock — per-row mini-dock with inline action UI ───────────────────

const STATUS_VISUAL: Record<
  CharterStatus,
  {
    icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>
    tone: string
    ring: string
    bg: string
  }
> = {
  locked: {
    icon: Check,
    tone: 'text-neon-blue',
    ring: 'ring-neon-blue/40',
    bg: 'bg-neon-blue',
  },
  pending: {
    icon: Hourglass,
    tone: 'text-neon-pink',
    ring: 'ring-neon-pink/40',
    bg: 'bg-neon-pink',
  },
  draft: {
    icon: Circle,
    tone: 'text-muted-foreground/70',
    ring: 'ring-white/15',
    bg: 'bg-white/[0.08]',
  },
}

// Nav row on the group sheet's main page — status dot, category icon,
// label, current value, chevron. Tapping pages over to the entry's own
// SheetPage (no accordion).
function EntryNavRow({
  entry,
  poll,
  myVote,
}: {
  entry: CharterEntry
  poll: LeaguePoll | null
  myVote?: SessionVote | null
}) {
  const { navigate } = useResponsiveSheet()
  const CategoryIcon = CHARTER_ICON[entry.category]
  const approvalLabel = APPROVAL_LABEL[entry.approvalRule]
  const statusVisual = STATUS_VISUAL[entry.status]
  const StatusIcon = statusVisual.icon
  const isVoting =
    entry.status !== 'locked' && !!poll && poll.status === 'open'
  const voted = isVoting && hasAnyAnswer(myVote ?? null)
  const pick =
    voted && poll && myVote ? myPickSummary(poll, myVote) : null

  let rightColumn: React.ReactNode = null
  if (entry.status === 'locked' && entry.value) {
    rightColumn = (
      <p className="text-sm font-semibold text-neon-blue truncate text-right">
        {entry.value}
      </p>
    )
  } else if (entry.status === 'pending' && entry.pending) {
    rightColumn = (
      <p className="text-sm text-neon-pink/80 italic truncate text-right">
        Proposed: {entry.pending.value}
      </p>
    )
  } else if (isVoting) {
    rightColumn = voted ? (
      <p className="inline-flex max-w-full items-center justify-end gap-1.5 text-right">
        <span className="shrink-0 font-bold tracking-widest uppercase text-[11px] text-neon-pink">
          Voting now
        </span>
        <span className="min-w-0 truncate text-[11px] text-muted-foreground">
          · You: {pick ?? 'voted'}
        </span>
      </p>
    ) : (
      <p className="text-[11px] font-bold tracking-widest uppercase text-neon-pink text-right truncate animate-pulse">
        Needs your vote
      </p>
    )
  } else {
    rightColumn = (
      <p className="text-[11px] text-muted-foreground italic text-right truncate">
        {entry.source === 'derived-from-poll'
          ? 'Awaiting poll'
          : entry.approvalRule === 'commish'
            ? 'Up to the commish'
            : 'Not yet proposed'}
      </p>
    )
  }

  return (
    <li className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
      <button
        type="button"
        onClick={() => navigate(entry.id)}
        className="group flex w-full flex-col px-4 py-3 text-left"
      >
        <span className="flex w-full items-center gap-3">
          {/* Status indicator dot — color + icon convey state at a glance.
              Voting rows override it with the viewer's own state. */}
          {isVoting ? (
            voted ? (
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neon-pink ring-1 ring-inset ring-neon-pink/40">
                <Check className="h-2.5 w-2.5 text-black" strokeWidth={3} />
              </span>
            ) : (
              <span className="inline-flex h-5 w-5 shrink-0 rounded-full ring-1 ring-inset ring-neon-pink bg-neon-pink/10 animate-pulse" />
            )
          ) : (
            <span
              className={cn(
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
                statusVisual.bg,
                statusVisual.ring
              )}
            >
              <StatusIcon className="h-2.5 w-2.5 text-black" strokeWidth={3} />
            </span>
          )}

          <CategoryIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />

          <p className="text-sm font-medium text-foreground/95 truncate flex-1 min-w-0">
            {entry.label}
          </p>

          <span className="hidden sm:block shrink-0 min-w-0 max-w-[18rem]">
            {rightColumn}
          </span>

          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </span>

        {/* Secondary row — approval rule; on mobile the value moves here */}
        <span className="mt-1 flex w-full items-center gap-3 pl-8 text-[10px]">
          <span className="inline-flex items-center gap-1 text-muted-foreground/70 font-bold tracking-widest uppercase">
            {entry.source === 'derived-from-poll' && (
              <Vote className="h-2.5 w-2.5" />
            )}
            {approvalLabel}
          </span>
          <span className="sm:hidden ml-auto min-w-0 max-w-[60%]">
            {rightColumn}
          </span>
        </span>
      </button>
    </li>
  )
}

// State-aware action panel inside an expanded EntryDock. Routes to
// inline-vote / approve / propose UI depending on what the entry needs.
function EntryAction({
  entry,
  poll,
  membersById,
  membersCount,
  currentUserId,
  sessionVoteForPoll,
  onPollVote,
  viewerApproved,
  onApprove,
  sessionOptionReactions,
  onOptionReaction,
  sessionAddedOptions,
  onAddOption,
}: {
  entry: CharterEntry
  poll: LeaguePoll | null
  membersById: Map<string, PollMember>
  membersCount: number
  currentUserId: string
  sessionVoteForPoll: SessionVote | null
  onPollVote: ((vote: SessionVote) => void) | null
  viewerApproved: boolean | null
  onApprove: () => void
  sessionOptionReactions: Map<string, 1 | -1 | null>
  onOptionReaction: (pollId: string, optionId: string, value: 1 | -1 | null) => void
  sessionAddedOptions: Map<string, PollOption[]>
  onAddOption: (pollId: string, label: string, policy: PollOptionPolicy) => void
}) {
  const approvalLabel = APPROVAL_LABEL[entry.approvalRule]

  // Long-form explanation shared across all statuses — sits at the top
  // of the expanded panel so the viewer understands what the entry
  // governs before the action UI loads.
  const descriptionBlock = entry.description ? (
    <p className="text-[12px] leading-snug text-muted-foreground/90 border-l-2 border-white/10 pl-3">
      {entry.description}
    </p>
  ) : null

  // ─── Locked ────────────────────────────────────────────────────────────
  if (entry.status === 'locked') {
    return (
      <div className="space-y-3">
        {descriptionBlock}
        <div className="space-y-2">
          <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-neon-blue">
            Ratified
          </p>
          <p className="text-base font-semibold text-neon-blue break-words">
            {entry.value}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {approvalLabel}
            {entry.lockedAt &&
              ` · locked ${new Date(entry.lockedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}`}
          </p>
        </div>
        {/* Special table render for the eligible-keepers entry */}
        {entry.key === 'eligible-keepers' && entry.metadata?.keeperRoster && (
          <EligibleKeepersTable
            roster={entry.metadata.keeperRoster}
            membersById={membersById}
            currentUserId={currentUserId}
          />
        )}
      </div>
    )
  }

  // ─── Pending (manual proposal awaiting approvals) ─────────────────────
  if (entry.status === 'pending' && entry.pending) {
    const approvedFromFixture = entry.pending.approvals.filter(
      (a) => a.approved && a.userId !== currentUserId
    ).length
    const viewerFromFixture = entry.pending.approvals.some(
      (a) => a.userId === currentUserId && a.approved
    )
    const viewerEffective =
      viewerApproved === null ? viewerFromFixture : viewerApproved
    const current = approvedFromFixture + (viewerEffective ? 1 : 0)
    const required =
      entry.approvalRule === 'unanimous'
        ? membersCount
        : entry.approvalRule === 'supermajority'
          ? Math.ceil(membersCount * (entry.threshold ?? 0.75))
          : entry.approvalRule === 'majority'
            ? Math.floor(membersCount / 2) + 1
            : membersCount
    const proposer = membersById.get(entry.pending.proposedBy)
    const approverVoters = entry.pending.approvals
      .filter((a) => a.approved && a.userId !== currentUserId)
      .map((a) => ({ userId: a.userId }))
    if (viewerEffective) approverVoters.push({ userId: currentUserId })

    return (
      <div className="space-y-3">
        {descriptionBlock}
        <div className="space-y-1">
          <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-neon-pink">
            Proposal
          </p>
          <p className="text-sm text-foreground/95 italic">
            “{entry.pending.value}”
          </p>
          <p className="text-[11px] text-muted-foreground">
            Pitched by{' '}
            {entry.pending.proposedBy === currentUserId
              ? 'you'
              : displayNameOf(proposer, entry.pending.proposedBy)}
            {' · '}
            {approvalLabel} threshold
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px]">
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-neon-pink"
                style={{
                  width: `${Math.min(100, Math.round((current / required) * 100))}%`,
                }}
              />
            </div>
            <span className="text-neon-pink font-bold tabular-nums">
              {current}/{required}
            </span>
          </div>
          {approverVoters.length > 0 && (
            <VoterStack
              voters={approverVoters}
              membersById={membersById}
              highlightUserId={currentUserId}
              maxShown={8}
              size="xs"
            />
          )}
        </div>

        {!viewerEffective ? (
          <button
            type="button"
            onClick={onApprove}
            className="w-full rounded-md bg-neon-pink px-3 py-2 text-xs font-bold tracking-widest uppercase text-black hover:bg-neon-pink/80 transition-colors"
          >
            Approve this proposal
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-neon-pink">
            <Check className="h-3 w-3" />
            You approved
          </div>
        )}
      </div>
    )
  }

  // ─── Draft + poll-derived: inline vote when the linked poll is open ────
  if (
    entry.status === 'draft' &&
    entry.source === 'derived-from-poll' &&
    poll &&
    poll.status === 'open'
  ) {
    return (
      <div className="space-y-3">
        {descriptionBlock}
        <InlinePollVote
          poll={poll}
          currentUserId={currentUserId}
          sessionVote={sessionVoteForPoll}
          onVote={onPollVote ?? (() => {})}
          membersById={membersById}
          sessionOptionReactions={sessionOptionReactions}
          onOptionReaction={(optionId, value) =>
            onOptionReaction(poll.id, optionId, value)
          }
          sessionAddedOptions={sessionAddedOptions.get(poll.id) ?? []}
          onAddOption={(label) => onAddOption(poll.id, label, poll.optionPolicy)}
        />
      </div>
    )
  }

  // ─── Draft + commish: hint, no inline action for non-commish viewers ──
  if (entry.status === 'draft' && entry.approvalRule === 'commish') {
    return (
      <div className="space-y-3">
        {descriptionBlock}
        <div className="space-y-1">
          <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-muted-foreground">
            Commish&apos;s Call
          </p>
          <p className="text-sm text-foreground/85">
            The commissioner picks the value. No vote required.
          </p>
        </div>
      </div>
    )
  }

  // ─── Draft + manual (no proposal yet) ─────────────────────────────────
  return (
    <div className="space-y-3">
      {descriptionBlock}
      <div className="space-y-1">
        <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-muted-foreground">
          Open for proposals
        </p>
        <p className="text-sm text-foreground/85">
          Be the first to pitch a value. Approval rule: {approvalLabel.toLowerCase()}.
        </p>
      </div>
    </div>
  )
}

// Compact inline poll voter for use inside an EntryDock. Supports single-
// choice polls fully; ranked polls land a "Open in voter" CTA pointing at
// the bottom dock since ranked UI is heavier than this surface should
// carry.
function InlinePollVote({
  poll,
  currentUserId,
  sessionVote,
  onVote,
  membersById,
  sessionOptionReactions,
  onOptionReaction,
  sessionAddedOptions,
  onAddOption,
}: {
  poll: LeaguePoll
  currentUserId: string
  sessionVote: SessionVote | null
  onVote: (vote: SessionVote) => void
  membersById: Map<string, PollMember>
  sessionOptionReactions: Map<string, 1 | -1 | null>
  onOptionReaction: (optionId: string, value: 1 | -1 | null) => void
  sessionAddedOptions: PollOption[]
  onAddOption: (label: string) => void
}) {
  // Merge session-added options into the poll's roster so the user
  // sees their just-added option immediately.
  const allOptions = [...poll.options, ...sessionAddedOptions]
  const approved = allOptions.filter((o) => o.status === 'approved')
  const pending = allOptions.filter((o) => o.status === 'pending')

  // For ranked polls we still defer to the bottom dock for the actual
  // ranking UI, but pending lane + add-option still apply inline.
  const isRanked = poll.kind === 'ranked'

  return (
    <div className="space-y-4">
      {/* Approved options — the real vote mechanic */}
      {isRanked ? (
        <RankedChoiceVote
          poll={poll}
          currentUserId={currentUserId}
          sessionVote={sessionVote}
          onVote={onVote}
        />
      ) : poll.kind === 'multi' ? (
        <MultiChoiceVote
          poll={poll}
          options={approved}
          currentUserId={currentUserId}
          sessionVote={sessionVote}
          onVote={onVote}
          membersById={membersById}
        />
      ) : (
        <SingleChoiceVote
          poll={poll}
          options={approved}
          currentUserId={currentUserId}
          sessionVote={sessionVote}
          onVote={onVote}
          membersById={membersById}
        />
      )}

      {/* Pending lane — only renders for curated polls. Members can
          up/down to signal which pending options the commish should
          promote into the votable set. */}
      {poll.optionPolicy === 'curated' && pending.length > 0 && (
        <PendingOptionsLane
          pollId={poll.id}
          options={pending}
          currentUserId={currentUserId}
          membersById={membersById}
          sessionReactions={sessionOptionReactions}
          onReact={onOptionReaction}
        />
      )}

      {/* Add-option control — visible when the poll allows it */}
      {(poll.optionPolicy === 'open' || poll.optionPolicy === 'curated') && (
        <AddOptionControl
          policy={poll.optionPolicy}
          onSubmit={onAddOption}
        />
      )}
    </div>
  )
}

// Inline ranked voter — tap options in preference order (tap again to
// unrank; ranks above the removed slot shift down). Saves on every
// change like the other inline voters.
function RankedChoiceVote({
  poll,
  currentUserId,
  sessionVote,
  onVote,
}: {
  poll: LeaguePoll
  currentUserId: string
  sessionVote: SessionVote | null
  onVote: (vote: SessionVote) => void
}) {
  const fixtureViewer = poll.responses.find((r) => r.userId === currentUserId)
  const effective = sessionVote
    ? sessionVote.rankings ?? []
    : fixtureViewer?.rankings ?? []
  const maxRanks = poll.maxRanks ?? 3

  const cycleRank = (optionId: string) => {
    const existing = effective.find((r) => r.choiceId === optionId)
    let next: RankedSelection[]
    if (existing) {
      next = effective
        .filter((r) => r.choiceId !== optionId)
        .map((r) => (r.rank > existing.rank ? { ...r, rank: r.rank - 1 } : r))
    } else if (effective.length >= maxRanks) {
      return
    } else {
      next = [...effective, { choiceId: optionId, rank: effective.length + 1 }]
    }
    onVote(next.length > 0 ? { rankings: next } : {})
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-muted-foreground">
        Rank your top {maxRanks}
      </p>
      <RankedOptions
        poll={poll}
        maxRanks={maxRanks}
        draftRankings={effective}
        onTap={cycleRank}
      />
      {effective.length > 0 && <ClearVoteButton onClear={() => onVote({})} />}
    </div>
  )
}

function SingleChoiceVote({
  poll,
  options,
  currentUserId,
  sessionVote,
  onVote,
  membersById,
}: {
  poll: LeaguePoll
  options: PollOption[]
  currentUserId: string
  sessionVote: SessionVote | null
  onVote: (vote: SessionVote) => void
  membersById: Map<string, PollMember>
}) {
  const fixtureViewer = poll.responses.find((r) => r.userId === currentUserId)
  // Session overlay wins outright — a session-cleared vote (empty object)
  // means "no choice" even while the fixture row is still present.
  const effectiveChoice = sessionVote
    ? sessionVote.choiceId ?? null
    : fixtureViewer?.choiceId ?? null

  const counts = new Map<string, number>()
  const votersByOption = new Map<string, Array<{ userId: string }>>()
  for (const o of options) {
    counts.set(o.id, 0)
    votersByOption.set(o.id, [])
  }
  for (const r of poll.responses) {
    if (r.userId === currentUserId) continue
    if (r.choiceId && counts.has(r.choiceId)) {
      counts.set(r.choiceId, (counts.get(r.choiceId) ?? 0) + 1)
      votersByOption.get(r.choiceId)?.push({ userId: r.userId })
    }
  }
  if (effectiveChoice && counts.has(effectiveChoice)) {
    counts.set(effectiveChoice, (counts.get(effectiveChoice) ?? 0) + 1)
    votersByOption.get(effectiveChoice)?.push({ userId: currentUserId })
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0)

  if (options.length === 0) {
    return (
      <p className="text-[11px] italic text-muted-foreground">
        No options yet. Add one below to kick things off.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-muted-foreground">
        Cast Your Vote
      </p>
      <div className="space-y-1.5">
        {options.map((o) => {
          const n = counts.get(o.id) ?? 0
          const pct = total === 0 ? 0 : Math.round((n / total) * 100)
          const isMine = effectiveChoice === o.id
          const voters = votersByOption.get(o.id) ?? []
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onVote(isMine ? {} : { choiceId: o.id })}
              className={cn(
                'w-full text-left rounded-md px-3 py-2 ring-1 transition-colors',
                isMine
                  ? 'ring-neon-blue bg-neon-blue/[0.08]'
                  : 'ring-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center gap-2 text-[12px]">
                <span
                  className={cn(
                    'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
                    isMine
                      ? 'bg-neon-blue ring-neon-blue text-black'
                      : 'ring-white/20'
                  )}
                >
                  {isMine && <Check className="h-2 w-2" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    'truncate min-w-0 flex-1',
                    isMine ? 'text-neon-blue font-semibold' : 'text-foreground/85'
                  )}
                >
                  {o.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {n} · {pct}%
                </span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    isMine ? 'bg-neon-blue' : 'bg-white/15'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {voters.length > 0 && (
                <div className="mt-1.5">
                  <VoterStack
                    voters={voters}
                    membersById={membersById}
                    highlightUserId={currentUserId}
                    maxShown={6}
                    size="xs"
                  />
                </div>
              )}
            </button>
          )
        })}
      </div>
      {effectiveChoice && (
        <ClearVoteButton onClear={() => onVote({})} />
      )}
    </div>
  )
}

// Small "withdraw my vote" affordance shared by the choice voters. Tapping
// an already-selected option also clears; this is the explicit path.
function ClearVoteButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase text-muted-foreground/70 hover:text-neon-pink transition-colors"
    >
      <X className="h-3 w-3" />
      Clear my vote
    </button>
  )
}

// Multi-select voter — approval-style "pick every option that works".
// Saves on every toggle like the single voter; clearing the last pick
// withdraws the vote entirely.
function MultiChoiceVote({
  poll,
  options,
  currentUserId,
  sessionVote,
  onVote,
  membersById,
}: {
  poll: LeaguePoll
  options: PollOption[]
  currentUserId: string
  sessionVote: SessionVote | null
  onVote: (vote: SessionVote) => void
  membersById: Map<string, PollMember>
}) {
  const fixtureViewer = poll.responses.find((r) => r.userId === currentUserId)
  const effectiveIds = sessionVote
    ? sessionVote.choiceIds ?? []
    : fixtureViewer?.choiceIds ?? []

  const counts = new Map<string, number>()
  const votersByOption = new Map<string, Array<{ userId: string }>>()
  for (const o of options) {
    counts.set(o.id, 0)
    votersByOption.set(o.id, [])
  }
  for (const r of poll.responses) {
    if (r.userId === currentUserId) continue
    for (const id of r.choiceIds ?? []) {
      if (!counts.has(id)) continue
      counts.set(id, (counts.get(id) ?? 0) + 1)
      votersByOption.get(id)?.push({ userId: r.userId })
    }
  }
  for (const id of effectiveIds) {
    if (!counts.has(id)) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
    votersByOption.get(id)?.push({ userId: currentUserId })
  }
  // Denominator is voters, not selections — "3 of 5 can do Saturday".
  const responders =
    poll.responses.filter((r) => r.userId !== currentUserId).length +
    (effectiveIds.length > 0 ? 1 : 0)

  const toggle = (optionId: string) => {
    const next = effectiveIds.includes(optionId)
      ? effectiveIds.filter((id) => id !== optionId)
      : [...effectiveIds, optionId]
    onVote(next.length > 0 ? { choiceIds: next } : {})
  }

  if (options.length === 0) {
    return (
      <p className="text-[11px] italic text-muted-foreground">
        No options yet. Add one below to kick things off.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-muted-foreground">
        Pick every one that works
      </p>
      <div className="space-y-1.5">
        {options.map((o) => {
          const n = counts.get(o.id) ?? 0
          const pct = responders === 0 ? 0 : Math.round((n / responders) * 100)
          const isMine = effectiveIds.includes(o.id)
          const voters = votersByOption.get(o.id) ?? []
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className={cn(
                'w-full text-left rounded-md px-3 py-2 ring-1 transition-colors',
                isMine
                  ? 'ring-neon-blue bg-neon-blue/[0.08]'
                  : 'ring-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center gap-2 text-[12px]">
                <span
                  className={cn(
                    'inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded ring-1 ring-inset',
                    isMine
                      ? 'bg-neon-blue ring-neon-blue text-black'
                      : 'ring-white/20'
                  )}
                >
                  {isMine && <Check className="h-2 w-2" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    'truncate min-w-0 flex-1',
                    isMine ? 'text-neon-blue font-semibold' : 'text-foreground/85'
                  )}
                >
                  {o.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {n} · {pct}%
                </span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    isMine ? 'bg-neon-blue' : 'bg-white/15'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {voters.length > 0 && (
                <div className="mt-1.5">
                  <VoterStack
                    voters={voters}
                    membersById={membersById}
                    highlightUserId={currentUserId}
                    maxShown={6}
                    size="xs"
                  />
                </div>
              )}
            </button>
          )
        })}
      </div>
      {effectiveIds.length > 0 && (
        <ClearVoteButton onClear={() => onVote({})} />
      )}
    </div>
  )
}

// ─── Pending options lane (curated polls only) ─────────────────────────────

function PendingOptionsLane({
  pollId,
  options,
  currentUserId,
  membersById,
  sessionReactions,
  onReact,
}: {
  pollId: string
  options: PollOption[]
  currentUserId: string
  membersById: Map<string, PollMember>
  sessionReactions: Map<string, 1 | -1 | null>
  onReact: (optionId: string, value: 1 | -1 | null) => void
}) {
  // Sort pending options by net score so what the league likes rises.
  const enriched = options.map((opt) => {
    const sessionKey = `${pollId}::${opt.id}`
    const sessionVote = sessionReactions.get(sessionKey)
    const fixtureViewer = opt.reactions.find((r) => r.userId === currentUserId)
    const myVote: 1 | -1 | null =
      sessionVote === undefined ? fixtureViewer?.value ?? null : sessionVote
    const others = opt.reactions.filter((r) => r.userId !== currentUserId)
    const ups = others.filter((r) => r.value === 1).map((r) => ({ userId: r.userId }))
    const downs = others.filter((r) => r.value === -1).map((r) => ({ userId: r.userId }))
    if (myVote === 1) ups.push({ userId: currentUserId })
    if (myVote === -1) downs.push({ userId: currentUserId })
    return { opt, ups, downs, myVote, score: ups.length - downs.length }
  })
  enriched.sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-2 border-t border-white/5 pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-neon-pink">
          Pending · {enriched.length}
        </p>
        <p className="text-[10px] text-muted-foreground/70 italic">
          Up/down to signal — commish promotes the winners
        </p>
      </div>
      <ul className="space-y-1.5">
        {enriched.map(({ opt, ups, downs, myVote, score }) => {
          const author = membersById.get(opt.addedBy)
          const isMine = opt.addedBy === currentUserId
          return (
            <li
              key={opt.id}
              className="rounded-md border border-neon-pink/15 bg-neon-pink/[0.03] px-3 py-2"
            >
              <div className="flex items-start gap-2.5">
                {/* Score column with up/down */}
                <div className="flex flex-col items-center shrink-0 pt-0.5">
                  <button
                    type="button"
                    onClick={() => onReact(opt.id, myVote === 1 ? null : 1)}
                    aria-label="Upvote"
                    className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded transition-colors',
                      myVote === 1
                        ? 'bg-neon-blue text-black'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-neon-blue'
                    )}
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <span
                    className={cn(
                      'font-display text-xs font-bold tabular-nums leading-none my-0.5',
                      score > 0
                        ? 'text-neon-blue'
                        : score < 0
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    )}
                  >
                    {score > 0 ? `+${score}` : score}
                  </span>
                  <button
                    type="button"
                    onClick={() => onReact(opt.id, myVote === -1 ? null : -1)}
                    aria-label="Downvote"
                    className={cn(
                      'inline-flex h-5 w-5 items-center justify-center rounded transition-colors',
                      myVote === -1
                        ? 'bg-destructive text-black'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-destructive'
                    )}
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Body */}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[13px] text-foreground/95 leading-snug break-words">
                    {opt.label}
                  </p>
                  {opt.hint && (
                    <p className="text-[10px] text-muted-foreground/80 italic leading-snug">
                      {opt.hint}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                    <Avatar className="h-3.5 w-3.5 ring-1 ring-white/10">
                      <AvatarImage
                        src={author?.avatarUrl ?? undefined}
                        alt={author?.fullName ?? author?.email ?? 'Member'}
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground text-[6px] font-bold">
                        {getInitials(author?.fullName ?? null, author?.email ?? '')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground">
                      {isMine ? 'Pitched by you' : displayNameOf(author, opt.addedBy)}
                    </span>
                    {ups.length > 0 && (
                      <div className="inline-flex items-center gap-1 ml-1.5">
                        <ThumbsUp className="h-2.5 w-2.5 text-neon-blue/70" />
                        <VoterStack
                          voters={ups}
                          membersById={membersById}
                          highlightUserId={currentUserId}
                          maxShown={4}
                          size="xs"
                        />
                      </div>
                    )}
                    {downs.length > 0 && (
                      <div className="inline-flex items-center gap-1 ml-1.5">
                        <ThumbsDown className="h-2.5 w-2.5 text-destructive/70" />
                        <VoterStack
                          voters={downs}
                          membersById={membersById}
                          highlightUserId={currentUserId}
                          maxShown={4}
                          size="xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Add option (open + curated polls) ─────────────────────────────────────

// ─── Eligible keepers table (special-render for the keeper roster entry) ──

function EligibleKeepersTable({
  roster,
  membersById,
  currentUserId,
}: {
  roster: KeeperRosterRow[]
  membersById: Map<string, PollMember>
  currentUserId: string
}) {
  if (roster.length === 0) return null
  return (
    <div className="mt-1 rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase text-muted-foreground/70 border-b border-white/5 bg-white/[0.02]">
        <span>Team · Player</span>
        <span>Pos</span>
        <span className="text-right">Cost</span>
      </div>
      <ul className="divide-y divide-white/[0.04]">
        {roster.map((row) => {
          const member = membersById.get(row.userId)
          const isMine = row.userId === currentUserId
          return (
            <li
              key={`${row.userId}-${row.player}`}
              className={cn(
                'grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-2',
                isMine && 'bg-neon-blue/[0.04]'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-5 w-5 ring-1 ring-white/10 shrink-0">
                  <AvatarImage
                    src={member?.avatarUrl ?? undefined}
                    alt={member?.fullName ?? member?.email ?? 'Member'}
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground text-[8px] font-bold">
                    {getInitials(member?.fullName ?? null, member?.email ?? '')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                    {isMine ? 'You' : displayNameOf(member, row.userId)}
                    {isMine && (
                      <span className="inline-flex items-center rounded-full bg-neon-blue/15 ring-1 ring-neon-blue/30 px-1 text-[8px] font-bold tracking-widest uppercase text-neon-blue leading-none">
                        You
                      </span>
                    )}
                  </p>
                  <p className="text-sm font-semibold text-foreground/95 truncate">
                    {row.player}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground tabular-nums">
                {row.position}
              </span>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-neon-blue">
                  R{row.round}
                </p>
                <p className="text-[9px] tracking-widest uppercase text-muted-foreground/70">
                  {row.yearOfKeep === 2 ? 'ADP · Yr 2' : 'Yr 1'}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function AddOptionControl({
  policy,
  onSubmit,
}: {
  policy: PollOptionPolicy
  onSubmit: (label: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-1.5 rounded-md border border-neon-pink/30 bg-neon-pink/[0.06] px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-neon-pink transition-colors hover:border-neon-pink/55 hover:bg-neon-pink/[0.12]"
      >
        <Hammer className="h-3 w-3" />
        Add an option
        <span className="text-muted-foreground/80 normal-case font-medium tracking-normal ml-1">
          {policy === 'curated' ? '(commish approves)' : '(goes live immediately)'}
        </span>
      </button>
    )
  }

  const submit = () => {
    if (draft.trim().length === 0) return
    onSubmit(draft.trim())
    setDraft('')
    setOpen(false)
  }

  return (
    <div className="space-y-2 rounded-md border border-neon-pink/30 bg-neon-pink/[0.04] p-3">
      <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-neon-pink">
        Add an option
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={
          policy === 'curated'
            ? 'Pitch an idea — commish reviews before it joins the vote'
            : 'Add your option — goes live immediately'
        }
        rows={2}
        className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-neon-pink/50 resize-none"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setDraft('')
          }}
          className="px-3 py-1.5 text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={draft.trim().length === 0}
          className="px-3 py-1.5 rounded-md text-[11px] font-bold tracking-widest uppercase text-primary-foreground bg-neon-pink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neon-pink/90 transition-colors"
        >
          {policy === 'curated' ? 'Submit for review' : 'Add option'}
        </button>
      </div>
    </div>
  )
}

// ─── Voter avatar stack ─────────────────────────────────────────────────────

/**
 * Horizontal -space-x-overlap stack of voter avatars. `rank` is optional
 * — when set (ranked polls), it's appended to the hover tooltip so users
 * can see who put this option at which position.
 */
function VoterStack({
  voters,
  membersById,
  highlightUserId,
  maxShown = 5,
  size = 'sm',
}: {
  voters: Array<{ userId: string; rank?: number }>
  membersById: Map<string, PollMember>
  /** When set, this user's avatar floats to the front of the stack with
   *  a brighter neon-blue ring so viewers can spot themselves. */
  highlightUserId?: string
  maxShown?: number
  size?: 'xs' | 'sm'
}) {
  if (voters.length === 0) return null
  // Pin the highlight user (the viewer) to the front so they're always
  // visible even when the stack overflows past maxShown.
  const sorted = highlightUserId
    ? [...voters].sort((a, b) => {
        if (a.userId === highlightUserId && b.userId !== highlightUserId) return -1
        if (b.userId === highlightUserId && a.userId !== highlightUserId) return 1
        return 0
      })
    : voters
  const visible = sorted.slice(0, maxShown)
  const extra = sorted.length - visible.length
  const dim = size === 'xs' ? 'h-4 w-4' : 'h-5 w-5'
  const text = size === 'xs' ? 'text-[7px]' : 'text-[8px]'
  return (
    <div className="flex -space-x-1.5 shrink-0">
      {visible.map((v) => {
        const member = membersById.get(v.userId)
        const name = displayNameOf(member, v.userId)
        const initials = getInitials(member?.fullName ?? null, member?.email ?? '')
        const isMine = v.userId === highlightUserId
        return (
          <Avatar
            key={v.userId}
            className={cn(
              dim,
              isMine ? 'ring-2 ring-neon-blue' : 'ring-1 ring-black/60'
            )}
            title={
              (isMine ? 'You' : name) + (v.rank ? ` — #${v.rank}` : '')
            }
          >
            <AvatarImage src={member?.avatarUrl ?? undefined} alt={name} />
            <AvatarFallback className={cn('bg-primary text-primary-foreground font-bold', text)}>
              {initials}
            </AvatarFallback>
          </Avatar>
        )
      })}
      {extra > 0 && (
        <div
          className={cn(
            dim,
            text,
            'rounded-full bg-white/10 ring-1 ring-black/60 inline-flex items-center justify-center font-bold text-muted-foreground tabular-nums'
          )}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

// ─── Per-option voter list (third-level disclosure) ────────────────────────

function VoterList({
  voters,
  membersById,
  currentUserId,
  onCollapse,
}: {
  voters: Array<{ userId: string; rank?: number }>
  membersById: Map<string, PollMember>
  currentUserId: string
  /** Tapping anywhere in the list collapses it. */
  onCollapse: () => void
}) {
  return (
    <button
      type="button"
      onClick={onCollapse}
      aria-label="Collapse voter list"
      className="block w-full text-left rounded-md transition-colors hover:bg-white/[0.02]"
    >
    <ul className="mt-2 ml-1 space-y-1.5 border-l border-white/10 pl-2.5">
      {voters.map((v) => {
        const member = membersById.get(v.userId)
        const name = displayNameOf(member, v.userId)
        const isMine = v.userId === currentUserId
        return (
          <li
            key={v.userId + (v.rank ?? '')}
            className="flex items-center gap-2 text-[11px]"
          >
            <Avatar
              className={cn(
                'h-5 w-5',
                isMine ? 'ring-2 ring-neon-blue' : 'ring-1 ring-black/60'
              )}
            >
              <AvatarImage src={member?.avatarUrl ?? undefined} alt={name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-[8px] font-bold">
                {getInitials(member?.fullName ?? null, member?.email ?? '')}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                'truncate min-w-0 flex-1',
                isMine ? 'text-neon-blue font-semibold' : 'text-foreground/85'
              )}
            >
              {isMine ? 'You' : name}
            </span>
            {v.rank && (
              <span className="inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-white/[0.06] text-[9px] font-bold text-muted-foreground tabular-nums leading-none shrink-0">
                #{v.rank}
              </span>
            )}
          </li>
        )
      })}
    </ul>
    </button>
  )
}

// ─── Ranked options (tap-to-cycle) ──────────────────────────────────────────

function RankedOptions({
  poll,
  maxRanks,
  draftRankings,
  onTap,
}: {
  poll: LeaguePoll
  maxRanks: number
  draftRankings: RankedSelection[]
  onTap: (optionId: string) => void
}) {
  const rankByChoice = new Map<string, number>()
  for (const r of draftRankings) rankByChoice.set(r.choiceId, r.rank)
  const atCap = draftRankings.length >= maxRanks

  // Build the "Your ranking: 1. X · 2. Y · 3. Z" summary in rank order.
  const orderedSummary = [...draftRankings]
    .sort((a, b) => a.rank - b.rank)
    .map((r) => poll.options.find((o) => o.id === r.choiceId))
    .filter((o): o is NonNullable<typeof o> => !!o)

  return (
    <div className="space-y-2">
      {/* Instruction or "Your ranking" preview */}
      <p className="text-[10px] tracking-widest uppercase text-muted-foreground/70 leading-tight">
        {orderedSummary.length === 0 ? (
          <>Tap your top {maxRanks} in order — most preferred first.</>
        ) : (
          <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground">Your ranking ·</span>
            {orderedSummary.map((o, i) => (
              <span key={o.id} className="inline-flex items-center gap-1 text-foreground/85 normal-case tracking-normal">
                <span className="inline-flex h-3.5 min-w-3.5 px-1 items-center justify-center rounded-full bg-neon-blue/20 text-[8px] font-bold text-neon-blue tabular-nums leading-none">
                  {i + 1}
                </span>
                <span className="truncate max-w-[12rem]">{o.label}</span>
              </span>
            ))}
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {poll.options.map((o) => {
          const rank = rankByChoice.get(o.id)
          const isRanked = rank != null
          const disabled = !isRanked && atCap
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onTap(o.id)}
              disabled={disabled}
              title={o.hint}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                isRanked
                  ? 'border-neon-blue/60 bg-neon-blue text-primary-foreground'
                  : 'border-white/10 bg-white/[0.02] text-foreground/80 hover:bg-white/[0.06]',
                disabled && 'opacity-40 cursor-not-allowed'
              )}
            >
              {isRanked && (
                <span className="inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-neon-blue text-[9px] font-bold text-black tabular-nums leading-none">
                  {rank}
                </span>
              )}
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

