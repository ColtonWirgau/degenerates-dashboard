# Quick Start Guide

## Your Project is Ready! 🎉

All the initial setup is complete. Here's what you need to do to get running:

## Step 1: Configure Supabase (REQUIRED)

### Create a Supabase Project
1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Choose an organization (or create one)
4. Name your project: `degenerates-dashboard`
5. Set a strong database password
6. Choose a region close to you
7. Click "Create new project" and wait ~2 minutes

### Get Your API Credentials
1. Go to **Project Settings** (gear icon in sidebar)
2. Click **API** in the left menu
3. Copy these two values:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys")

### Update Environment Variables
1. Open `.env.local` in your project
2. Replace the placeholder values:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

### Enable Email Authentication
1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. **For development only**: Disable "Confirm email" (under Email Auth settings)
4. Go to **Authentication** → **URL Configuration**
5. Add `http://localhost:3000/**` to Site URL

## Step 2: Run the Development Server

```bash
cd degenerates-dashboard
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Step 3: Test Authentication

1. Click "Get Started" on the landing page
2. Fill out the signup form
3. You should be redirected to the dashboard
4. Try logging out and logging back in

If you see errors, check:
- Environment variables are correct
- Development server was restarted after changing `.env.local`
- Email provider is enabled in Supabase

## Next Steps

Now that authentication works, here's what to build next:

### Phase 1: Database Schema
Create these tables in Supabase:
- `leagues` - League information
- `league_members` - Who's in each league
- `weeks` - Weekly tracking
- `parlay_legs` - Individual bet submissions

### Phase 2: League Management
- Create league page
- Invite members
- View league members

### Phase 3: Parlay Tracking
- Create weekly parlays
- Submit bet legs
- Track outcomes

## Helpful Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run production build locally
npm start

# Lint code
npm run lint

# Add shadcn components
npx shadcn@latest add [component-name]
```

## Project Structure

```
degenerates-dashboard/
├── app/                    # Next.js App Router
│   ├── actions/           # Server Actions
│   ├── login/            # Login page
│   ├── signup/           # Signup page
│   ├── dashboard/        # Protected dashboard
│   └── page.tsx          # Landing page
├── components/
│   └── ui/               # shadcn components
├── lib/
│   ├── supabase/         # Supabase clients
│   └── utils.ts          # Helper functions
├── middleware.ts          # Auth middleware
├── .env.local            # Environment variables (CONFIGURE THIS!)
└── *.md                  # Documentation
```

## Common Issues

### "Invalid API key"
- Double-check your `.env.local` file
- Restart the dev server (`Ctrl+C` then `npm run dev`)
- Make sure you copied the **anon** key, not the service key

### "User already registered"
- Go to Supabase → Authentication → Users
- Delete the test user
- Try signing up again

### Page not found
- Make sure the dev server is running
- Check the URL is `http://localhost:3000`

## Documentation

- [SETUP.md](./SETUP.md) - Detailed setup guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture
- [README.md](./README.md) - Project overview

## Need Help?

Check the documentation files above, or review:
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [shadcn/ui Docs](https://ui.shadcn.com)

---

**You're all set!** Configure Supabase, run the dev server, and start building. 🚀
