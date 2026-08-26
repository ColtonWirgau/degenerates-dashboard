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
 * and a stub strip underneath carrying the small print. The halves are
 * the week and the room; the date rides with the room, because when and
 * where are one thought and the seam is not the place to split it.
 *
 * A matchup needs a VS because the two sides are opposed and the word is
 * the whole relationship. PRESEASON and DON CHRISTOS aren't opposed —
 * the slant already says they're one band — so the disc that sat on the
 * seam was a joint being pointed at.
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

import { CalendarDays, ChevronLeft } from 'lucide-react'
import { openCharterGroup, openPanel } from '@/components/chrome/canvas-store'
import { cn } from '@/lib/utils'
import type { CharterEntry } from '@/lib/data/mock-charter'

/**
 * WHERE THE DIAGONAL FALLS — and why these are written out longhand.
 *
 * The ROOM's half is deliberately narrower than half. object-cover on a
 * 9:1 slot from 16:9 footage crops away four fifths of the frame's
 * height, so the WIDER that half gets the LESS of the room you can
 * actually see. But it still has to hold a venue's name — at 700px, 36%
 * is 250px and DON CHRISTOS doesn't fit — so it only reaches its
 * narrowest once there's width to spare.
 *
 * These are literal strings on purpose. Tailwind reads the source as
 * text: a class built from a template literal is invisible to it and no
 * CSS is generated, which is exactly what happened here — the whole
 * right-hand half disappeared at every size. The seam is one number
 * repeated in four places, so it's stated once here, in full, and the
 * two that must agree sit on adjacent lines.
 *
 *   the slant:   46px
 *   the seam:    52% at sm, 64% at lg
 */
/** The one line both eyebrows sit on. Centring each half separately put
 *  them a few pixels apart, because the two halves hold different-sized
 *  words underneath — close enough to look like a mistake rather than a
 *  choice. Below sm the halves stack and each flows normally. */
const EYEBROW_LINE = 'sm:absolute sm:top-9 lg:top-11'

const SEAM_WIDTH = 'sm:w-[52%] lg:w-[64%]'
const SEAM_CLIP =
  'sm:[clip-path:polygon(0_0,100%_0,calc(100%-46px)_100%,0_100%)]'
const FOOTAGE_LEFT = 'sm:left-[calc(52%-46px)] lg:left-[calc(64%-46px)]'
const FOOTAGE_CLIP = 'sm:[clip-path:polygon(46px_0,100%_0,100%_100%,0_100%)]'

export interface DraftHeroEntry {
  id: string
  key: string
  value: string | null
  status: 'draft' | 'pending' | 'locked'
  /** `draft-location` carries the room's own details here, including
   *  which footage plays behind its half of the band. */
  metadata?: CharterEntry['metadata']
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
      <div className="relative flex flex-col overflow-hidden sm:h-[10.5rem] sm:flex-row sm:items-stretch lg:h-[12.5rem]">
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
          className={cn(
            'group relative z-20 flex w-full flex-col items-start justify-center px-4 py-5 text-left transition-[filter] hover:brightness-110 sm:shrink-0 sm:py-0 sm:pr-12 lg:pl-20',
            SEAM_WIDTH,
            SEAM_CLIP
          )}
          style={{
            // Opaque base, THEN the tint. A translucent panel would let
            // the footage through the half that's meant to be ink.
            backgroundColor: '#0A0A0A',
            backgroundImage:
              'linear-gradient(115deg, rgba(0,217,255,0.22), rgba(0,217,255,0.06) 62%, rgba(0,217,255,0.02))',
          }}
        >
          {/* The half was already the door to the week list — every
              week's corner slab is — but nothing said so, and a control
              nobody can see is not a control. It sits in the eyebrow
              slot, which makes both halves the same shape: a small line
              over a big word.

              Not "back": the list isn't somewhere you came from, it's
              the other weeks, and the chevron points the way the panel
              actually arrives from. */}
          <span
            className={cn(
              'text-muted-foreground/60 group-hover:text-neon-blue mb-1.5 inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.28em] uppercase transition-colors',
              EYEBROW_LINE,
              'sm:left-4 lg:left-20'
            )}
          >
            <ChevronLeft className="h-3 w-3" />
            All weeks
          </span>
          <span className="font-display text-foreground text-4xl leading-[0.85] tracking-tight uppercase sm:text-5xl lg:text-6xl">
            Preseason
          </span>
        </button>

