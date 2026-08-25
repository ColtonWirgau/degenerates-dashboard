'use client'

/**
 * THE DRAFT, as the page's hero — a fixture band, not a title bar.
 *
 * Week 1 opens with a number and a state and then gets on with the
 * slate. Week 0 was doing the same thing, which meant its one dated
 * event — the only thing on the whole page with a time and a place —
 * was a card in the body, underneath a header that said nothing the
 * page didn't already say.
 *
 * So the header IS the fixture, built the way a matchup is: a two-tone
 * band split on a diagonal, the two halves set big in the display face,
 * a disc on the seam holding the word that joins them, and a stub strip
 * underneath carrying the small print. The halves are the week and the
 * room, and the word between them is AT — the date rides with the room,
 * because when and where are one thought and the seam is not the place
 * to split it.
 *
 * The venue side is the venue: the footage is Don Christos, playing
 * behind its own name. It spent a version behind the WHOLE card, where
 * it was a warm blur with a glass in it that meant nothing; here it is
 * the room the thing is happening in. Slowed by half in the encode, so
 * the smoke drifts rather than scuds.
 *
 * FULL BLEED. Negative margins cancel the page gutter and the top
 * padding so the band reaches all four card edges; the card's own
 * clip-path rounds its top corners and takes the bubble bites out of it,
 * so there's nothing to round or notch by hand. The gutter number is
 * paired — see the note on <main> in the league page.
 *
 * It degrades. Every value is free text somebody typed and each one
 * fails on its own: an unparseable date prints raw, a missing one says
 * TBD, and the strip admits what it hasn't got. A league that has
 * settled nothing still gets a hero.
 */

import { CalendarDays } from 'lucide-react'
import { openCharterGroup, openPanel } from '@/components/chrome/canvas-store'
import { cn } from '@/lib/utils'

export interface DraftHeroEntry {
  id: string
  key: string
  value: string | null
  status: 'draft' | 'pending' | 'locked'
}

export interface DraftHeroProps {
  /** The Draft topic's charter rows. Values are free text; ids are what
   *  the book needs to page to one of them. */
  entries: DraftHeroEntry[]
  leagueName: string
  /** How many people are in it — the stub's right-hand fact. */
  memberCount: number
}

/** "Mon, Aug 31 · 8:30pm" → its parts; anything unrecognised comes back whole. */
function parseWhen(value: string | null) {
  if (!value) return { weekday: null, month: null, day: null, time: null, raw: null }
  const m = value.match(
    /^\s*(\w{3})\w*,?\s+(\w{3})\w*\.?\s+(\d{1,2})\s*(?:·|-|—|@|at)?\s*(.*)$/i
  )
  if (!m) return { weekday: null, month: null, day: null, time: null, raw: value }
  return {
    weekday: m[1]!.toUpperCase(),
    month: m[2]!.toUpperCase(),
    day: m[3]!,
    time: m[4]?.trim().toUpperCase() || null,
    raw: value,
  }
}

