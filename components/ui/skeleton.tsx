import { cn } from '@/lib/utils'

/**
 * A shape where a fact is going to be.
 *
 * Deliberately dim: a skeleton's job is to hold the layout still and say
 * "not yet", not to compete with the content that replaces it. It breathes
 * rather than sweeping — a shimmer at this contrast reads as a rendering
 * bug on the app's near-black canvas.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-white/[0.055]', className)}
    />
  )
}
