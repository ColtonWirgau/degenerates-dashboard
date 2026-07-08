'use client'

// Hand-coded SVG illustrations for the Season Setup group cards. One
// component per group — fully ownable, no AI fingerprint, animatable
// in CSS via `group-hover:` on the parent card. Built around a shared
// palette so the set stays cohesive as we fill it in.
//
// Style targets:
//   - Bold geometric shapes, flat fills, no photoreal shading.
//   - 100x100 viewBox so each illustration is independently scalable.
//   - Stroke widths ≥ 2 so they read at 72px without disappearing.
//   - Cyan/gold-forward — pink only as a small accent.

import type { ComponentType } from 'react'

// Pulled from app/globals.css "Cyberpunk Vegas" tokens. Keep these in
// sync if the brand palette ever moves.
const NAVY = '#0A0A0A' // --charcoal-deep / --background
const NAVY_2 = '#121212' // --charcoal-panel
const CYAN = '#00D9FF' // --electric-blue / --primary (dominant)
const GOLD = '#FFD700' // --gold (secondary)
const PINK = '#FF69B4' // --hot-pink (accent only)

interface ArtProps {
  className?: string
}

// ─── Draft — helmet sitting on a tilted draft board ────────────────────
// Composition mirrors the NB2 reference: cyan side-view helmet with a
// gold stripe centered over a wide gold draft-board grid. Helmet bobs
// on hover; board straightens.
export function DraftArt({ className }: ArtProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="100" height="100" fill={NAVY} />

      {/* Draft board — tilted, sits behind the helmet */}
      <g
        className="transition-transform duration-300 group-hover:rotate-0"
        style={{ transformOrigin: '50px 66px', transform: 'rotate(-4deg)' }}
      >
        <rect
          x="12"
          y="46"
          width="76"
          height="42"
          rx="2"
          fill={GOLD}
          stroke="#000"
          strokeWidth="2.5"
        />
        {/* Horizontal grid lines */}
        <line x1="12" y1="56" x2="88" y2="56" stroke="#000" strokeWidth="1.5" />
        <line x1="12" y1="66" x2="88" y2="66" stroke="#000" strokeWidth="1.5" />
        <line x1="12" y1="76" x2="88" y2="76" stroke="#000" strokeWidth="1.5" />
        {/* Vertical column dividers */}
        <line x1="37" y1="46" x2="37" y2="88" stroke="#000" strokeWidth="1.5" />
        <line x1="62" y1="46" x2="62" y2="88" stroke="#000" strokeWidth="1.5" />

        {/* Player-name bars per cell — top row */}
        <rect x="16" y="49.5" width="17" height="3" rx="0.5" fill={CYAN} />
        <rect x="41" y="49.5" width="17" height="3" rx="0.5" fill={PINK} />
        <rect x="66" y="49.5" width="17" height="3" rx="0.5" fill="#F9FAFB" />
        {/* Row 2 */}
        <rect x="16" y="59.5" width="17" height="3" rx="0.5" fill={PINK} opacity="0.85" />
        <rect x="41" y="59.5" width="17" height="3" rx="0.5" fill={CYAN} opacity="0.85" />
        <rect x="66" y="59.5" width="17" height="3" rx="0.5" fill={CYAN} opacity="0.85" />
        {/* Row 3 */}
        <rect x="16" y="69.5" width="17" height="3" rx="0.5" fill={CYAN} opacity="0.65" />
        <rect x="41" y="69.5" width="17" height="3" rx="0.5" fill="#F9FAFB" opacity="0.65" />
        <rect x="66" y="69.5" width="17" height="3" rx="0.5" fill={PINK} opacity="0.65" />
        {/* Row 4 */}
        <rect x="16" y="79.5" width="17" height="3" rx="0.5" fill={PINK} opacity="0.4" />
        <rect x="41" y="79.5" width="17" height="3" rx="0.5" fill={CYAN} opacity="0.4" />
        <rect x="66" y="79.5" width="17" height="3" rx="0.5" fill={CYAN} opacity="0.4" />
      </g>

      {/* Helmet — side view facing right, sits on top edge of the board */}
      <g
        className="transition-transform duration-300 group-hover:-translate-y-[2px]"
        style={{ transformOrigin: '48px 30px' }}
      >
        {/* Dome body */}
        <path
          d="M 22 30
             Q 22 8 42 8
             Q 62 8 68 22
             L 68 36
             Q 68 46 58 48
             L 34 48
             Q 22 46 22 30
             Z"
          fill={CYAN}
          stroke="#000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Gold center stripe over the top */}
        <path
          d="M 28 10 Q 46 4 64 16"
          stroke={GOLD}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        {/* Inner stripe edge for definition */}
        <path
          d="M 28 10 Q 46 4 64 16"
          stroke="#000"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 30 13 Q 46 8 62 18"
          stroke={GOLD}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        {/* Ear hole */}
        <circle cx="34" cy="32" r="3" fill="#000" />
        {/* Facemask cage — right side */}
        <path
          d="M 54 30 Q 78 30 76 46 L 62 48 Q 68 38 56 34 Z"
          fill="none"
          stroke="#000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M 58 38 Q 70 38 72 44"
          fill="none"
          stroke="#000"
          strokeWidth="1.8"
        />
        {/* Pink chinstrap accent */}
        <line
          x1="42"
          y1="48"
          x2="56"
          y2="48"
          stroke={PINK}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}

