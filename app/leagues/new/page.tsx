'use client'

import { useState } from 'react'
import { createLeague } from '@/app/actions/leagues'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'

export default function NewLeaguePage() {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true)
    setError(null)

    const result = await createLeague(formData)

    if (result?.error) {
      setError(result.error)
      setIsSubmitting(false)
    }
    // If successful, the server action will redirect
  }

  return (
    <div className="min-h-screen ambient-glow flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/leagues">
            <Button variant="outline" size="icon" className="glass border-primary/30">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-neon-blue">Create New League</h1>
            <p className="text-muted-foreground">Let the degenerate games begin</p>
          </div>
        </div>

        <Card className="glass-intense border-primary/30 neon-glow-blue">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-neon-blue" />
              League Details
            </CardTitle>
            <CardDescription>
              Set up your parlay league and start tracking weekly bets with your crew
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">
                  League Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Degenerates, Sunday Funday, The Degens"
                  required
                  disabled={isSubmitting}
                  className="glass border-primary/30 focus:border-primary focus:neon-glow-blue"
                />
                <p className="text-xs text-muted-foreground">
                  Give your league a memorable name. Seasons are automatically tracked per week.
                </p>
              </div>

              {error && (
                <div className="rounded-xl glass border-destructive/50 p-3 text-sm text-destructive neon-glow-pink">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full neon-glow-blue"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating League...' : 'Create League'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="glass-card border-secondary/30">
          <CardContent className="pt-6">
            <h3 className="font-bold mb-3 text-neon-purple flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              What happens next?
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-neon-green mt-0.5">✓</span>
                <span>You&apos;ll be automatically added as the league owner</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-neon-green mt-0.5">✓</span>
                <span>You can invite members to join your league</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-neon-green mt-0.5">✓</span>
                <span>Create weekly parlays and start tracking bets</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-neon-green mt-0.5">✓</span>
                <span>Monitor outcomes and flex on your boys</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
