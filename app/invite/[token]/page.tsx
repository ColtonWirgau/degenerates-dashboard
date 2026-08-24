import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { getInvitation, acceptInvitation } from '@/app/actions/invitations'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, UserPlus, AlertCircle } from 'lucide-react'
import { logout } from '@/app/actions/auth'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const session = await auth()
  const { invitation, error } = await getInvitation(token)

  if (error || !invitation) {
    return (
      <div className="min-h-screen ambient-glow">
        <Header />
        <main className="container mx-auto px-4 py-8 pt-24">
          <Card className="glass-card max-w-md mx-auto border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <CardTitle>Invalid invitation</CardTitle>
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

  const league = Array.isArray(invitation.leagues) ? invitation.leagues[0] : invitation.leagues

  // Unauth → send through home sign-in dock and back here.
  if (!session?.user) {
    redirect(`/?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`)
  }

  const currentEmail = session.user.email?.toLowerCase() ?? ''
  if (currentEmail !== invitation.email.toLowerCase()) {
    return (
      <div className="min-h-screen ambient-glow">
        <Header />
        <main className="container mx-auto px-4 py-8 pt-24">
          <Card className="glass-card max-w-md mx-auto border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <CardTitle>Email mismatch</CardTitle>
                  <CardDescription>
                    This invitation was sent to {invitation.email}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You&apos;re currently signed in as {session.user.email}. Sign out and
                sign in with the invited email address.
              </p>
              <form action={logout}>
                <Button type="submit" variant="outline" className="w-full glass border-primary/30">
                  Sign out
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  async function handleAccept() {
    'use server'
    const result = await acceptInvitation(token)
    if (result.success && result.leagueId) {
      redirect(`/leagues/${result.leagueId}`)
    }
  }

  return (
    <div className="min-h-screen ambient-glow">
      <Header />
      <main className="container mx-auto px-4 py-8 pt-24">
        <Card className="glass-card max-w-md mx-auto neon-glow-blue">
          <CardHeader>
            <div className="flex items-center gap-3">
              <UserPlus className="h-8 w-8 text-neon-blue" />
              <div>
                <CardTitle>Join league</CardTitle>
                <CardDescription>You&apos;ve been invited</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">League:</p>
              <p className="text-2xl font-bold text-neon-blue">{league?.name}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Invited as:</p>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <p className="text-sm">{invitation.email}</p>
              </div>
            </div>
            <form action={handleAccept}>
              <Button type="submit" className="w-full neon-glow-blue">
                Join league
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
