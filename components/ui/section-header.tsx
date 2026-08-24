import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// The palette is closed: blue carries "good/primary", pink carries
// "bad/destructive". Anything neutral simply wears less color.
export type SectionAccent = 'blue' | 'pink'

const ACCENT: Record<SectionAccent, { text: string }> = {
  blue: { text: 'text-neon-blue' },
  pink: { text: 'text-neon-pink' },
}

interface SectionHeaderProps {
  /** Big neon title — uses Anton (set globally on h-tags). */
  title: string
  /** Optional eyebrow above the title — left-aligned, tight to the title. */
  kicker?: string
  /** Muted secondary copy below the title. */
  description?: string
  /** Optional icon shown to the left, sized to span both kicker + title. */
  icon?: LucideIcon
  /** Color of the title + icon. Default: blue. */
  accent?: SectionAccent
  /** Right-side slot for buttons / links / pills. */
  trailing?: React.ReactNode
  className?: string
}

/**
 * Section header — Anton-condensed neon title with an accent kicker.
 * Designed for top-of-section placement, replacing the boxy CardHeader
 * pattern on the league page so we don't end up with cards inside cards.
 */
export function SectionHeader({
  title,
  kicker,
  description,
  icon: Icon,
  accent = 'blue',
  trailing,
  className,
}: SectionHeaderProps) {
  const a = ACCENT[accent]
  return (
    <header
      className={cn(
        'mb-5 sm:mb-6 flex flex-wrap items-center justify-between gap-3',
        className
      )}
    >
      <div className="min-w-0 flex-1 flex items-center gap-3">
        {Icon && (
          // Sized to span the kicker + title combined so the icon doesn't
          // float next to the h2 alone.
          <Icon
            className={cn(
              'shrink-0 h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 opacity-90',
              a.text
            )}
          />
        )}
        <div className="min-w-0">
          {kicker && (
            <div
              className={cn(
                'text-[10px] font-bold tracking-[0.3em] uppercase leading-none',
                a.text
              )}
            >
              {kicker}
            </div>
          )}
          <h2
            className={cn(
              // h2 reads clearly subordinate to the page h1: smaller size,
              // accent class carries the 10px glow from globals.css.
              'min-w-0 truncate text-lg sm:text-xl md:text-2xl font-bold tracking-wide leading-none',
              kicker && 'mt-1',
              a.text
            )}
          >
            {title}
          </h2>
          {description && (
            <p className="mt-2 text-sm text-muted-foreground max-w-prose">
              {description}
            </p>
          )}
        </div>
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </header>
  )
}
