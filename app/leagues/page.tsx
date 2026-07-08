import { redirect } from 'next/navigation'

// The dedicated league-list page has been replaced by the in-header
// LeaguePicker sheet. Bounce anyone landing here back to "/" which routes
// to a real league (or /leagues/new when they have none).
export default function LeaguesPage() {
  redirect('/')
}
