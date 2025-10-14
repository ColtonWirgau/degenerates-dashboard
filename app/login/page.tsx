'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')
  const invite = searchParams.get('invite')
  const join = searchParams.get('join')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen ambient-glow flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Fun Header */}
        <div className="text-center mb-8 space-y-4">
          <div className="inline-block">
            <h1 className="text-5xl sm:text-6xl font-bold mb-2">
              <span className="text-neon-blue block">DEGENERATES</span>
              <span className="text-neon-pink block">DASHBOARD</span>
            </h1>
          </div>
          <div className="text-4xl animate-bounce">🎰</div>
          <p className="text-xl text-neon-blue font-semibold">
            Time to make some questionable decisions
          </p>
        </div>

        {/* Login Card */}
        <Card className="glass-intense border-primary/30 neon-glow-blue">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-3xl font-bold text-neon-blue">Welcome Back</CardTitle>
            <CardDescription className="text-base">
              Let&apos;s see those picks 👀
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {error && (
                <div className="bg-destructive/15 border border-destructive/30 text-destructive text-sm p-3 rounded-md">
                  {error}
                </div>
              )}
              {redirectTo && (
                <input type="hidden" name="redirectTo" value={redirectTo} />
              )}
              {invite && (
                <input type="hidden" name="invite" value={invite} />
              )}
              {join && (
                <input type="hidden" name="join" value={join} />
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  className="glass border-primary/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  disabled={loading}
                  className="glass border-primary/30"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button
                type="submit"
                className="w-full neon-glow-blue text-lg py-6"
                disabled={loading}
              >
                {loading ? '🎲 Loading...' : '🚀 Let\'s Gamble'}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="text-neon-blue hover:text-neon-pink transition-colors font-semibold">
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        {/* Fun Footer Message */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Remember: Bet with your head, not over it 🧠
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen ambient-glow flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 space-y-4">
            <div className="inline-block">
              <h1 className="text-5xl sm:text-6xl font-bold mb-2">
                <span className="text-neon-blue block">DEGENERATES</span>
                <span className="text-neon-pink block">DASHBOARD</span>
              </h1>
            </div>
            <div className="text-4xl animate-bounce">🎰</div>
          </div>
          <Card className="glass-intense border-primary/30 neon-glow-blue">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="text-3xl font-bold text-neon-blue">Welcome Back</CardTitle>
              <CardDescription className="text-base">
                Loading...
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