export function DraftHero({ entries, leagueName, memberCount }: DraftHeroProps) {
  // Only a SETTLED row is a fact. An unsettled one reads as absent, and
  // each half says so in its own words rather than printing a blank.
  const valueOf = (key: string) => {
    const e = entries.find((x) => x.key === key)
    return e && e.status === 'locked' ? e.value : null
  }
  const w = parseWhen(valueOf('draft-date'))
  const where = valueOf('draft-location')
  const format = valueOf('draft-format')

  // The week list lives behind the left half, the same door every other
  // week's corner slab is; the other two open the book at their line —
  // by id, because that's what the panel resolves against.
  const openWeeks = () => openPanel('slate')
  const openEntry = (key: string) =>
    openCharterGroup('Draft', entries.find((x) => x.key === key)?.id)

  return (
    <section aria-label="Draft day" className="relative -mx-4 -mt-8 mb-8 lg:-mx-20">
      <h1 className="sr-only">Preseason</h1>
      {/* THE BAND. The footage spans the WHOLE of it and the WHEN half
          is painted over the top — so the diagonal is the only seam in
          the picture. Sitting it inside the right-hand half instead left
          a hard vertical edge where the video started, cutting across
          the slant it was supposed to be hidden behind. */}
      <div className="relative flex h-[9.5rem] items-stretch overflow-hidden lg:h-[11.5rem]">
        <VenueFootage />
        {/* THE WEEK — its name, and the door to the list of them. Tinted
            and slanted, the same slab grammar every other week's corner
            uses, grown to half a hero. It held the date for a while,
            which put the two facts about the draft on opposite sides of
            the seam from each other; they belong together, on the side
            with the room in it. */}
        <button
          type="button"
          onClick={openWeeks}
          aria-label="Preseason — open the week list"
          className="group relative z-20 flex w-[58%] shrink-0 flex-col items-start justify-center pr-12 pl-4 text-left transition-[filter] hover:brightness-110 sm:w-[54%] lg:pl-20"
          style={{
            clipPath: 'polygon(0 0, 100% 0, calc(100% - 46px) 100%, 0 100%)',
            // Opaque base, THEN the tint. A translucent panel would let
            // the footage through the half that's meant to be ink.
            backgroundColor: '#0A0A0A',
            backgroundImage:
              'linear-gradient(115deg, rgba(0,217,255,0.22), rgba(0,217,255,0.06) 62%, rgba(0,217,255,0.02))',
          }}
        >
          <span className="font-display text-foreground text-4xl leading-[0.85] tracking-tight uppercase sm:text-5xl lg:text-6xl">
            Preseason
          </span>
        </button>

        {/* WHEN AND WHERE, over the room itself. Two controls rather
            than one: each fact opens its own line in the book, and a
            date that opened the LOCATION entry because it happened to
            sit inside that button is the kind of thing nobody notices
            until they're editing the wrong row. */}
        <div className="relative z-10 flex min-w-0 flex-1 flex-col items-end justify-center pr-4 pl-14 text-right lg:pr-20">
          <button
            type="button"
            onClick={() => openEntry('draft-date')}
            aria-label={`Draft date — ${w.raw ?? 'not set'}`}
            className={cn(
              'relative z-10 mb-1.5 max-w-full truncate text-[11px] font-bold tracking-[0.28em] uppercase transition-colors',
              w.day
                ? 'text-neon-blue/85 hover:text-neon-blue'
                : 'text-muted-foreground/60 hover:text-muted-foreground'
            )}
          >
            {w.day
              ? [w.weekday, `${w.month} ${w.day}`, w.time].filter(Boolean).join(' · ')
              : (w.raw ?? 'Date TBD')}
          </button>
          <button
            type="button"
            onClick={() => openEntry('draft-location')}
            aria-label={`Draft location — ${where ?? 'not set'}`}
            className={cn(
              'font-display relative z-10 max-w-full truncate text-3xl leading-[0.9] tracking-tight uppercase transition-[filter] hover:brightness-125 sm:text-4xl lg:text-5xl',
              where ? 'text-foreground' : 'text-foreground/40'
            )}
          >
            {where ?? 'Venue TBD'}
          </button>
        </div>

        {/* THE SEAM. A disc on the join, holding the word that makes the
            two halves one sentence: Aug 31 AT Don Christos. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-[58%] z-30 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#0A0A0A] sm:left-[54%] lg:size-12"
        >
          <span className="font-display text-muted-foreground text-sm tracking-widest">
            AT
          </span>
        </span>
      </div>

      {/* THE STUB. Everything a ticket prints in small type along the
          bottom, and the perforation to sell it. */}
      <div className="flex items-center gap-4 border-y border-white/10 bg-[#0A0A0A]/70 px-4 py-2 lg:px-20">
        <CalendarDays className="text-muted-foreground/50 hidden h-3.5 w-3.5 shrink-0 sm:block" />
        <button
          type="button"
          onClick={() => openEntry('draft-format')}
          className="text-muted-foreground hover:text-foreground min-w-0 truncate text-[10px] font-bold tracking-[0.22em] uppercase transition-colors"
        >
          {format ?? 'Format not settled'}
        </button>
        <span aria-hidden className="text-muted-foreground/30 hidden text-[10px] sm:inline">
          ·
        </span>
        <span className="text-muted-foreground hidden shrink-0 text-[10px] font-bold tracking-[0.22em] uppercase sm:inline">
          {memberCount} teams
        </span>
        <span className="text-muted-foreground/50 ml-auto min-w-0 truncate text-[10px] font-bold tracking-[0.22em] uppercase">
          {leagueName}
        </span>
        <Perforation />
      </div>
    </section>
  )
}

/**
 * DON CHRISTOS, behind its own name.
 *
 * Muted, looping and blurred — a room with something moving in it rather
 * than a video you watch. The gradient runs the other way from the
 * band's slant so the type stays on solid ink while the far edge opens
 * up. Reduced motion holds the same frame still.
 */
function VenueFootage() {
  return (
    <span aria-hidden className="absolute inset-0 overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="/media/don-christos.jpg"
        preload="metadata"
        className="h-full w-full object-cover opacity-45 motion-reduce:hidden"
        style={{ objectPosition: 'center 42%', filter: 'blur(3px)' }}
      >
        <source src="/media/don-christos.mp4" type="video/mp4" />
      </video>
      <span
        className="absolute inset-0 hidden opacity-45 motion-reduce:block"
        style={{
          backgroundImage: "url('/media/don-christos.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center 42%',
          filter: 'blur(3px)',
        }}
      />
      {/* Ink under the words. Heaviest at the seam, where the WHEN half
          is about to take over, and thinnest at the outer edge. */}
      <span className="absolute inset-0 bg-gradient-to-l from-[#0A0A0A]/35 via-[#0A0A0A]/70 to-[#0A0A0A]/95" />
      <span className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/60 to-transparent" />
    </span>
  )
}

/** The tear-off marks at the end of a ticket. Pure decoration. */
function Perforation() {
  return (
    <span aria-hidden className="hidden shrink-0 items-center gap-[3px] lg:flex">
      {[3, 7, 4, 9, 5, 8, 3, 6, 10, 4].map((h, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-white/20"
          style={{ height: `${h + 6}px` }}
        />
      ))}
    </span>
  )
}