// ─── Stakes — traditional money bag with $ ────────────────────────────
export function StakesArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect width="100" height="100" fill={NAVY} />
      <g
        className="transition-transform duration-300 group-hover:-translate-y-[2px]"
        style={{ transformOrigin: '50px 60px' }}
      >
        {/* Bag — single closed path: flat-topped tie that flares into
            a rounded body. Reads as a classic money sack. */}
        <path
          d="M 36 20
             L 64 20
             L 64 38
             Q 82 44 84 62
             Q 80 84 50 86
             Q 20 84 16 62
             Q 18 44 36 38
             Z"
          fill={GOLD}
          stroke="#000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Cinch line where tie meets body */}
        <line
          x1="36"
          y1="38"
          x2="64"
          y2="38"
          stroke="#000"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Subtle fabric folds on the tie */}
        <line x1="43" y1="22" x2="43" y2="36" stroke="#000" strokeWidth="1.5" opacity="0.45" strokeLinecap="round" />
        <line x1="50" y1="22" x2="50" y2="36" stroke="#000" strokeWidth="1.5" opacity="0.45" strokeLinecap="round" />
        <line x1="57" y1="22" x2="57" y2="36" stroke="#000" strokeWidth="1.5" opacity="0.45" strokeLinecap="round" />
        {/* $ symbol */}
        <text
          x="50"
          y="68"
          fontSize="26"
          fontWeight="900"
          fill="#000"
          textAnchor="middle"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          $
        </text>
      </g>
    </svg>
  )
}

// ─── Trading — two cards swapping with a circular arrow ────────────────
export function TradingArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect width="100" height="100" fill={NAVY} />
      {/* Right card — cyan, behind */}
      <g transform="rotate(12 60 56)">
        <rect x="46" y="34" width="28" height="40" rx="3" fill={CYAN} stroke="#000" strokeWidth="2.5" />
        <circle cx="60" cy="48" r="5" fill="#000" />
        <path d="M 50 64 Q 60 56 70 64 L 70 70 L 50 70 Z" fill="#000" />
      </g>
      {/* Left card — gold, in front */}
      <g transform="rotate(-12 40 56)">
        <rect x="26" y="34" width="28" height="40" rx="3" fill={GOLD} stroke="#000" strokeWidth="2.5" />
        <circle cx="40" cy="48" r="5" fill="#000" />
        <path d="M 30 64 Q 40 56 50 64 L 50 70 L 30 70 Z" fill="#000" />
      </g>
      {/* Swap arrows — curved over top */}
      <g
        className="transition-transform duration-300 group-hover:rotate-[180deg]"
        style={{ transformOrigin: '50px 22px' }}
      >
        <path
          d="M 30 22 Q 50 8 70 22"
          stroke={PINK}
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        {/* Right arrowhead */}
        <path d="M 70 22 L 64 18 M 70 22 L 66 27" stroke={PINK} strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* Left arrowhead */}
        <path d="M 30 22 L 36 26 M 30 22 L 34 17" stroke={PINK} strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  )
}

