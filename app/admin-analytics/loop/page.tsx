"use client"

/**
 * LOOP rails — exact live configuration and what the voice agent recognised.
 *
 * Built for demoing: everything an observer would otherwise have to take on
 * trust (which environment, which till, which endpoint each intent maps to) is
 * on screen, next to the transactions those settings actually produced.
 *
 * The config here MIRRORS the n8n workflow's LOOP Config node. It is displayed,
 * never used to make a call — the workflow remains the single source of truth,
 * and a page that could diverge silently would be worse than no page.
 */

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import Layout from "@/components/kokonutui/layout"
import { cn } from "@/lib/utils"
import { RefreshCw, CheckCircle, XCircle, Clock, Radio } from "lucide-react"

const N8N_BASE = "https://n8n-lc5r.srv1631847.hstgr.cloud"

/** Mirrors "LOOP Config" in the loop Hackathon - Ongeapesa workflow. */
const LOOP_CONFIG = [
  { label: "Environment", value: "SANDBOX", warn: true },
  { label: "Base URL", value: "https://sandbox.loop.co.ke" },
  { label: "Merchant Till", value: "133239" },
  { label: "Signing", value: "HMAC-SHA256 · merchantTill|timestamp|nonce · lowercase hex" },
  { label: "Idempotency", value: "txnReference — a repeat is refused as duplicate (404)" },
]

/** Spoken intent → the tool the agent calls → where that lands. */
const INTENT_ROUTES = [
  { intent: "Send to M-Pesa", tool: "loop_send_mpesa", service: "MRCHNT_SENDMONEY", async: false },
  { intent: "Send inside LOOP", tool: "loop_send_loop", service: "MRCHNT_SENDMONEY", async: false },
  { intent: "Send to bank", tool: "loop_send_pesalink", service: "MRCHNT_SENDMONEY", async: false },
  { intent: "Pay LOOP till", tool: "loop_pay_till", service: "MRCHNT_PAYMENTS", async: false },
  { intent: "Pay M-Pesa till", tool: "loop_pay_mpesa_till", service: "MRCHNT_PAYMENTS", async: false },
  { intent: "Pay paybill", tool: "loop_pay_paybill", service: "MRCHNT_PAYMENTS", async: false },
  { intent: "Top up wallet", tool: "loop_prompt", service: "NEO_MRCHNT_RTP", async: true },
  { intent: "Check a payment", tool: "loop_txn_inquiry", service: "MRCHNT_TXN_INQUIRY", async: false },
]

type Tx = {
  id: string
  type: string | null
  amount: number | null
  status: string | null
  phone: string | null
  voice_command_text: string | null
  external_ref: string | null
  created_at: string
}

export default function LoopAdminPage() {
  const [rows, setRows] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("transactions")
      .select("id,type,amount,status,phone,voice_command_text,external_ref,created_at")
      .eq("provider", "loop")
      .order("created_at", { ascending: false })
      .limit(25)
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const statusIcon = (s: string | null) =>
    s === "completed" ? <CheckCircle className="h-4 w-4 text-emerald-500" />
      : s === "failed" ? <XCircle className="h-4 w-4 text-red-500" />
      : <Clock className="h-4 w-4 text-amber-500" />

  return (
    <Layout>
      <div className="mx-auto w-full max-w-4xl px-4 py-6 space-y-6">

        <div className="text-center space-y-1">
          <h1 className="og-screen-title text-foreground">LOOP Rails</h1>
          <p className="text-sm text-muted-foreground">
            Live configuration and recognised voice intents
          </p>
        </div>

        {/* Config — centred, so it reads as a statement of record. */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            LOOP Configuration
          </h2>
          <dl className="mx-auto max-w-2xl divide-y divide-border">
            {LOOP_CONFIG.map(c => (
              <div key={c.label} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-sm text-muted-foreground">{c.label}</dt>
                <dd className={cn(
                  "font-mono text-sm break-all sm:text-right",
                  c.warn ? "font-semibold text-amber-600 dark:text-amber-400" : "text-foreground",
                )}>
                  {c.value}
                </dd>
              </div>
            ))}
          </dl>
          {/* Stated plainly: a demo that looks live but is not would mislead. */}
          <p className="mx-auto mt-4 max-w-2xl rounded-lg bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-700 dark:text-amber-300">
            Sandbox — no real money moves. Switch <span className="font-mono">BASE</span> in the
            workflow&apos;s LOOP Config node to go live.
          </p>
        </section>

        {/* Intent → tool → endpoint. The mapping the agent actually uses. */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recognised Intent → LOOP Endpoint
          </h2>
          <div className="mx-auto max-w-3xl space-y-2">
            {INTENT_ROUTES.map(r => (
              <div key={r.tool} className="grid grid-cols-1 items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-4 py-3 sm:grid-cols-[1fr_auto_1fr]">
                <span className="text-center text-sm font-medium text-foreground sm:text-left">
                  {r.intent}
                  {r.async && (
                    <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-600 dark:text-sky-400">
                      async
                    </span>
                  )}
                </span>
                <span className="text-center text-muted-foreground">→</span>
                <span className="text-center font-mono text-xs text-muted-foreground sm:text-right">
                  <span className="text-foreground">{r.tool}</span>
                  <br />
                  <span className="opacity-70">{r.service}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-muted-foreground">
            All POST to <span className="font-mono">{N8N_BASE}/webhook/&lt;tool&gt;</span>.
            <br />
            <span className="text-sky-600 dark:text-sky-400">async</span> means the row stays
            <span className="font-mono"> processing</span> until LOOP calls back — money has not
            arrived until it does.
          </p>
        </section>

        {/* What those settings actually produced. */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent LOOP Transactions
            </h2>
            <button
              onClick={load}
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No LOOP transactions yet. Say &ldquo;tuma mia tano kwa LOOP&rdquo; to create one.
            </p>
          ) : (
            <div className="mx-auto max-w-3xl space-y-2">
              {rows.map(t => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-4 py-3">
                  {statusIcon(t.status)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {/* What the user actually said — the recognised intent. */}
                      {t.voice_command_text || t.type || "—"}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {t.type} · {t.phone || "—"}
                      {t.external_ref && <> · {t.external_ref}</>}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-foreground">
                      KSH {Number(t.amount ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Radio className="h-3 w-3" />
          LOOP payments currently bypass the platform fee and voice step-up.
        </p>
      </div>
    </Layout>
  )
}
