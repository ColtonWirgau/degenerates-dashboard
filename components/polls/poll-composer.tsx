'use client'

/**
 * ASK THE LEAGUE — opening a question on a week.
 *
 * Closed, it's the dashed add-card the app uses everywhere something can
 * be appended (the season panel's invite tile, the charter's add-entry
 * control). Open, it becomes the form, in place — so asking a question
 * happens where the questions are rather than in a modal over the top of
 * them.
 *
 * Deliberately short. The server fills the prompt from the title when
 * one isn't given, so there's no second text box to leave empty; kind and
 * topic are pills because they have three and six answers respectively
 * and a select for that is a menu you have to open to read.
 */

import { useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { createPollForWeek } from '@/app/actions/polls'
import { cn } from '@/lib/utils'

type Topic = 'punishment' | 'payout' | 'rules' | 'season' | 'fun' | 'logistics'
type Kind = 'single' | 'multi' | 'ranked'

const TOPICS: Array<{ value: Topic; label: string }> = [
  { value: 'season', label: 'Season' },
  { value: 'rules', label: 'Rules' },
  { value: 'punishment', label: 'Punishment' },
  { value: 'payout', label: 'Payout' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'fun', label: 'Fun' },
]

const KINDS: Array<{ value: Kind; label: string; hint: string }> = [
  { value: 'single', label: 'Pick one', hint: 'One answer each' },
  { value: 'multi', label: 'Pick any', hint: 'As many as they like' },
  { value: 'ranked', label: 'Rank top 3', hint: '3pts, 2pts, 1pt' },
]

export function AskTheLeague({
  leagueId,
  nflWeekId,
  onCreated,
}: {
  leagueId: string
  nflWeekId: string
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState<Topic>('season')
  const [kind, setKind] = useState<Kind>('single')
  const [anyoneAdds, setAnyoneAdds] = useState(false)
  const [options, setOptions] = useState<string[]>(['', ''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setTitle('')
    setTopic('season')
    setKind('single')
    setAnyoneAdds(false)
    setOptions(['', ''])
    setError(null)
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-neon-pink hover:border-neon-pink/40 hover:bg-neon-pink/[0.04] flex min-h-[5.5rem] items-center justify-center gap-2 rounded-xl border border-dashed border-white/12 transition-colors"
      >
        <Plus className="h-4 w-4" />
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase">
          Ask the league
        </span>
      </button>
    )
  }

  const filled = options.map((o) => o.trim()).filter(Boolean)
  // An open-option poll can start empty — the league fills it in. A
  // closed one with nothing to pick is a dead end, so the server refuses
  // it and so does the button.
  const enough = anyoneAdds || filled.length >= 2
  const canSubmit = title.trim().length > 0 && enough && !busy

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const res = await createPollForWeek({
      leagueId,
      nflWeekId,
      title: title.trim(),
      prompt: '',
      topic,
      kind,
      optionPolicy: anyoneAdds ? 'open' : 'closed',
      options: filled,
    })
    setBusy(false)
    if (!res.success) {
      setError(res.error ?? 'Could not open the vote')
      return
    }
    reset()
    onCreated()
  }

  return (
    <div className="border-neon-pink/30 bg-neon-pink/[0.04] space-y-3 rounded-xl border p-3 xl:col-span-2">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-foreground/80 text-sm leading-none tracking-tight uppercase">
          Ask the league
        </h3>
        <button
          type="button"
          onClick={reset}
          aria-label="Cancel"
          className="text-muted-foreground hover:text-foreground ml-auto"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What's the question?"
        maxLength={140}
        className="placeholder:text-muted-foreground/50 focus:border-neon-pink/50 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
      />

      <Pills
        label="Kind"
        options={KINDS.map((k) => ({ value: k.value, label: k.label, hint: k.hint }))}
        value={kind}
        onChange={(v) => setKind(v as Kind)}
      />
      <Pills
        label="Topic"
        options={TOPICS}
        value={topic}
        onChange={(v) => setTopic(v as Topic)}
      />

      <div className="space-y-1.5">
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.28em] uppercase">
          Options
        </p>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              value={o}
              onChange={(e) =>
                setOptions((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
              }
              placeholder={`Option ${i + 1}`}
              maxLength={120}
              className="placeholder:text-muted-foreground/40 focus:border-neon-pink/40 min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[13px] outline-none"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                aria-label={`Remove option ${i + 1}`}
                className="text-muted-foreground/60 hover:text-destructive shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setOptions((prev) => [...prev, ''])}
          className="text-muted-foreground hover:text-neon-pink inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase transition-colors"
        >
          <Plus className="h-3 w-3" />
          Another option
        </button>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={anyoneAdds}
          onChange={(e) => setAnyoneAdds(e.target.checked)}
          className="accent-neon-pink h-3.5 w-3.5"
        />
        <span className="text-foreground/80">Let anyone add options</span>
        <span className="text-muted-foreground/60">
          — they go live straight away
        </span>
      </label>

      {error && <p className="text-destructive text-[11px]">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="bg-neon-pink/15 text-neon-pink border-neon-pink/40 hover:bg-neon-pink/25 inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[11px] font-bold tracking-wider uppercase transition-colors disabled:opacity-40"
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin" />}
          Open the vote
        </button>
        {!enough && (
          <span className="text-muted-foreground/60 text-[10px]">
            Two options, or let anyone add them
          </span>
        )}
      </div>
    </div>
  )
}

/** A row of small choices — used where a select would make you open a
 *  menu to find out what the answers even are. */
function Pills({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<{ value: string; label: string; hint?: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.28em] uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              title={o.hint}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase transition-colors',
                on
                  ? 'border-neon-pink/60 bg-neon-pink/15 text-neon-pink'
                  : 'text-muted-foreground border-white/10 hover:border-white/25'
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
