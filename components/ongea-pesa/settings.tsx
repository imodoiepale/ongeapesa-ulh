"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { BadgeCheck, ChevronRight, HelpCircle, Languages, LogOut, MessageSquareWarning, Mic2, MoonStar, ShieldCheck, SunMedium, UsersRound } from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"
import { FluidNav, mobileNavItems } from "@/components/foundation"

const groups = [
  {
    title: "Account",
    rows: [
      { label: "Security center", detail: "PIN, passkeys and account protection", href: "/security-setup", icon: ShieldCheck },
      { label: "Permissions", detail: "Microphone, camera and notifications", href: "/permissions", icon: Mic2 },
      { label: "Family & friends", detail: "People you support", href: "/?screen=dependants", icon: UsersRound },
    ],
  },
  {
    title: "Support & voice",
    rows: [
      { label: "Help & support", detail: "Answers and ways to reach us", href: "/support", icon: HelpCircle },
      { label: "Report a problem", detail: "Tell us what broke, or how you use Ongea", href: "/feedback", icon: MessageSquareWarning },
      { label: "Teach Ongea Sheng", detail: "Record phrases to improve voice", href: "/training", icon: Languages },
    ],
  },
]

/** Single-icon dark/light toggle — lives in the top-right corner of the screen. */
function ThemeCorner() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="orbital-panel flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[hsl(var(--ink))] transition-colors hover:bg-black/[.04] dark:text-[hsl(var(--mint))] dark:hover:bg-white/[.06]"
    >
      {isDark
        ? <MoonStar className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.7} />
        : <SunMedium className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.7} />}
    </button>
  )
}

export default function Settings() {
  const router = useRouter()
  const { user, signOut } = useAuth()

  const email = user?.email ?? ""
  const displayName = useMemo(() => {
    const fromMeta = (user?.user_metadata?.full_name ?? user?.user_metadata?.name) as string | undefined
    if (fromMeta) return fromMeta
    const handle = email.split("@")[0] ?? ""
    return handle ? handle.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Your profile"
  }, [user, email])
  const initials = useMemo(
    () => displayName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "OP",
    [displayName],
  )

  return (
    <main id="main-content" className="orbital-page">
      <section className="orbital-screen mx-auto max-w-3xl">
        {/* Title left, dark/light toggle pinned to the right corner */}
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="orbital-label flex items-center gap-2 opacity-70">
              <i className="h-2 w-2 rounded-full bg-[hsl(var(--mint))]" />
              Account
            </span>
            <h1 className="orbital-display mt-4 text-4xl sm:text-5xl">Settings</h1>
          </div>
          <ThemeCorner />
        </header>

        {/* Profile hero */}
        <div className="orbital-panel mt-8 flex items-center gap-4 p-5">
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(var(--mint))] to-[hsl(var(--teal))] text-lg font-semibold text-[hsl(var(--ink))]">
            {initials}
            <BadgeCheck className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-[hsl(var(--pearl))] text-[hsl(var(--teal))] dark:bg-[hsl(var(--abyss))]" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-lg font-medium">{displayName}</strong>
            <small className="mt-1 block truncate text-xs opacity-55">{email}</small>
          </span>
          <button
            onClick={() => router.push("/security-setup")}
            aria-label="Manage account"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 transition-colors hover:bg-black/5 dark:border-white/12 dark:hover:bg-white/5"
          >
            <ChevronRight className="h-4 w-4 opacity-60" />
          </button>
        </div>

        {/* Grouped rows */}
        {groups.map((group) => (
          <div key={group.title} className="mt-8">
            <p className="orbital-label mb-3 opacity-50">{group.title}</p>
            <div className="orbital-panel divide-y divide-black/[.07] p-2 dark:divide-white/[.07]">
              {group.rows.map((row) => (
                <button
                  key={row.label}
                  onClick={() => router.push(row.href)}
                  className="flex min-h-[4.5rem] w-full items-center gap-4 rounded-2xl px-3 text-left transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.04]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--teal))]/10 text-[hsl(var(--teal))] dark:bg-[hsl(var(--mint))]/10 dark:text-[hsl(var(--mint))]">
                    <row.icon className="h-5 w-5" strokeWidth={1.6} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-medium">{row.label}</strong>
                    <small className="mt-1 block text-xs opacity-50">{row.detail}</small>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-35" />
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={signOut}
          className="mt-8 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-red-500/25 bg-red-500/[.06] text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </section>
      <FluidNav items={mobileNavItems} />
    </main>
  )
}
