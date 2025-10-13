'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Zap } from 'lucide-react'
import { submitParlay } from '@/app/actions/parlays'
import confetti from 'canvas-confetti'

interface SubmitParlayFormProps {
  weekId: string
  leagueId: string
  existingLegs?: Array<{ description: string; odds: string }>
}

export function SubmitParlayForm({ weekId, leagueId, existingLegs = [] }: SubmitParlayFormProps) {
  const [legs, setLegs] = useState(
    existingLegs.length > 0
      ? existingLegs
      : [
          { description: '', odds: '' },
          { description: '', odds: '' },
          { description: '', odds: '' },
        ]
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const addLeg = () => {
    setLegs([...legs, { description: '', odds: '' }])
  }

  const removeLeg = (index: number) => {
    if (legs.length <= 1) return
    setLegs(legs.filter((_, i) => i !== index))
  }

  const updateLeg = (index: number, field: 'description' | 'odds', value: string) => {
    const newLegs = [...legs]
    newLegs[index][field] = value
    setLegs(newLegs)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSubmitting(true)

    // Validate all legs are filled
    const invalidLegs = legs.filter(leg => !leg.description.trim() || !leg.odds.trim())
    if (invalidLegs.length > 0) {
      setError('Please fill in all legs before submitting')
      setSubmitting(false)
      return
    }

    const result = await submitParlay(weekId, leagueId, legs)

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
    }
  }

  if (success) {
    return (
      <Card className="glass-intense border-neon-green/50 neon-glow-green animate-in fade-in zoom-in">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="text-6xl animate-bounce">🎰</div>
          <div>
            <h3 className="text-2xl font-bold text-neon-green mb-2">Locked In!</h3>
            <p className="text-muted-foreground">
              Your parlay is submitted. Good luck, degen! 🍀
            </p>
          </div>
          <Button
            onClick={() => setSuccess(false)}
            variant="outline"
            className="glass border-primary/30"
          >
            Edit Submission
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-intense border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-gold" />
          Submit Your Parlay
        </CardTitle>
        <CardDescription>
          Lock in your {legs.length}-leg parlay before the deadline
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="glass border-destructive/50 p-3 rounded-xl text-sm text-destructive animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {legs.map((leg, index) => (
              <div
                key={index}
                className="glass-card p-4 space-y-3 animate-in fade-in slide-in-from-left"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-bold text-primary">
                    Leg #{index + 1}
                  </Label>
                  {legs.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLeg(index)}
                      className="h-6 w-6 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <div>
                  <Label htmlFor={`description-${index}`} className="text-xs text-muted-foreground">
                    Bet Description
                  </Label>
                  <Textarea
                    id={`description-${index}`}
                    placeholder="e.g., Lakers ML vs Celtics"
                    value={leg.description}
                    onChange={(e) => updateLeg(index, 'description', e.target.value)}
                    className="glass border-primary/30 mt-1 resize-none"
                    rows={2}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor={`odds-${index}`} className="text-xs text-muted-foreground">
                    Odds
                  </Label>
                  <Input
                    id={`odds-${index}`}
                    placeholder="e.g., -110, +150"
                    value={leg.odds}
                    onChange={(e) => updateLeg(index, 'odds', e.target.value)}
                    className="glass border-primary/30 mt-1"
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={addLeg}
            className="w-full glass border-primary/30"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Leg
          </Button>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full neon-glow-blue pulse-neon text-lg py-6"
          >
            {submitting ? 'Submitting...' : '🎲 Lock It In, Degen!'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
