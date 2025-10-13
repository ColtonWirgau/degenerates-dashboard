'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface LiveWeekStatusProps {
  weekId: string
  initialStatus: 'open' | 'locked' | 'closed'
}

export function LiveWeekStatus({ weekId, initialStatus }: LiveWeekStatusProps) {
  const [status, setStatus] = useState(initialStatus)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Set up realtime subscription for week status changes
    const channel = supabase
      .channel(`week_${weekId}_status`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'weeks',
          filter: `id=eq.${weekId}`,
        },
        (payload) => {
          console.log('Week status changed:', payload)
          if (payload.new.status !== status) {
            setStatus(payload.new.status)
            // Refresh the page to show new state (reveals, etc.)
            router.refresh()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [weekId, status, router, supabase])

  return null // This is a status-only component
}
