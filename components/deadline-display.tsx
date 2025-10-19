'use client'

interface DeadlineDisplayProps {
  deadline: string
}

export function DeadlineDisplay({ deadline }: DeadlineDisplayProps) {
  const date = new Date(deadline)

  return (
    <>
      {date.toLocaleDateString()} at{' '}
      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </>
  )
}
