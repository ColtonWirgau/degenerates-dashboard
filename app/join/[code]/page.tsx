import { getLeagueByInviteCode, joinLeagueByInviteCode } from '@/app/actions/leagues'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Users, AlertCircle, Trophy } from 'lucide-react'

export default async function JoinLeaguePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { league, error } = await getLeagueByInviteCode(code)

  if (error || !league) {
    return (
      <div className="min-h-screen ambient-glow">
        <Header />
        <main className="container mx-auto px-4 py-8 pt-24">
          <Card className="glass-card max-w-md mx-auto border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <CardTitle>Invalid Invite Code</CardTitle>
                  <CardDescription>{error}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Link href="/leagues">
                <Button className="w-full neon-glow-blue">
                  Go to My Leagues
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // If user is logged in, let them join
  if (user) {
    async function handleJoin() {
      'use server'
      await joinLeagueByInviteCode(code)
    }

    return (
      <div className="min-h-screen ambient-glow">
        <Header />
        <main className="container mx-auto px-4 py-8 pt-24">
          <Card className="glass-card max-w-md mx-auto neon-glow-blue">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-gold" />
                <div>
                  <CardTitle>Join League</CardTitle>
                  <CardDescription>You've been invited to join!</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">League:</p>
                <p className="text-3xl font-bold text-neon-blue">{league.name}</p>
              </div>
              <div className="glass-card p-4 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <p className="text-sm">Join the crew and start tracking your parlays</p>
                </div>
              </div>
              <form action={handleJoin}>
                <Button type="submit" className="w-full neon-glow-gold text-lg py-6">
                  Join League
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // User not logged in - show signup/login options
  return (
    <div className="min-h-screen ambient-glow">
      <Header />
      <main className="container mx-auto px-4 py-8 pt-24">
        <Card className="glass-card max-w-md mx-auto neon-glow-blue">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-gold" />
              <div>
                <CardTitle>Join the League!</CardTitle>
                <CardDescription>Create an account or log in to continue</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">You've been invited to:</p>
              <p className="text-3xl font-bold text-neon-blue">{league.name}</p>
            </div>
            <div className="glass-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <p className="text-sm">Track weekly parlays with your crew</p>
              </div>
            </div>
            <div className="pt-4 space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                Sign up or log in to join this league
              </p>
              <Link href={`/signup?join=${code}`} className="block">
                <Button className="w-full neon-glow-blue text-lg py-6">
                  Sign Up
                </Button>
              </Link>
              <Link href={`/login?join=${code}`} className="block">
                <Button variant="outline" className="w-full glass border-primary/30">
                  Log In
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
