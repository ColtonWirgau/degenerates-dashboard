import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { getLeagueByInviteCode, joinLeagueByInviteCode } from '@/app/actions/leagues'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, AlertCircle, Trophy } from 'lucide-react'

export default async function JoinLeaguePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const session = await auth()
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
                  <CardTitle>Invalid invite code</CardTitle>
                  <CardDescription>{error}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Link href="/">
                <Button className="w-full neon-glow-blue">Back to home</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // Unauthenticated: send them to the home dock with a callbackUrl that
  // brings them back here after sign-in.
  if (!session?.user?.id) {
    redirect(`/?callbackUrl=${encodeURIComponent(`/join/${code}`)}`)
  }

  async function handleJoin() {
    'use server'
    const res = await joinLeagueByInviteCode(code)
    if (res.success && res.leagueId) redirect(`/leagues/${res.leagueId}`)
  }

  return (
    <div className="min-h-screen ambient-glow">
      <Header />
      <main className="container mx-auto px-4 py-8 pt-24">
        <Card className="glass-card max-w-md mx-auto neon-glow-blue">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8 text-neon-blue" />
              <div>
                <CardTitle>Join league</CardTitle>
                <CardDescription>You&apos;ve been invited</CardDescription>
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
              <Button type="submit" className="w-full neon-glow-blue text-lg py-6">
                Join league
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
