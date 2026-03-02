import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "GymOS — Training System",
  description: "Personal gym training dashboard with progression tracking and plan generation",
};

const navLinks = [
  { href: "/today", label: "Today", icon: "🏋️" },
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/workouts", label: "Workouts", icon: "📝" },
  { href: "/progress", label: "Progress", icon: "📈" },
  { href: "/library", label: "Library", icon: "📚" },
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
      </head>
      <body className="font-[Inter] antialiased bg-zinc-950 text-zinc-100 min-h-screen">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-800/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-16 gap-6">
            <span className="text-xl font-bold bg-gradient-to-r from-violet-500 to-indigo-400 bg-clip-text text-transparent">
              🏋️ GymOS
            </span>
            <ul className="flex gap-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-violet-500/10 transition-all duration-200"
                  >
                    <span className="mr-1.5">{link.icon}</span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Main content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-12">
          {children}
        </main>
      </body>
    </html>
  );
}
