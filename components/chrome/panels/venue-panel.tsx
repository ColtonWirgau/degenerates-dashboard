'use client'

/**
 * THE ROOM — where the draft actually happens.
 *
 * The hero's venue name used to open its line in the book, which is the
 * right answer to "what did we decide" and the wrong one to "where am I
 * going on Monday". A charter line can tell you the league picked Don
 * Christos. It can't put it on a map, dial it, or hand the address to
 * the maps app you actually use.
 *
 * So: the place, and the two things you do with a place — look at it,
 * and go to it. Both maps apps, because which one you want is a fact
 * about your phone and not something this app gets to decide, and a
 * copy button under them for the times the answer is neither (texting
 * it to somebody, pasting it into a rideshare).
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Check, Copy, Loader2, MapPin, Pencil, Phone } from 'lucide-react'
import { setDraftEvent } from '@/app/actions/charter'
import type { CharterEntry } from '@/lib/data/mock-charter'
import { cn } from '@/lib/utils'

export function VenuePanel({
  leagueId,
  season,
  entry,
  dateEntry,
  canManage,
}: {
  leagueId: string
  season: string
  /** The `draft-location` line. Null if the charter has no such row. */
  entry: CharterEntry | null
  /** The `draft-date` line — WHEN, on the same sheet as WHERE. It's one
   *  event; you don't go somewhere else to find out what time it
   *  starts. Read-only here: the date is decided by a poll, so a pencil
   *  that set it would be quietly skipping the vote. */
  dateEntry: CharterEntry | null
  canManage: boolean
}) {
  const [editing, setEditing] = useState(false)

  if (!entry) {
    return (
      <p className="text-muted-foreground px-1 py-4 text-xs italic">
        No draft location on the books yet.
      </p>
    )
  }

  const name = entry.value?.trim() || null
  const when =
    dateEntry?.status === 'locked' ? dateEntry.value?.trim() || null : null
  const venue = entry.metadata?.venue
  const address = venue?.address?.trim() || null
  const phone = venue?.phone?.trim() || null
  const hasPoint = venue?.lat != null && venue?.lng != null

  // What a maps app should search for. The NAME matters as much as the
  // street: "Don Christos, 41 Mulberry St" lands on the business, while
  // the street alone lands on the pavement outside it.
  const query = [name, address].filter(Boolean).join(', ')

  return (
    <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* No eyebrow. The other panels need one because their subject is
          a category — SEASON, THE LEG — but this one's subject has a
          NAME, and a label over it saying what kind of thing it is is
          the same telling twice. */}
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-foreground text-3xl leading-[0.95] tracking-tight uppercase">
            {name ?? 'Venue TBD'}
          </h2>
          <p
            className={cn(
              'mt-1.5 flex items-center gap-2 text-[11px] font-bold tracking-[0.22em] uppercase',
              when ? 'text-neon-blue/85' : 'text-muted-foreground/60'
            )}
          >
            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            {when ?? 'Date still up for a vote'}
          </p>
        </div>

        {/* A pencil, top right, where a thing you're looking at keeps
            its edit. The full-width button at the bottom read as the
            panel's conclusion — the last and therefore most important
            thing on it — when it's the least. */}
        {canManage && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={address ? 'Edit the venue details' : 'Add the venue details'}
            className="text-muted-foreground/60 hover:text-neon-blue hover:border-neon-blue/30 shrink-0 rounded-full border border-white/10 p-2 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <VenueForm
          leagueId={leagueId}
          season={season}
          entry={entry}
          dateEntry={dateEntry}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <Map query={query} lat={venue?.lat} lng={venue?.lng} located={hasPoint} />

          <div className="mt-4 space-y-2">
            {address ? (
              <p className="text-foreground/90 flex items-start gap-2.5 text-sm leading-snug">
                <MapPin className="text-muted-foreground/70 mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">{address}</span>
              </p>
            ) : (
              <p className="text-muted-foreground flex items-start gap-2.5 text-sm italic">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                No address yet.
              </p>
            )}

            {phone && (
              // A real tel: link. On a phone this is the whole feature;
              // on a desktop it hands off to whatever handles calls.
              <a
                href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                className="text-foreground/90 hover:text-neon-blue flex items-center gap-2.5 text-sm transition-colors"
              >
                <Phone className="text-muted-foreground/70 h-4 w-4 shrink-0" />
                {phone}
              </a>
            )}

            {venue?.note && (
              <p className="text-muted-foreground border-l-2 border-white/10 pl-3 text-[13px] leading-snug italic">
                {venue.note}
              </p>
            )}
          </div>

          {query && (
            <div className="mt-5">
              <div className="grid grid-cols-2 gap-2">
                <MapLink
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
                  label="Google Maps"
                />
                <MapLink
                  href={`https://maps.apple.com/?q=${encodeURIComponent(query)}`}
                  label="Apple Maps"
                />
              </div>
              {/* Centred, and wearing nothing. Two bordered buttons and
                  then a third would read as three equal choices; this
                  is the quiet one you reach for when neither app is the
                  answer. */}
              <CopyButton text={query} />
            </div>
          )}

        </>
      )}
    </div>
  )
}

