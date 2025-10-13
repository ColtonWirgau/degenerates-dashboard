import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen ambient-glow flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full text-center space-y-12">
        {/* Hero Section */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="text-6xl mb-4 animate-bounce">🎰</div>
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight">
              <span className="text-neon-blue block mb-2">DEGENERATES</span>
              <span className="text-neon-pink block">DASHBOARD</span>
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-foreground max-w-2xl mx-auto leading-relaxed">
            Track your weekly parlays, manage multiple leagues, and compete with friends
          </p>
          <p className="text-lg text-neon-blue font-semibold">
            Because good decisions are overrated 🚀
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button asChild size="lg" className="text-lg px-8 py-6 neon-glow-blue w-full sm:w-auto">
            <Link href="/login">
              🎯 Sign In
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-lg px-8 py-6 glass border-primary/30 w-full sm:w-auto hover:neon-glow-pink transition-all">
            <Link href="/signup">
              ✨ Get Started
            </Link>
          </Button>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <div className="glass-card border-primary/30 hover:glass-intense hover:neon-glow-blue transition-all p-6 rounded-lg text-left">
            <div className="text-3xl mb-3">🏆</div>
            <h3 className="text-xl font-bold text-neon-blue mb-2">MULTI-LEAGUE SUPPORT</h3>
            <p className="text-muted-foreground">
              Manage parlays across multiple leagues with ease
            </p>
          </div>
          <div className="glass-card border-primary/30 hover:glass-intense hover:neon-glow-pink transition-all p-6 rounded-lg text-left">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-xl font-bold text-neon-pink mb-2">WEEKLY TRACKING</h3>
            <p className="text-muted-foreground">
              Submit and track bet legs for every week of the season
            </p>
          </div>
          <div className="glass-card border-primary/30 hover:glass-intense hover:neon-glow-gold transition-all p-6 rounded-lg text-left">
            <div className="text-3xl mb-3">📈</div>
            <h3 className="text-xl font-bold text-gold mb-2">STATS & HISTORY</h3>
            <p className="text-muted-foreground">
              View detailed statistics and historical performance
            </p>
          </div>
        </div>

        {/* Fun Footer */}
        <div className="mt-12 space-y-2">
          <p className="text-sm text-muted-foreground">
            Built by degenerates, for degenerates
          </p>
          <p className="text-xs text-muted-foreground">
            (Please gamble responsibly 🧠)
          </p>
        </div>
      </div>
    </div>
  )
}