// ─── Playoffs — trophy with sparkles (no halo, gold-filled handles) ───
export function PlayoffsArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect width="100" height="100" fill={NAVY} />
      <g
        className="transition-transform duration-300 group-hover:-translate-y-[2px]"
        style={{ transformOrigin: '50px 50px' }}
      >
        {/* Left handle — closed C-shape, filled gold */}
        <path
          d="M 32 28 Q 18 30 18 44 Q 18 54 32 54 L 32 48 Q 26 48 26 44 Q 26 36 32 34 Z"
          fill={GOLD}
          stroke="#000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Right handle */}
        <path
          d="M 68 28 Q 82 30 82 44 Q 82 54 68 54 L 68 48 Q 74 48 74 44 Q 74 36 68 34 Z"
          fill={GOLD}
          stroke="#000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Cup body */}
        <path
          d="M 32 28 L 68 28 L 65 52 Q 65 62 50 62 Q 35 62 35 52 Z"
          fill={GOLD}
          stroke="#000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Star inset */}
        <path
          d="M 50 36 L 52.5 41 L 58 42 L 54 46 L 55 51 L 50 48.5 L 45 51 L 46 46 L 42 42 L 47.5 41 Z"
          fill={NAVY}
        />
        {/* Stem */}
        <rect x="46" y="62" width="8" height="8" fill={GOLD} stroke="#000" strokeWidth="2" />
        {/* Base */}
        <path
          d="M 36 70 L 64 70 L 60 78 L 40 78 Z"
          fill={GOLD}
          stroke="#000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </g>
      {/* Sparkles */}
      <g className="transition-opacity duration-300 opacity-70 group-hover:opacity-100">
        <circle cx="84" cy="22" r="2.5" fill={CYAN} />
        <circle cx="16" cy="22" r="2.5" fill={CYAN} />
        <circle cx="22" cy="82" r="2" fill={PINK} />
        <circle cx="80" cy="82" r="2" fill={CYAN} />
      </g>
    </svg>
  )
}

// ─── Punishment — playful skull (X eyes + tongue) + loser crown ───────
export function PunishmentArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect width="100" height="100" fill={NAVY} />
      <g
        className="transition-transform duration-300 group-hover:rotate-[-4deg]"
        style={{ transformOrigin: '50px 56px' }}
      >
        {/* Cranium — rounder/simpler */}
        <path
          d="M 26 48 Q 26 28 50 28 Q 74 28 74 48 Q 74 62 64 66 L 64 76 L 36 76 L 36 66 Q 26 62 26 48 Z"
          fill={CYAN}
          stroke="#000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* X eyes */}
        <g stroke="#000" strokeWidth="3" strokeLinecap="round">
          <line x1="36" y1="44" x2="44" y2="52" />
          <line x1="44" y1="44" x2="36" y2="52" />
          <line x1="56" y1="44" x2="64" y2="52" />
          <line x1="64" y1="44" x2="56" y2="52" />
        </g>
        {/* Open mouth */}
        <ellipse cx="50" cy="66" rx="9" ry="4" fill="#000" />
        {/* Goofy tongue sticking out */}
        <path
          d="M 50 66 Q 56 68 58 74 Q 53 75 50 72 Z"
          fill={PINK}
          stroke="#000"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>
      {/* Tiny loser crown */}
      <g transform="translate(50 16) rotate(-12)">
        <path
          d="M -12 4 L -10 -4 L -5 0 L 0 -8 L 5 0 L 10 -4 L 12 4 Z"
          fill={GOLD}
          stroke="#000"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="-9" cy="-3" r="1.5" fill={PINK} />
        <circle cx="0" cy="-7" r="1.5" fill={PINK} />
        <circle cx="9" cy="-3" r="1.5" fill={PINK} />
      </g>
    </svg>
  )
}

