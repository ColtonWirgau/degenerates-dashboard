import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import { SplashScreen } from "@/components/chrome/splash-screen";
import "./globals.css";

const anton = Anton({
  weight: "400",
  variable: "--font-anton",
  subsets: ["latin"],
});

const inter = Inter({
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  subsets: ["latin"],
});

/** The iPhone sizes iOS actually matches a launch image against. It is
 *  famously literal about this: exact device-width/height/DPR, and many
 *  versions only honour the query when it names the orientation too. */
const SPLASH_SIZES: [number, number, number][] = [
  [440, 956, 3],
  [430, 932, 3],
  [428, 926, 3],
  [402, 874, 3],
  [393, 852, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 2],
];

export const metadata: Metadata = {
  title: {
    default: "Degenerates Dashboard",
    template: "%s — Degenerates Dashboard",
  },
  description:
    "A 12-leg parlay you all lose together every Sunday. The slate, the legs, the board, and the house rules.",
  // Served by app/manifest.ts. The hand-written public/manifest.json it
  // replaced disagreed with the viewport below about what colour the OS
  // chrome should be.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Degenerates",
    // The frame iOS holds on while the app boots: the bare canvas with
    // the lockup on it, so the launch reads as this app rather than as
    // a white flash followed by one.
    startupImage: SPLASH_SIZES.map(([w, h, r]) => ({
      url: `/pwa-splash/${w}x${h}@${r}x.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
  other: {
    // Next emits the modern `mobile-web-app-capable`; iOS's startup-image
    // machinery still keys off the apple-prefixed one.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // The canvas ground — the browser chrome should read as the same
  // surface the neon wash sits on, not legacy blue. The manifest says
  // the same thing; they used to disagree.
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${anton.variable} ${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
