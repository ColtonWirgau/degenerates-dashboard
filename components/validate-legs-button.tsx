'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2 } from 'lucide-react'
import { validateWeekLegs } from '@/app/actions/validate'

interface ValidateLegsButtonProps {
  weekId: string
  leagueId: string
  legCount: number
}

export function ValidateLegsButton({ weekId, leagueId, legCount }: ValidateLegsButtonProps) {
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleValidate = async () => {
    setValidating(true)
    setError(null)
    setSuccess(false)

    const result = await validateWeekLegs(weekId, leagueId)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }

    setValidating(false)
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={handleValidate}
        disabled={validating || legCount === 0}
        className="w-full neon-glow-purple"
        size="sm"
      >
        {validating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            AI Validating...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Validate All Legs with AI
          </>
        )}
      </Button>

      {error && (
        <p className="text-xs text-destructive animate-in fade-in">{error}</p>
      )}

      {success && (
        <p className="text-xs text-neon-green animate-in fade-in">
          ✓ All legs validated successfully!
        </p>
      )}
    </div>
  )
}
