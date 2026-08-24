'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import { submitLeg, type SubmitLegResult } from '@/app/actions/legs'
import confetti from 'canvas-confetti'

interface SubmitLegFormProps {
  weekId: string
  leagueId: string
  existingLeg?: { description: string; odds: string }
}

export function SubmitLegForm({ weekId, leagueId, existingLeg }: SubmitLegFormProps) {
  const [description, setDescription] = useState(existingLeg?.description || '')
  const [odds, setOdds] = useState(existingLeg?.odds || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [warning, setWarning] = useState<SubmitLegResult['warning'] | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setWarning(null)
    setSubmitting(true)

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
      if (result.warning) setWarning(result.warning)

      if (!result.warning) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00D9FF', '#FF69B4'],
        })
      }

      setTimeout(() => setSuccess(false), 3000)
    }
  }

  // No card and no title. This form is only ever mounted inside a surface
  // that has already said what it is — the SUBMIT reveal's own header. A
  // titled card inside a titled panel is the same sentence twice, in a box,
  // inside a box.
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="glass border-destructive/50 p-3 rounded-xl text-sm text-destructive animate-in fade-in slide-in-from-top-2 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && !warning && (
        <div className="glass border-neon-blue/50 p-3 rounded-xl text-sm text-neon-blue animate-in fade-in slide-in-from-top-2">
          Your leg is locked in. Check out what others picked below.
        </div>
      )}

      {warning && (
        <div className="glass border-neon-pink/50 bg-neon-pink/5 p-3 rounded-xl text-sm space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-2 text-neon-pink">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="font-bold tracking-wide uppercase text-xs">Conflict detected</span>
          </div>
          <p className="text-foreground/90">{warning.reason}</p>
          {warning.conflictsWith.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Conflicts with:{' '}
              <span className="text-foreground">{warning.conflictsWith.join(', ')}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Saved your leg anyway — edit it above before kickoff if you want to change.
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="description" className="text-sm font-medium">
            Selection
          </Label>
          <Textarea
            id="description"
            placeholder="e.g., Lakers ML vs Celtics, Chiefs -3.5, Over 225.5 points"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="glass border-primary/30 mt-1 resize-none"
            rows={3}
            required
          />
        </div>

        <div>
          <Label htmlFor="odds" className="text-sm font-medium">
            Odds
          </Label>
          <Input
            id="odds"
            placeholder="e.g., -110, +150, -200"
            value={odds}
            onChange={(e) => setOdds(e.target.value)}
            className="glass border-primary/30 mt-1"
            // `tel` gives mobile keyboards a numeric keypad with
            // `+`/`-` access — the closest native fit for American
            // odds (no native "signed number" inputMode exists).
            inputMode="tel"
            autoComplete="off"
            required
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className="w-full neon-glow-blue pulse-neon text-lg py-6"
      >
        {submitting
          ? 'Submitting...'
          : existingLeg
          ? 'Update'
          : 'Lock It In'}
      </Button>

      {existingLeg && (
        <p className="text-xs text-center text-muted-foreground">
          Change it any time before the week closes
        </p>
      )}
    </form>
  )
}
