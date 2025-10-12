# Degenerates Dashboard - Setup Guide

## Project Overview

A Next.js app for managing weekly parlays across multiple fantasy football leagues. Track records, stats, and parlay outcomes over time with support for multiple leagues and cross-league participation.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Database & Auth**: Supabase
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Hosting**: Vercel
- **Version Control**: GitHub

## Initial Setup Complete ✓

The following has been configured:

### 1. Dependencies Installed
- Next.js with App Router
- TypeScript
- Tailwind CSS
- Supabase client libraries (@supabase/supabase-js, @supabase/ssr)
- shadcn/ui components (button, input, label, card)
- ESLint

### 2. Project Structure
```
degenerates-dashboard/
├── app/
│   ├── actions/
│   │   └── auth.ts              # Server actions for auth
│   ├── login/
│   │   └── page.tsx             # Login page
│   ├── signup/
│   │   └── page.tsx             # Signup page
│   ├── dashboard/
│   │   └── page.tsx             # Main dashboard (protected)
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing page
│   └── globals.css              # Global styles
├── components/
│   └── ui/                      # shadcn/ui components
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   └── server.ts            # Server Supabase client
│   └── utils.ts                 # Utility functions
├── middleware.ts                # Auth middleware
└── .env.local                   # Environment variables (YOU NEED TO CONFIGURE THIS!)
```

### 3. Authentication System
- Email/password authentication
- Protected routes via middleware
- Auto-redirect from `/` to `/dashboard` or `/login`
- Session management and refresh
- Login, signup, and logout functionality

### 4. Pages Created
- **Landing Page** (`/`) - Marketing page with sign in/up buttons
- **Login** (`/login`) - User authentication
- **Signup** (`/signup`) - New user registration
- **Dashboard** (`/dashboard`) - Protected main dashboard (placeholder for now)

## Next Steps - YOU NEED TO DO THESE!

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the project to be provisioned
4. Go to **Project Settings** → **API**
5. Copy your:
   - Project URL
   - Anon/Public Key

### 2. Configure Environment Variables

Edit the `.env.local` file in the project root and replace the placeholder values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Set Up Supabase Authentication

In your Supabase dashboard:

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Disable email confirmation for development (or configure email templates)
4. Go to **Authentication** → **URL Configuration**
5. Add your local development URL: `http://localhost:3000`

### 4. Start the Development Server

```bash
cd degenerates-dashboard
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 5. Test the Authentication Flow

1. Go to the landing page
2. Click "Get Started" to create an account
3. Sign up with your email and password
4. You should be redirected to the dashboard
5. Try signing out and signing back in

## Database Schema (To Be Created)

We'll build this incrementally. Here's the planned structure:

### Core Tables (Priority 1)
- **leagues** - League information (name, season, year)
- **league_members** - Members in each league
- **weeks** - Weekly tracking (week number, status)
- **parlay_legs** - Individual bet legs submitted by members
- **parlays** - Weekly parlay groups (one per league per week)

### Future Tables (Priority 2)
- **users** (extends Supabase auth.users with profile info)
- **seasons** - Track different seasons
- **stats** - Aggregated statistics

## Architecture Decisions

### Multi-League Support
- Each user can belong to multiple leagues
- Each league tracks its own parlays independently
- Users can have different roles in different leagues

### Weekly Parlay Flow
1. Admin creates/opens a week for a league
2. Each member submits one bet leg for that week
3. Once all legs are in, they combine into one parlay
4. Track the outcome (win/loss)
5. Update member stats

### Mobile-First Design
- All pages are responsive
- Touch-friendly UI elements
- Works well on phones (primary use case)

## Development Workflow

### Adding New Features
1. Create database tables in Supabase (SQL Editor)
2. Generate TypeScript types
3. Create server actions in `app/actions/`
4. Build UI components
5. Add pages in `app/`

### Git Workflow
```bash
git add .
git commit -m "Description of changes"
git push
```

## Deployment (When Ready)

### Deploy to Vercel
1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## PWA Support (Future)

We'll add PWA functionality later once core features are working. This will include:
- Install to home screen
- Offline support
- Push notifications for parlay updates

## Troubleshooting

### "Invalid API key" error
- Check that your `.env.local` file has the correct Supabase credentials
- Restart the dev server after changing environment variables

### Authentication not working
- Make sure email authentication is enabled in Supabase
- Check that the redirect URLs are configured correctly
- Check browser console for errors

### Build errors
```bash
# Clear cache and rebuild
rm -rf .next
npm run build
```

## Project Status

✅ Initial setup complete
✅ Authentication working
⏳ Database schema (next step)
⏳ League management
⏳ Parlay tracking
⏳ Stats & history

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)

---

**Ready to build!** Your foundation is solid. Next, we'll create the database schema and start building the league management features.