// ─── Rules — shield + football (no badge, pink football) ─────────────
export function RulesArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect width="100" height="100" fill={NAVY} />
      <circle
        cx="50"
        cy="50"
        r="38"
        fill={CYAN}
        opacity="0.08"
        className="transition-transform duration-500 group-hover:scale-110"
        style={{ transformOrigin: '50px 50px' }}
      />
      <g
        className="transition-transform duration-300 group-hover:-translate-y-[1px]"
        style={{ transformOrigin: '50px 50px' }}
      >
        <path
          d="M 50 14 L 78 24 L 78 50 C 78 64 68 74 50 84 C 32 74 22 64 22 50 L 22 24 Z"
          fill={NAVY_2}
          stroke={CYAN}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <g transform="rotate(-18 50 50)">
          <ellipse cx="50" cy="50" rx="18" ry="11" fill={PINK} stroke="#000" strokeWidth="2.5" />
          <line x1="36" y1="50" x2="64" y2="50" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="46" y1="47" x2="46" y2="53" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          <line x1="50" y1="47" x2="50" y2="53" stroke="#000" strokeWidth="2" strokeLinecap="round" />
          <line x1="54" y1="47" x2="54" y2="53" stroke="#000" strokeWidth="2" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}

// ─── Logistics — beer mug (watch-party / BWW vibe) ────────────────────
export function LogisticsArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect width="100" height="100" fill={NAVY} />
      <g
        className="transition-transform duration-300 group-hover:rotate-[-6deg]"
        style={{ transformOrigin: '50px 60px' }}
      >
        {/* Handle (behind body) */}
        <path
          d="M 64 44 Q 86 44 86 60 Q 86 76 64 76 L 64 70 Q 78 70 78 60 Q 78 50 64 50 Z"
          fill={CYAN}
          stroke="#000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Mug body */}
        <rect
          x="22"
          y="38"
          width="46"
          height="46"
          rx="2"
          fill={CYAN}
          stroke="#000"
          strokeWidth="2.5"
        />
        {/* Foam — bubbly top */}
        <path
          d="M 20 38
             Q 24 28 30 32
             Q 34 24 40 30
             Q 46 22 52 30
             Q 58 24 64 30
             Q 68 26 72 38 Z"
          fill="#F9FAFB"
          stroke="#000"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Liquid bubbles inside */}
        <circle cx="32" cy="54" r="2.5" fill={GOLD} />
        <circle cx="44" cy="64" r="2" fill={GOLD} />
        <circle cx="56" cy="56" r="2.5" fill={GOLD} />
        <circle cx="36" cy="74" r="2" fill={GOLD} />
        <circle cx="54" cy="76" r="2.5" fill={GOLD} />
        {/* Beer fill line — subtle */}
        <line
          x1="22"
          y1="48"
          x2="68"
          y2="48"
          stroke="#000"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.3"
        />
      </g>
      {/* Pink "GAMEDAY" sticker accent */}
      <g
        className="transition-transform duration-200 group-hover:rotate-[6deg]"
        style={{ transformOrigin: '78px 22px' }}
      >
        <rect x="64" y="16" width="28" height="12" rx="2" fill={PINK} stroke="#000" strokeWidth="1.5" />
        <text
          x="78"
          y="24.5"
          fontSize="6.5"
          fontWeight="900"
          fill="#fff"
          textAnchor="middle"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          letterSpacing="0.5"
        >
          GAMEDAY
        </text>
      </g>
    </svg>
  )
}

// Group key → illustration component. Keyed by `EntryGroup` strings;
// the consumer narrows it at the call site.
export const SEASON_SETUP_ART: Record<string, ComponentType<ArtProps> | undefined> = {
  Draft: DraftArt,
  Stakes: StakesArt,
  Trading: TradingArt,
  Playoffs: PlayoffsArt,
  Punishment: PunishmentArt,
  Rules: RulesArt,
  Logistics: LogisticsArt,
}
