import { getInvitation, acceptInvitation } from '@/app/actions/invitations'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Mail, UserPlus, AlertCircle } from 'lucide-react'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

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
                  <CardTitle>Invalid Invitation</CardTitle>
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

  const league = Array.isArray(invitation.leagues) ? invitation.leagues[0] : invitation.leagues

  // If user is logged in
  if (user) {
    // Check if email matches
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return (
        <div className="min-h-screen ambient-glow">
          <Header />
          <main className="container mx-auto px-4 py-8 pt-24">
            <Card className="glass-card max-w-md mx-auto border-destructive/30">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <div>
                    <CardTitle>Email Mismatch</CardTitle>
                    <CardDescription>
                      This invitation was sent to {invitation.email}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You&apos;re currently logged in as {user.email}. Please log out and sign in with the invited email address.
                </p>
                <form action="/api/auth/logout" method="post">
                  <Button type="submit" variant="outline" className="w-full glass border-primary/30">
                    Log Out
                  </Button>
                </form>
              </CardContent>
            </Card>
          </main>
        </div>
      )
    }

    // Auto-accept invitation
    async function handleAccept() {
      'use server'
      await acceptInvitation(token)
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
                  <CardTitle>Join League</CardTitle>
                  <CardDescription>You&apos;ve been invited!</CardDescription>
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
              <UserPlus className="h-8 w-8 text-neon-blue" />
              <div>
                <CardTitle>You&apos;re Invited!</CardTitle>
                <CardDescription>Join the league</CardDescription>
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
            <div className="pt-4 space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                Sign up or log in to accept this invitation
              </p>
              <Link href={`/signup?invite=${token}`} className="block">
                <Button className="w-full neon-glow-blue">
                  Sign Up
                </Button>
              </Link>
              <Link href={`/login?invite=${token}`} className="block">
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
