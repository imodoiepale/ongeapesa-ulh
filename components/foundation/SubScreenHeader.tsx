/**
 * SubScreenHeader — canonical chrome for every screen reached *from* Settings.
 *
 * Settings children (security, permissions, support, feedback, training) are
 * dead ends in the nav: the bottom FluidNav has no tab for them, so without an
 * explicit back control the only way out is the browser gesture. This gives
 * them one, plus the same eyebrow + display-title masthead the Settings screen
 * itself uses, so the whole branch reads as one surface.
 *
 * Usage:
 *   <SubScreenHeader eyebrow="Account & trust" title="Permissions"
 *                    subtitle="What Ongea Pesa may use on this device" />
 */

"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface BackLinkProps {
  /** Where "back" goes. Defaults to Settings — the entry point for this branch. */
  href?: string
  label?: string
  className?: string
}

export function BackLink({ href = "/settings", label = "Back to settings", className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "orbital-label inline-flex min-h-11 items-center gap-2 rounded-full opacity-55 transition-opacity hover:opacity-100",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={2} />
      {label}
    </Link>
  )
}

interface SubScreenHeaderProps extends BackLinkProps {
  /** Small uppercase kicker above the title, with the mint dot. */
  eyebrow?: string
  title: string
  subtitle?: string
  /** Optional right-corner slot (mirrors the theme toggle on Settings). */
  children?: React.ReactNode
}

export function SubScreenHeader({
  eyebrow,
  title,
  subtitle,
  href,
  label,
  className,
  children,
}: SubScreenHeaderProps) {
  return (
    <header className={cn("pt-2", className)}>
      <BackLink href={href} label={label} />
      <div className="mt-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <span className="orbital-label flex items-center gap-2 opacity-70">
              <i className="h-2 w-2 rounded-full bg-[hsl(var(--mint))]" />
              {eyebrow}
            </span>
          )}
          <h1 className="orbital-display mt-4 text-4xl sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-3 max-w-lg text-sm opacity-55">{subtitle}</p>}
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </header>
  )
}
