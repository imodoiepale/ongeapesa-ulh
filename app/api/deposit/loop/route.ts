import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Top up the wallet via a LOOP Prompt.
 *
 * LOOP Prompt is a request-to-pay: it pushes a prompt to the customer's phone
 * and the money only arrives once they approve it. The n8n workflow books the
 * transactions row as 'processing' and settles it to 'completed' ONLY on
 * loop_prompt_callback — never on the synchronous response, which merely
 * confirms the prompt was delivered.
 *
 * That distinction is the whole reason this route returns a transaction_id
 * instead of a success flag: the dialog polls that row, so the balance rises
 * when money actually lands rather than when the prompt is sent.
 *
 * The browser never touches n8n directly — the user is resolved from the
 * session here, so a caller cannot top up someone else's wallet by changing a
 * request body.
 */

const N8N_BASE =
  process.env.N8N_WEBHOOK_BASE_URL || 'https://n8n-lc5r.srv1631847.hstgr.cloud'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const amount = Number(body.amount)
    let phone = String(body.phone ?? '').replace(/\s+/g, '')

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 })
    }
    if (amount < 10) {
      return NextResponse.json({ error: 'Minimum top-up is KSH 10' }, { status: 400 })
    }

    // Same normalisation the voice worker and NCBA rails use, so a number
    // typed as 07... reaches LOOP as 2547... regardless of entry style.
    if (phone.startsWith('+')) phone = phone.slice(1)
    if (phone.startsWith('0')) phone = '254' + phone.slice(1)
    if (phone && !phone.startsWith('254')) phone = '254' + phone
    if (!/^254\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: 'Enter a valid phone number, e.g. 07XXXXXXXX' },
        { status: 400 },
      )
    }

    const res = await fetch(`${N8N_BASE}/webhook/loop_prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        amount: String(amount),
        phone,
        narration: `Ongea Pesa top-up of KSH ${amount}`,
      }),
    })

    const row = await res.json().catch(() => null)

    if (!res.ok || !row?.id) {
      console.error('loop_prompt failed:', res.status, row)
      return NextResponse.json(
        { error: 'Could not send the LOOP prompt. Please try again.' },
        { status: 502 },
      )
    }

    return NextResponse.json({
      success: true,
      transaction_id: row.id,
      // 'processing' is the expected state here. Anything else means the
      // workflow settled synchronously, which for a prompt would be wrong.
      status: row.status,
      amount,
      message: 'Approve the prompt on your phone to complete the top-up.',
    })
  } catch (err: any) {
    console.error('deposit/loop error:', err)
    return NextResponse.json(
      { error: err?.message || 'Could not start the top-up' },
      { status: 500 },
    )
  }
}