/**
 * The map.
 *
 * OpenStreetMap's embed, because it needs no API key and this app has
 * none. It ships light, so it's inverted into the app's dark — the
 * hue-rotate puts the greens and blues back the right way round after
 * the invert flips them.
 */
function Map({
  query,
  lat,
  lng,
  located,
}: {
  query: string
  lat?: number
  lng?: number
  located: boolean
}) {
  if (!located || lat == null || lng == null) {
    return (
      <div className="flex h-40 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02]">
        <p className="text-muted-foreground/70 px-6 text-center text-xs italic">
          {query
            ? "Couldn't find this address on a map — the links below still work."
            : 'Add an address to put this on a map.'}
        </p>
      </div>
    )
  }

  // A tight box around the point: roughly 300m, which frames the block
  // rather than the city.
  const d = 0.0025
  const bbox = [lng - d, lat - d, lng + d, lat + d].join(',')

  return (
    <div className="shrink-0">
      <div className="relative h-44 overflow-hidden rounded-xl border border-white/10">
        {/* Taller than its window and nudged up, so OSM's own credit bar
            — a pale strip with two lines of links in it — falls off the
            bottom instead of lying across the map. The credit isn't
            dropped, it's moved: it's the line underneath, where it can
            be set in this app's own type. */}
        <iframe
          title="Map"
          loading="lazy"
          referrerPolicy="no-referrer"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
          className="absolute -top-5 left-0 h-[calc(100%+60px)] w-full [filter:invert(1)_hue-rotate(180deg)_brightness(0.85)_contrast(1.05)_saturate(0.7)]"
        />
        {/* A wash of the app's own blue over the top, so the map belongs
            to this page instead of sitting in it like a screenshot. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[rgba(0,217,255,0.06)] mix-blend-overlay"
        />
      </div>
      <p className="text-muted-foreground/40 mt-1 text-right text-[9px] tracking-wider uppercase">
        Map ©{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-muted-foreground underline underline-offset-2"
        >
          OpenStreetMap
        </a>
      </p>
    </div>
  )
}

function MapLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-foreground/90 hover:border-neon-blue/40 hover:text-neon-blue flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-[11px] font-bold tracking-[0.12em] uppercase transition-colors"
    >
      {label}
    </a>
  )
}

/**
 * Copy, with the only feedback a copy button can honestly give: it
 * happened.
 *
 * The mark swaps rather than the label changing width, so nothing under
 * it moves; the whole thing lifts a hair and settles. Two seconds, then
 * it forgets — a button still saying "Copied" a minute later is lying
 * about the clipboard.
 */
function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  return (
    <div className="mt-2 flex justify-center">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text)
          } catch {
            return
          }
          setDone(true)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => setDone(false), 2000)
        }}
        aria-label={`Copy the address${done ? ' — copied' : ''}`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-[0.22em] uppercase',
          'transition-[color,transform] duration-200 ease-out active:scale-95',
          done
            ? 'text-neon-blue -translate-y-0.5'
            : 'text-muted-foreground/70 hover:text-foreground'
        )}
      >
        <span key={done ? 'done' : 'idle'} className="face-pop inline-flex">
          {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </span>
        {done ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

/**
 * The commish's side — the whole event on one form.
 *
 * The NAME and the DATE are decisions and the rest are facts about the
 * room, which is a real distinction and not one worth making somebody
 * navigate. Saving them together settles the two rows outright; the
 * charter's propose-and-approve path is still there for anyone who
 * isn't a commissioner, which is the point of having a rule at all.
 */
function VenueForm({
  leagueId,
  season,
  entry,
  dateEntry,
  onDone,
}: {
  leagueId: string
  season: string
  entry: CharterEntry
  dateEntry: CharterEntry | null
  onDone: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const v = entry.metadata?.venue
  // The pickers seed from the stored halves when they exist, and from
  // the PROSE when they don't — every league that predates this form
  // has only the prose, and opening the editor to blank fields would
  // read as "there is no date" for a draft that has one.
  const seeded = whenParts(dateEntry, season)
  const [name, setName] = useState(entry.value ?? '')
  const [date, setDate] = useState(seeded.date)
  const [time, setTime] = useState(seeded.time)
  const [address, setAddress] = useState(v?.address ?? '')
  const [phone, setPhone] = useState(v?.phone ?? '')
  const [note, setNote] = useState(v?.note ?? '')
  const [videoUrl, setVideoUrl] = useState(v?.videoUrl ?? '')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          setError(null)
          const res = await setDraftEvent({
            leagueId,
            season,
            entryId: entry.id,
            dateEntryId: dateEntry?.id ?? null,
            name,
            date,
            time,
            address,
            phone,
            note,
            videoUrl,
          })
          if (!res.success) {
            setError(res.error ?? 'Could not save')
            return
          }
          router.refresh()
          onDone()
        })
      }}
      className="space-y-3"
    >
      <Field label="Place" value={name} onChange={setName} placeholder="Don Christos" />

      {dateEntry && (
        // Native pickers. The stored value is prose — "Mon, Aug 31 ·
        // 8:30pm" — because that's what the hero and the book print,
        // but nobody should have to type prose in a format a regex
        // will silently reject.
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date" value={date} onChange={setDate} type="date" placeholder="" />
          <Field label="Time" value={time} onChange={setTime} type="time" placeholder="" />
        </div>
      )}

      <Field
        label="Address"
        value={address}
        onChange={setAddress}
        placeholder="51748 Van Dyke Ave, Shelby Township, MI"
      />
      <Field label="Phone" value={phone} onChange={setPhone} type="tel" placeholder="(586) 580-3546" />
      <Field label="Note" value={note} onChange={setNote} placeholder="Back room — ask for Sal" />
      <Field
        label="Backdrop video"
        value={videoUrl}
        onChange={setVideoUrl}
        placeholder="/media/don-christos.mp4"
      />

      {error && <p className="text-destructive text-[11px]">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="bg-neon-blue/15 text-neon-blue border-neon-blue/40 hover:bg-neon-blue/25 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors disabled:opacity-50"
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin" />}
          Save
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-muted-foreground hover:text-foreground px-2 py-1.5 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors"
        >
          Cancel
        </button>
      </div>
      <p className="text-muted-foreground/60 text-[11px] leading-snug">
        Saving looks the address up to place the map, and settles the
        place and date on the books. The maps links work either way.
      </p>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 block text-[10px] font-bold tracking-[0.22em] uppercase">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-foreground placeholder:text-muted-foreground/40 focus:border-neon-blue/50 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none transition-colors"
      />
    </label>
  )
}

