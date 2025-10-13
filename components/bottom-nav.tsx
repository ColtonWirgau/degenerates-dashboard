'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, Trophy, User, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'

export function BottomNav({ leagueId }: { leagueId?: string }) {
  const pathname = usePathname()
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if app is running in standalone mode (installed as PWA)
    const isInStandaloneMode = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone ||
        document.referrer.includes('android-app://')
      )
    }

    setIsStandalone(isInStandaloneMode())
  }, [])

  // Only show in standalone mode
  if (!isStandalone) return null

  const tabs = [
    {
      name: 'Home',
      href: '/dashboard',
      icon: Home,
      active: pathname === '/dashboard',
    },
    {
      name: 'League',
      href: leagueId ? `/leagues/${leagueId}` : '/dashboard',
      icon: Trophy,
      active: pathname?.includes('/leagues/') && !pathname?.includes('/users/'),
    },
    {
      name: 'Stats',
      href: leagueId ? `/leagues/${leagueId}` : '/dashboard',
      icon: TrendingUp,
      active: false, // We can add a stats page later
    },
    {
      name: 'Profile',
      href: '/profile',
      icon: User,
      active: pathname === '/profile',
    },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-intense border-t border-primary/20 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`flex flex-col items-center justify-center flex-1 gap-1 py-2 transition-colors ${
                tab.active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`h-5 w-5 ${tab.active ? 'text-neon-blue' : ''}`} />
              <span className="text-xs font-medium">{tab.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
