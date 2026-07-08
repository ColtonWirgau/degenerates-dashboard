import { Button } from "@/components/ui/button";
import { getLeagues } from "@/app/actions/leagues";
import { getCurrentUser } from "@/lib/data/auth-bridge";
import { getDevToolbarData, getDevPhaseData } from "@/lib/data/dev-toolbar-data";
import { UserMenu } from "@/components/user-menu";
import Link from "next/link";

export async function Header() {
  const me = await getCurrentUser();
  const [{ leagues }, mock, devPhase] = await Promise.all([
    me ? getLeagues() : Promise.resolve({ leagues: [] }),
    getDevToolbarData(),
    getDevPhaseData(),
  ]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-primary/20">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="group">
          {/* Mobile: monogram — pink D sits behind, cyan D in front. We pull
              the second letter back with negative tracking and lift the
              first letter's stacking order so it overlaps the pink edge. */}
          <h1 className="font-bold leading-none flex items-center whitespace-nowrap sm:gap-2">
            <span className="relative z-10 text-neon-blue group-hover:text-primary transition-colors text-3xl sm:text-2xl tracking-[-0.18em] sm:tracking-tight">
              <span className="sm:hidden">D</span>
              <span className="hidden sm:inline">DEGENERATES</span>
            </span>
            <span className="relative z-0 text-neon-pink group-hover:text-neon-blue transition-colors text-3xl sm:text-2xl tracking-tight">
              <span className="sm:hidden">D</span>
              <span className="hidden sm:inline">DASHBOARD</span>
            </span>
          </h1>
        </Link>

        {me ? (
          <UserMenu user={me} leagues={leagues} mock={mock} devPhase={devPhase} />
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" className="text-foreground hover:text-primary">
                Sign In
              </Button>
            </Link>
            <Link href="/">
              <Button className="neon-glow-blue">Get Started</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
