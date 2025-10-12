# Degenerates Dashboard - Architecture Guide

## Overview

This document outlines the architectural decisions and patterns used in the Degenerates Dashboard project.

## Tech Stack Rationale

### Next.js 14+ (App Router)
- **Server Components**: Default server rendering for better performance
- **Server Actions**: Type-safe server mutations without API routes
- **File-based routing**: Intuitive routing structure
- **Built-in optimizations**: Image optimization, code splitting, etc.

### Supabase
- **Postgres database**: Robust, scalable SQL database
- **Built-in auth**: No need to roll our own authentication
- **Row Level Security (RLS)**: Database-level access control
- **Real-time capabilities**: Future feature for live parlay updates
- **Free tier**: Generous limits for getting started

### TypeScript
- **Type safety**: Catch errors at compile time
- **Better DX**: Autocomplete and IntelliSense
- **Self-documenting**: Types serve as documentation

### Tailwind CSS
- **Utility-first**: Rapid UI development
- **Consistent design**: Design system built-in
- **Mobile-first**: Responsive by default
- **Small bundle**: Only used classes are included

### shadcn/ui
- **Copy-paste components**: Full control over component code
- **Accessible**: Built on Radix UI primitives
- **Customizable**: Easy to modify to your needs
- **No package lock-in**: Components live in your codebase

## Project Structure

### App Directory (`/app`)
Next.js App Router structure with file-based routing.

```
app/
├── actions/          # Server Actions (mutations)
│   └── auth.ts
├── login/           # Auth pages
├── signup/
├── dashboard/       # Protected app pages
├── layout.tsx       # Root layout
├── page.tsx         # Landing page
└── globals.css      # Global styles
```

### Components (`/components`)
Reusable React components.

```
components/
├── ui/              # shadcn/ui base components
└── [feature]/       # Feature-specific components (future)
```

### Lib (`/lib`)
Utility functions and configuration.

```
lib/
├── supabase/
│   ├── client.ts    # Browser client
│   └── server.ts    # Server client
└── utils.ts         # Helper functions
```

## Authentication Flow

### Middleware Pattern
The `middleware.ts` file handles:
1. Session refresh (extends user session)
2. Protected route checks (redirect to login if not authenticated)
3. Auth page redirects (redirect to dashboard if already logged in)

### Server Actions
Authentication mutations are handled via Server Actions:
- `login()` - Email/password sign in
- `signup()` - New user registration
- `logout()` - Sign out and clear session

### Client vs Server Supabase Clients
- **Browser client** (`lib/supabase/client.ts`): Used in Client Components
- **Server client** (`lib/supabase/server.ts`): Used in Server Components and Server Actions

## Data Architecture (Planned)

### Multi-Tenancy Model
- **User-centric**: Users can belong to multiple leagues
- **League isolation**: Each league's data is independent
- **Flexible membership**: Users can have different roles per league

### Database Schema (To Be Implemented)

```sql
-- Core entities
users (extends auth.users)
  - id
  - email
  - full_name
  - avatar_url
  - created_at

leagues
  - id
  - name
  - season (e.g., "2024")
  - year
  - created_by
  - created_at

league_members
  - id
  - league_id
  - user_id
  - role (owner/admin/member)
  - joined_at

weeks
  - id
  - league_id
  - week_number
  - status (open/closed/completed)
  - deadline
  - result (win/loss)

parlay_legs
  - id
  - week_id
  - user_id
  - bet_description
  - odds
  - status (pending/won/lost)
  - submitted_at

parlays
  - id
  - week_id
  - combined_odds
  - result (pending/won/lost)
  - payout_amount
  - completed_at
```

### Row Level Security (RLS)
Supabase RLS policies will enforce:
- Users can only see leagues they belong to
- Only league members can view that league's data
- Only admins/owners can modify league settings
- Members can only submit their own parlay legs

## Routing Strategy

### Public Routes
- `/` - Landing page
- `/login` - Sign in
- `/signup` - Register

### Protected Routes (Require Auth)
- `/dashboard` - Main dashboard/home
- `/leagues` - League list
- `/leagues/[id]` - League detail
- `/leagues/[id]/week/[weekId]` - Week detail with parlay
- `/profile` - User profile/settings

