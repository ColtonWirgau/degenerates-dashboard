'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle } from 'lucide-react'
import { submitLeg } from '@/app/actions/legs'
import confetti from 'canvas-confetti'

interface InlineLegSubmissionProps {
  weekId: string
  leagueId: string
  existingLeg?: { description: string; odds: string }
  currentUserId: string
}

export function InlineLegSubmission({ weekId, leagueId, existingLeg, currentUserId }: InlineLegSubmissionProps) {
  const router = useRouter()
  const [description, setDescription] = useState(existingLeg?.description || '')
  const [odds, setOdds] = useState(existingLeg?.odds || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSubmitting(true)

    // Ensure values are strings before calling trim
    const descStr = String(description || '').trim()
    const oddsStr = String(odds || '').trim()

    if (!descStr || !oddsStr) {
      setError('Please fill in all fields')
      setSubmitting(false)
      return
    }

    const result = await submitLeg(weekId, leagueId, {
      description: descStr,
      odds: oddsStr,
    })

    if (result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSuccess(true)
      setSubmitting(false)

      // Celebrate with confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00D9FF', '#FF69B4', '#39FF14', '#FFD700'],
      })

      // Refresh the page to show the new leg
      router.refresh()

      // Reset success after showing message
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="glass border-destructive/50 p-2 rounded-lg text-xs text-destructive flex items-start gap-2">
          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="glass border-neon-green/50 p-2 rounded-lg text-xs text-neon-green">
          🎉 Leg locked in!
        </div>
      )}

      <Textarea
        placeholder="Bet description (e.g., Lakers ML vs Celtics, Chiefs -3.5)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="glass border-primary/30 resize-none text-sm"
        rows={2}
        required
      />

      <div className="flex gap-2">
        <Input
          placeholder="Odds (e.g., -110, +150)"
          value={odds}
          onChange={(e) => setOdds(e.target.value)}
          className="glass border-primary/30 text-sm"
          required
        />

        <Button
          type="submit"
          disabled={submitting}
          className="neon-glow-blue whitespace-nowrap"
        >
          {submitting
            ? 'Saving...'
            : existingLeg
            ? '🔄 Update'
            : '🎲 Lock In'}
        </Button>
      </div>

      {existingLeg && (
        <p className="text-xs text-muted-foreground">
          You can update anytime before the deadline
        </p>
      )}
    </form>
  )
}