        {/* WHEN AND WHERE, over the room itself — and the whole half is
            the door.

            It was two buttons sitting on a picture, which meant the
            picture was the biggest thing on the band and the only part
            of it that did nothing: you had to find the words. The half
            IS the room, footage and all, so pressing any of it opens
            the room. It also opens ONE sheet — the date and the place
            are one event, and two doors an inch apart leading to two
            different panels was the hero disagreeing with itself. */}
        <button
          type="button"
          onClick={() => openPanel('venue')}
          aria-label={`The draft — ${w.raw ?? 'date not set'}, ${where ?? 'venue not set'}. Opens the room.`}
          className="group relative z-10 flex min-w-0 flex-1 flex-col items-start justify-center px-4 py-5 text-left transition-[filter] hover:brightness-125 sm:items-end sm:py-0 sm:pl-14 sm:text-right lg:pr-20"
        >
          <span
            className={cn(
              'relative z-10 mb-1.5 max-w-full truncate text-[11px] font-bold tracking-[0.28em] uppercase transition-colors',
              EYEBROW_LINE,
              'sm:right-4 lg:right-20',
              w.day
                ? 'text-neon-blue/85 group-hover:text-neon-blue'
                : 'text-muted-foreground/60 group-hover:text-muted-foreground'
            )}
          >
            {w.day
              ? [w.weekday, `${w.month} ${w.day}`, w.time].filter(Boolean).join(' · ')
              : (w.raw ?? 'Date TBD')}
          </span>
          <span
            className={cn(
              'font-display relative z-10 max-w-full truncate text-3xl leading-[0.9] tracking-tight uppercase sm:text-4xl lg:text-5xl',
              where ? 'text-foreground' : 'text-foreground/40'
            )}
          >
            {where ?? 'Venue TBD'}
          </span>
        </button>

      </div>

      {/* THE STUB. Everything a ticket prints in small type along the
          bottom, and the perforation to sell it. */}
      <div className="flex items-center gap-4 border-y border-white/10 bg-[#0A0A0A]/70 px-4 py-2 lg:px-20">
        <CalendarDays className="text-muted-foreground/50 hidden h-3.5 w-3.5 shrink-0 sm:block" />
        <button
          type="button"
          onClick={() => openEntry('draft-format')}
          className="text-muted-foreground hover:text-foreground -my-2 min-w-0 truncate py-2 text-[10px] font-bold tracking-[0.22em] uppercase transition-colors"
        >
          {format ?? 'Format not settled'}
        </button>
        <span aria-hidden className="text-muted-foreground/30 text-[10px]">
          ·
        </span>
        <span className="text-muted-foreground shrink-0 text-[10px] font-bold tracking-[0.22em] uppercase">
          {memberCount} teams
        </span>
        {/* The league's name is the first thing to go: it's the least
            useful of the four and the only one that can't be shortened
            without lying. */}
        <span className="text-muted-foreground/50 ml-auto hidden min-w-0 truncate text-[10px] font-bold tracking-[0.22em] uppercase lg:block">
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
  // Deliberately not configurable. A URL field with no upload behind it
  // means a deploy per venue — which is not self-serve, just a sharper
  // edge: a hotlink that dies leaves half the band black. The clip is
  // bundled until there's somewhere to put an uploaded one.
  return (
    <span
      aria-hidden
      className={cn(
        // Below sm the band is stacked, so the footage takes the bottom
        // half and there's no diagonal to match.
        'absolute inset-x-0 top-1/2 bottom-0 overflow-hidden sm:inset-y-0 sm:right-0 sm:top-0',
        FOOTAGE_LEFT,
        FOOTAGE_CLIP
      )}
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        poster="/media/don-christos.jpg"
        preload="metadata"
        className="h-full w-full object-cover opacity-[0.65] motion-reduce:hidden"
        style={{ objectPosition: 'center 52%', filter: 'blur(2px)' }}
      >
        <source src="/media/don-christos.mp4" type="video/mp4" />
      </video>
      <span
        className="absolute inset-0 hidden opacity-[0.65] motion-reduce:block"
        style={{
          backgroundImage: "url('/media/don-christos.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center 52%',
          filter: 'blur(2px)',
        }}
      />
      {/* Ink under the WORDS, which are at the outer edge — so the
          gradient runs the other way from the one you'd guess: open at
          the seam, where there's nothing but room, and heaviest under
          DON CHRISTOS. It ran the other way for a while, which put the
          only legible part of the footage behind the only text. */}
      <span className="absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/15 via-[#0A0A0A]/40 to-[#0A0A0A]/82" />
      <span className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/45 to-transparent" />
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
