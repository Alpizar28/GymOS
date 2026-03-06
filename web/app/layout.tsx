import type { Metadata } from "next";
import type { Viewport } from "next";
import Link from "next/link";
import {
  BrandIcon,
  HistoryIcon,
  ProfileIcon,
  RoutinesIcon,
  TodayIcon,
  WorkoutsIcon,
} from "@/components/icons";
import PwaRegister from "./pwa-register";
import AuthGuard from "./auth-guard";
import "./globals.css";

export const metadata: Metadata = {
  title: "GymOS — Training System",
  description: "Personal gym training dashboard with progression tracking and plan generation",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GymOS",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#09090b",
};

// Bottom tab bar (mobile) — 5 most-used items
const bottomTabs = [
  { href: "/today",    label: "Today", icon: TodayIcon },
  { href: "/routines", label: "Rutinas", icon: RoutinesIcon },
  { href: "/settings", label: "Historial", icon: HistoryIcon },
  { href: "/profile",  label: "Perfil", icon: ProfileIcon },
];

// Top nav (desktop only)
const topNavLinks = [
  { href: "/today",    label: "Today", icon: TodayIcon },
  { href: "/routines", label: "Routines", icon: RoutinesIcon },
  { href: "/workouts", label: "Workouts", icon: WorkoutsIcon },
  { href: "/settings", label: "Settings", icon: HistoryIcon },
  { href: "/profile",  label: "Perfil", icon: ProfileIcon },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Prevent double-tap zoom on buttons/inputs */}
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-[Inter] antialiased bg-zinc-950 text-zinc-100 min-h-screen">
        <PwaRegister />
        {/* ── Desktop top nav (hidden on mobile) ── */}
        <nav className="hidden sm:block fixed top-0 left-0 right-0 z-50 bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-800/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-16 gap-6">
            <span className="text-xl font-bold bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent">
              <span className="inline-flex items-center gap-2">
                <BrandIcon className="h-5 w-5" />
                GymOS
              </span>
            </span>
            <ul className="flex gap-1">
              {topNavLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-red-500/10 transition-all duration-200"
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* ── Main content ── */}
        {/* mobile: pt-4 pb-24 (space for bottom nav); desktop: pt-24 pb-12 */}
        <main className="max-w-2xl sm:max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-24 pb-28 sm:pb-12">
          <AuthGuard>{children}</AuthGuard>
        </main>

        {/* ── Mobile bottom tab bar (hidden on desktop) ── */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/60"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="flex">
            {bottomTabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex-1 min-w-0 flex flex-col items-center justify-center py-2 gap-1 text-zinc-500 active:text-red-400 touch-manipulation"
              >
                <tab.icon className="h-5 w-5" />
                <span className="text-[9px] font-semibold tracking-wide truncate max-w-full px-0.5">{tab.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </body>
    </html>
  );
}
