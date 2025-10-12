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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
            Degenerates Dashboard
          </h1>
          <p className="text-xl text-slate-300">
            Track your weekly parlays, manage multiple leagues, and compete with friends
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild size="lg" className="text-lg">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-lg">
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-16 text-left">
          <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-2">Multi-League Support</h3>
            <p className="text-slate-400 text-sm">
              Manage parlays across multiple leagues with ease
            </p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-2">Weekly Tracking</h3>
            <p className="text-slate-400 text-sm">
              Submit and track bet legs for every week of the season
            </p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur p-6 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-2">Stats & History</h3>
            <p className="text-slate-400 text-sm">
              View detailed statistics and historical performance
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
