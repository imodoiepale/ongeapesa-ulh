"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Eye, EyeOff, ReceiptText, ScanLine, Settings2 } from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { OrbitalMark } from "@/components/foundation"
import BalanceSheet from "./balance-sheet"
import PWAInstallPrompt from "./pwa-install-prompt"
import { isDebitTransaction, type TransactionRecord } from "./transaction-detail-sheet"

type Screen = "dashboard" | "voice" | "send" | "recurring" | "analytics" | "test" | "permissions" | "scanner" | "batch"

interface MainDashboardProps {
  onNavigate?: (screen: Screen) => void
  onOpenScanner?: () => void
}

interface SavedBill {
  id: string
  amount: number
  merchant?: string
  paybill?: string
  till?: string
  account?: string
  phone?: string
  type: string
}

/** Cycled under the mic so the affordance teaches itself — people don't guess what they may say. */
const voiceExamples = [
  "Tuma 500 kwa Mama",
  "Lipa KPLC elfu moja",
  "Balance yangu ni ngapi?",
  "Send 2,000 to 0712 345 678",
]

function greeting(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function initialsOf(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function billLabel(bill: SavedBill) {
  if (bill.merchant) return bill.merchant
  if (bill.paybill) return `Paybill ${bill.paybill}`
  if (bill.till) return `Till ${bill.till}`
  if (bill.phone) return bill.phone
  return "Saved bill"
}

/** Whole shillings throughout — Kenyan mobile money is whole-shilling in practice,
 *  and trailing decimals only eat width on an already-long number. */
const money = (value: number) => Math.round(Number(value) || 0).toLocaleString("en-KE")

export default function MainDashboard({ onNavigate, onOpenScanner }: MainDashboardProps) {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<TransactionRecord[]>([])
  const [bills, setBills] = useState<SavedBill[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [hello, setHello] = useState("Welcome back")
  const [example, setExample] = useState(0)

  const displayName = String(user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())

  useEffect(() => {
    setHidden(localStorage.getItem("hide-balance") === "true")
    // Clock-derived, so it waits for the client — otherwise SSR and the first
    // paint disagree about what time of day it is.
    setHello(greeting(new Date().getHours()))
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setExample((index) => (index + 1) % voiceExamples.length), 4200)
    return () => clearInterval(timer)
  }, [])

  // One request serves the balance, the ledger rows, the month spend and the
  // quick-transfer list — the same payload the /transactions screen reads.
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/transactions")
      if (!response.ok) return
      const body = await response.json()
      setBalance(Number(body?.balance ?? 0))
      setTransactions(Array.isArray(body?.transactions) ? body.transactions : [])
    } catch {
      setBalance((current) => current ?? 0)
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    void load()
    // Pending bills are staged by the receipt scanner; without a surface here
    // they sit unseen until the user happens to open the schedules screen.
    fetch("/api/bills")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setBills(Array.isArray(body?.bills) ? body.bills : []))
      .catch(() => setBills([]))

    const channel = supabase.channel("orbital-home-balance").on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}`,
    }, (payload) => setBalance(Number(payload.new?.wallet_balance ?? 0))).subscribe()

    const onWalletBalance = (event: Event) => {
      const next = Number((event as CustomEvent<{ balance?: number }>).detail?.balance)
      if (Number.isFinite(next)) setBalance(next)
      void load()
    }
    window.addEventListener("ongea:wallet-balance-updated", onWalletBalance)
    return () => {
      window.removeEventListener("ongea:wallet-balance-updated", onWalletBalance)
      void supabase.removeChannel(channel)
    }
  }, [supabase, user?.id, load])

  // Settled debits since the 1st. A flat figure, not a month-over-month
  // percentage — on a wallet with a handful of rows that percentage swings
  // wildly and reads as insight when it is noise.
  const spentThisMonth = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    let total = 0
    for (const tx of transactions) {
      if (tx.status !== "completed" || !isDebitTransaction(tx.type)) continue
      const at = new Date(tx.created_at).getTime()
      if (Number.isNaN(at) || at < start) continue
      total += Number(tx.amount || 0)
    }
    return total
  }, [transactions])

  const go = (screen: Screen, route?: string) => (onNavigate ? onNavigate(screen) : router.push(route || `/${screen}`))
  // Tapping the emblem opens the voice screen. It used to raise an isListening
  // flag in the shell that nothing ever read, so the tap did nothing at all.
  const speak = () => go("voice", "/voice")

  return (
    <main id="main-content" className="orbital-page">
      <section className="orbital-screen flex min-h-[100dvh] max-w-[31rem] flex-col space-y-4 pb-[calc(var(--bottom-nav-h)+5.5rem)]">
        {/* Welcome bar */}
        <header className="flex items-center gap-3 pt-1">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[hsl(var(--mint))] to-[hsl(var(--teal))] text-sm font-semibold text-[hsl(var(--ink))]">
            {initialsOf(displayName)}
          </span>
          <span className="min-w-0 flex-1">
            <small className="block text-xs opacity-50">{hello},</small>
            <strong className="block truncate font-[family-name:var(--font-label)] text-base font-semibold">{displayName}</strong>
          </span>
          <button
            onClick={() => router.push("/settings")}
            className="orbital-panel grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-black/[.04] dark:hover:bg-white/[.06]"
            aria-label="Open settings"
          >
            <Settings2 className="h-5 w-5" strokeWidth={1.6} />
          </button>
        </header>

        {/* Balance */}
        <div className="orbital-panel p-5">
          <div className="flex items-center justify-between">
            <span className="orbital-label flex items-center gap-2 opacity-55">
              <i className="h-2 w-2 rounded-full bg-[hsl(var(--mint))]" />
              Available
            </span>
            <button
              className="grid h-9 w-9 place-items-center rounded-full opacity-50 transition-opacity hover:opacity-100"
              aria-label={hidden ? "Show balance" : "Hide balance"}
              onClick={() => setHidden((value) => { localStorage.setItem("hide-balance", String(!value)); return !value })}
            >
              {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>

          <button onClick={() => setSheetOpen(true)} className="mt-1 block w-full text-left" aria-label="Open wallet balance">
            <span className="orbital-money block text-[clamp(2.6rem,12vw,3.5rem)]">
              {balance === null ? "—" : hidden ? "KSh •••••" : `KSh ${money(balance)}`}
            </span>
          </button>
          <p className="mt-1 text-sm opacity-45">
            {hidden ? "•••••" : `KSh ${money(spentThisMonth)}`} spent this month
          </p>
        </div>

        {/* Bills to pay — real staged bills only; the section disappears when empty */}
        {bills.length > 0 && (
          <div className="orbital-panel p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold">Bills to pay</h2>
              <button onClick={() => go("recurring")} className="text-sm opacity-45 transition-opacity hover:opacity-90">See all</button>
            </div>
            <div className="mt-2 divide-y divide-black/[.06] dark:divide-white/[.06]">
              {bills.slice(0, 3).map((bill) => (
                <button key={bill.id} onClick={() => go("recurring")} className="flex min-h-[3.75rem] w-full items-center gap-3 text-left">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/[.05] dark:bg-white/[.07]">
                    <ReceiptText className="h-4 w-4" strokeWidth={1.7} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-medium">{billLabel(bill)}</strong>
                    <small className="mt-0.5 block truncate text-xs opacity-45">{bill.account || "Awaiting payment"}</small>
                  </span>
                  <strong className="shrink-0 text-sm tabular-nums">{hidden ? "•••" : money(bill.amount)}</strong>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-25" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Voice hero — takes whatever height the cards leave over, so the
            emblem sits in the optical centre of the screen rather than the
            page ending in dead space. */}
        <button
          onClick={speak}
          className="flex flex-1 flex-col items-center justify-center gap-6 py-4 text-center"
        >
          <span className="relative grid aspect-square w-[min(58vw,15rem)] place-items-center">
            <i className="absolute inset-[12%] animate-ping rounded-full bg-[hsl(var(--mint))]/18 [animation-duration:2.8s] motion-reduce:hidden" />
            <i className="absolute inset-0 rounded-full border border-[hsl(var(--mint))]/25" />
            <OrbitalMark className="relative h-[78%] w-[78%]" />
          </span>
          <span className="block">
            <strong className="orbital-display block text-2xl">Say what you need</strong>
            <small className="mt-2 block text-sm opacity-55">“{voiceExamples[example]}”</small>
          </span>
        </button>

      </section>

      {/* Money actions dock 5px above the bottom nav — they are the actions the
          screen exists for, so they stay reachable instead of scrolling away.
          Buttons blur what passes behind them since their fills are translucent. */}
      <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+5px)] z-40 lg:bottom-5">
        <div className="mx-auto grid w-full max-w-[31rem] grid-cols-[1fr_1fr_auto] gap-2.5 px-[clamp(1.25rem,4vw,3rem)]">
          <button
            onClick={() => setSheetOpen(true)}
            className="flex h-16 items-center gap-3 rounded-[1.35rem] bg-[hsl(var(--mint))]/22 backdrop-blur-xl px-3 text-left transition-colors hover:bg-[hsl(var(--mint))]/32 active:scale-[.99]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[hsl(var(--mint))]/25 text-[hsl(var(--teal))] dark:text-[hsl(var(--mint))]">
              <ArrowDownLeft className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.9} />
            </span>
            <span className="truncate text-sm font-medium">Deposit</span>
          </button>

          <button
            onClick={() => go("send")}
            className="flex h-16 items-center gap-3 rounded-[1.35rem] bg-black/[.06] backdrop-blur-xl px-3 text-left transition-colors hover:bg-black/[.1] active:scale-[.99] dark:bg-white/[.05] dark:hover:bg-white/[.09]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/[.06] dark:bg-white/[.08]">
              <ArrowUpRight className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.9} />
            </span>
            <span className="truncate text-sm font-medium">Send</span>
          </button>

          <button
            onClick={() => (onOpenScanner ? onOpenScanner() : go("scanner", "/scanner"))}
            aria-label="Scan a bill or receipt"
            className="grid h-16 w-16 shrink-0 place-items-center rounded-[1.35rem] bg-black/[.06] backdrop-blur-xl transition-colors hover:bg-black/[.1] active:scale-[.99] dark:bg-white/[.05] dark:hover:bg-white/[.09]"
          >
            <ScanLine className="h-5 w-5" strokeWidth={1.7} />
          </button>
        </div>
      </div>

      <BalanceSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} currentBalance={balance ?? 0} onBalanceUpdate={setBalance} />
      <PWAInstallPrompt />
    </main>
  )
}