/**
 * The date pickers' starting values.
 *
 * `metadata.when` is authoritative when it's there. When it isn't —
 * every entry written before this form existed — the display string is
 * all there is, so it gets parsed: "Mon, Aug 31 · 8:30pm". The YEAR
 * isn't in it, and can't be: it comes from the season, whose first year
 * covers Jul–Dec and whose second covers Jan–Jun.
 *
 * A parse that fails returns blanks, and blanks mean "leave the date
 * alone" on save rather than "clear it".
 */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function whenParts(
  dateEntry: CharterEntry | null,
  season: string
): { date: string; time: string } {
  const stored = dateEntry?.metadata?.when
  if (stored?.date) return { date: stored.date, time: stored.time ?? '' }

  const raw = dateEntry?.value?.trim()
  if (!raw) return { date: '', time: '' }

  const m = /([A-Za-z]{3,})\.?\s+(\d{1,2})/.exec(raw)
  if (!m) return { date: '', time: '' }
  const month = MONTHS.indexOf(m[1]!.slice(0, 3).toLowerCase())
  if (month < 0) return { date: '', time: '' }
  const day = Number(m[2])

  const [first, second] = season.split('-')
  const year = Number(month >= 6 ? first : (second ?? first))
  if (!Number.isFinite(year)) return { date: '', time: '' }

  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${year}-${pad(month + 1)}-${pad(day)}`

  const t = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(raw)
  if (!t) return { date, time: '' }
  let h = Number(t[1]) % 12
  if (t[3]!.toLowerCase() === 'pm') h += 12
  return { date, time: `${pad(h)}:${t[2] ?? '00'}` }
}