### Middleware Protection
Middleware automatically redirects:
- Unauthenticated users accessing `/dashboard/*` → `/login`
- Authenticated users accessing `/login` or `/signup` → `/dashboard`

## State Management

### Server State (Primary)
- **Server Components**: Fetch data directly in components
- **Server Actions**: Mutate data via forms or client actions
- **Automatic revalidation**: Next.js handles cache invalidation

### Client State (Minimal)
- **React state**: Only for UI-specific state (form inputs, modals)
- **URL state**: Use query params for filters, pagination
- **No global state library needed**: Server components handle most data

## API Pattern

### Server Actions Instead of API Routes
Why:
- Type-safe by default (TypeScript end-to-end)
- Automatic code-splitting
- Built-in request deduplication
- Simpler error handling
- No need to define API routes

Example:
```typescript
// app/actions/leagues.ts
'use server'

export async function createLeague(formData: FormData) {
  const supabase = await createClient()
  // ... mutation logic
  revalidatePath('/leagues')
  redirect('/leagues')
}
```

## Mobile-First Design Approach

### Responsive Breakpoints (Tailwind)
- `sm`: 640px (small tablets)
- `md`: 768px (tablets)
- `lg`: 1024px (laptops)
- `xl`: 1280px (desktops)

### Mobile Optimizations
- Touch-friendly button sizes (min 44x44px)
- Large text for readability
- Bottom navigation for thumb-friendly access
- Swipe gestures where appropriate
- Minimal data loading (paginate/infinite scroll)

## Performance Considerations

### Image Optimization
- Use Next.js `<Image>` component
- Lazy loading by default
- Automatic format selection (WebP, AVIF)

### Code Splitting
- Automatic per-route splitting
- Dynamic imports for heavy components
- Lazy load modals and non-critical UI

### Database Query Optimization
- Select only needed columns
- Use database indexes
- Implement pagination
- Cache expensive queries

## Security Best Practices

### Authentication
- Secure HTTP-only cookies (handled by Supabase)
- Session refresh in middleware
- CSRF protection via Server Actions

### Database Access
- Row Level Security (RLS) policies
- Never expose service role key
- Validate all inputs in Server Actions

### Environment Variables
- All secrets in `.env.local`
- Never commit `.env.local`
- Use `NEXT_PUBLIC_*` prefix only for client-safe values

## Development Workflow

### Feature Development
1. Design database schema changes
2. Create/update tables in Supabase
3. Generate TypeScript types
4. Create Server Actions
5. Build UI components
6. Add routing/pages
7. Test auth and permissions

### Testing Strategy (Future)
- **Unit tests**: Utility functions
- **Integration tests**: Server Actions
- **E2E tests**: Critical user flows
- Use Supabase local development for testing

## Deployment Strategy

### Vercel (Recommended)
- Automatic deployments on git push
- Preview deployments for PRs
- Edge functions for middleware
- Built-in analytics

### Environment Setup
- **Development**: Local with Supabase project
- **Production**: Vercel with production Supabase project
- Use separate Supabase projects for dev/prod

## Future Enhancements

### PWA Support (Phase 2)
- Service worker for offline support
- Install prompt
- Push notifications for:
  - Week opening/closing
  - Parlay results
  - League invites

### Real-time Features (Phase 3)
- Live parlay updates using Supabase Realtime
- Live member status (who's submitted)
- Chat/comments per week

### Advanced Stats (Phase 4)
- Historical performance tracking
- Win rate analysis
- Best/worst performers
- Trend analysis

## Helpful Patterns

### Loading States
```typescript
// Use Suspense boundaries
<Suspense fallback={<LoadingSkeleton />}>
  <DataComponent />
</Suspense>
```

### Error Handling
```typescript
// Use error.tsx files for error boundaries
// app/dashboard/error.tsx
'use client'
export default function Error({ error, reset }) {
  return <ErrorDisplay error={error} onReset={reset} />
}
```

### Form Handling
```typescript
// Progressive enhancement with Server Actions
<form action={serverAction}>
  <input name="field" />
  <button type="submit">Submit</button>
</form>
```

---

This architecture supports rapid iteration while maintaining scalability and best practices. As the project grows, we can refine and extend these patterns.
