# Ongea Pesa × LOOP — pitch deck copy

Every word on the eight slides, in reading order, character for character.
Transcribed from `ongea-pesa-loop-deck.html` — if you change one, change the other.

Each slide is laid out the same way: an **eyebrow** across the top rule (left and
right), the body, then a **footer** across the bottom rule (left and right).
Labels in square brackets name the role the text plays; they are not text that
appears on the slide.

**Casing.** Eyebrows, kickers, footers and the small mono detail lines are set in
sentence case in the source and rendered in uppercase by the design. They appear
here in their source casing — the form you would edit.

**Punctuation.** Apostrophes are `’` and quotation marks are `“ ”` throughout the
deck. They are reproduced exactly below. Keep them typographic if you edit.

---

## Slide 1 — Cover

**Eyebrow left** · Ongea Pesa · pitch deck
**Eyebrow right** · by NSAIT · Nairobi

[Kicker] Conversational payments · Kenya

# ONGEA PESA

[Sub, line 1] **Ongea. Pesa itembee.**
[Sub, line 2] Speak. Let money move.

[Lede] Say it or type it — **“Send KES 2,000 to Mum.”** It reads the instruction
back, you confirm, and it settles over **LOOP** — NCBA’s licensed banking rails.

[Art] The orbital mark — a glowing core wrapped in soundwave rings.

**Footer left** · Speak. Send. Done.
**Footer right** · 8 slides · scroll or press →

---

## Slide 2 — Background

**Eyebrow left** · 01 · Background
**Eyebrow right** · Ongea Pesa

# Money already moves through chat, feeds and phones.<br>*The experience hasn’t caught up.*

[Lede] Individuals, merchants and small businesses increasingly pay and get paid
across mobile, online and social-commerce channels. **The rails work.** What sits on
top of them is still fragmented, technical and hard to manage — and for anyone who
can’t rely on a screen, often impossible.

### Three cards

**INDIVIDUALS — Send, request, understand**
Paying a person, asking to be paid, and knowing where the month went. Today those
are three different places, and none of them talk to each other.
`PAY · REQUEST · TRACK`

**MERCHANTS & SMALL BUSINESSES — Sold in the conversation**
The order arrives on WhatsApp or Instagram. The money lands somewhere else
entirely, with nothing attaching it back to the customer.
`SOCIAL COMMERCE · ORDERS`

**BLIND & LOW-VISION USERS — Shut out by design**
Unlabelled controls and journeys built around seeing the screen exclude people who
navigate by ear and by touch — from ordinary payments.
`SCREEN READERS · VOICE-ONLY PATHS`

**Footer left** · Individuals · merchants · small businesses
**Footer right** · 01 / 08

---

## Slide 3 — The problem

**Eyebrow left** · 02 · The problem
**Eyebrow right** · Five places it breaks

# Payments still ask you to<br>*see it, remember it and retype it.*

### Five clusters — three across, then two across

**NAVIGATION — Menus before money**
Steps to remember, account details keyed in by hand, and confirmation messages
written for systems rather than for people.

**ACCESSIBILITY — Journeys that assume you can see**
Inaccessible interfaces, poorly labelled controls and payment flows that depend on
visual interaction leave blind and visually impaired users stranded.

**LANGUAGE — Nothing like ordinary talk**
“Send KES 2,000 to Mum” is how a person thinks. Every app makes you translate that
into screens, fields and menus first.

**MERCHANTS — The payment arrives on its own**
Money from a WhatsApp or Instagram sale lands with no customer, no order and no
conversation attached — so merchants fall back on screenshots and searching records
by hand to work out who paid, what for, and whether to ship.

**AFTERWARDS — Nobody closes the loop**
Once the money has moved, there is no simple, accessible way to check status,
understand spending, watch cash flow, spot the requests that went unpaid, or
reconcile what came in against what went out.

### Consequence strip

**What it costs** Payment errors · Delayed fulfilment · Fraud exposure · Poor
financial visibility · Users with disabilities left out

**Footer left** · The rails are not the problem — the surface is
**Footer right** · 02 / 08

---

## Slide 4 — The solution

**Eyebrow left** · 03 · The solution
**Eyebrow right** · Say it · Hear it back · Done

# Say it. Hear it back. *Send it.*

### Three utterances, and what each one does

| Said or typed | What it does |
|---|---|
| “Send KES 2,000 to Mum.” | `PAYS OUT · SEND MONEY` |
| “Request KES 5,000 from John.” | `ASKS TO BE PAID · LOOP PROMPT` |
| “How much did I spend this week?” | `ANSWERS · NO MENU, NO EXPORT` |

[Art] The voice rule: a waveform in three bands sitting directly above the three
steps. The left band is the sentence being spoken, the middle is the hold while you
confirm, the right is the send resolving into a settled line and a green dot.

### Three steps

**STEP 01 — Say it or type it**
One sentence carries the **amount**, the **counterparty** and the **intent** — pay,
request, or just answer a question. Typed and spoken take exactly the same path.
English, Kiswahili or Sheng.
`VOICE OR TEXT · SAME RESULT`

**STEP 02 — Hear it back**
It reads the whole instruction back before anything moves, then holds for a **PIN or
Face/Touch ID**. Every confirmation is spoken as well as shown, so **no step needs
the screen**. The biometric match stays on your handset.
`STEP-UP TOKEN · SCREEN-READER SAFE`

**STEP 03 — Done, and accounted for**
It leaves on the right LOOP rail, the status is followed to settlement, and the
record lands against the right customer, order or request — so it reconciles itself
instead of waiting for a screenshot.
`TRACKED · RECONCILED · AUDITED`

**Footer left** · One sentence, in your own language, however you navigate
**Footer right** · 03 / 08

---

## Slide 5 — Built on LOOP

*The one light slide in the deck.*

**Eyebrow left** · 04 · Built on LOOP
**Eyebrow right** · NCBA · sandbox verified

# The voice is ours.<br>*The rails are LOOP’s.*

[Lede] LOOP is **NCBA’s developer platform** — the licensed pipe that actually moves
the shillings. Every sentence a user speaks lands on one of these eight endpoints:
**a send, a request to pay, a till or paybill, or a status check.** We wired all
eight end to end in the LOOP sandbox.

### The eight endpoints

| Operation | serviceCode | Direction |
|---|---|---|
| LOOP Prompt — request to pay | `NEO_MRCHNT_RTP` | money in |
| Send Money — LOOP wallet | `MRCHNT_SENDMONEY` | money out |
| Send Money — M-Pesa | `MRCHNT_SENDMONEY` | money out |
| Send Money — PesaLink (bank) | `MRCHNT_SENDMONEY` | money out |
| Pay to LOOP Till | `MRCHNT_PAYMENTS` | money out |
| Pay to M-Pesa Till | `MRCHNT_PAYMENTS` | money out |
| Pay to M-Pesa Paybill | `MRCHNT_PAYMENTS` | money out |
| Transaction Status Inquiry | `MRCHNT_TXN_INQUIRY` | read only |

### Environments and auth

| Label | Value |
|---|---|
| Sandbox | `sandbox.loop.co.ke/gateway/…` |
| Production | `api.loop.co.ke/gateway/…` |
| Auth | `OAuth 2.0 client_credentials → short-lived Bearer` |
| Signing | `HMAC-SHA256 merchantTill\|timestamp\|nonce` |

[Panel note] Paying out is one question: is the destination a LOOP wallet, an
M-Pesa number, a bank account, or a till? **“Request KES 5,000 from John”** inverts
it — LOOP Prompt asks the payer instead.

### Links

- [LOOP developer portal](https://sandbox.loop.co.ke/devportal/docs/loop-api/)
- [unleashed-loop.dev-skill](https://github.com/imodoiepale/unleashed-loop.dev-skill)
- [Reference index](https://github.com/imodoiepale/unleashed-loop.dev-skill/blob/main/skills/loop-api/references/INDEX.md)
- [api-flows](https://github.com/imodoiepale/unleashed-loop.dev-skill/blob/main/skills/loop-api/references/api-flows.md)
- [authorisation](https://github.com/imodoiepale/unleashed-loop.dev-skill/blob/main/skills/loop-api/references/authorisation.md)
- [overview](https://github.com/imodoiepale/unleashed-loop.dev-skill/blob/main/skills/loop-api/references/overview.md)

**Footer left** · 8 endpoints wired · sandbox to production is a base-URL swap
**Footer right** · 04 / 08

---

## Slide 6 — Why it doesn’t guess

**Eyebrow left** · 05 · Why it doesn’t guess
**Eyebrow right** · loop-api · open source

# A banking API punishes guessing.<br>*So we took the guessing out.*

[Lede] Ask any AI assistant about LOOP and it will invent an endpoint that sounds
right. We built and open-sourced **loop-api** — a skill that hands the assistant
LOOP’s real documentation and one rule: **never state an endpoint, a field or an
error code from memory.** Every answer cites the page it came from.

### Three traps that cost real money

**HTTP 200 doesn’t mean it worked**
The gateway answers `200` for failures too. Branch on `statusCode` inside the body —
or you book failed payments as paid.

**Retrying wrong pays twice**
On a timeout, retry with the **same** `txnReference`. A fresh one can send the money
again. A “duplicate” rejection is good news.

**It says RSA. It is not RSA**
Every page repeats the line. The real scheme is `HMAC-SHA256` over
`merchantTill|timestamp|nonce`, lowercase hex — and the fields go **inside**
requestParameters.

### Proof

`11/13 doc pages` · `4/4 HMAC vectors reproduced` · `15 doc conflicts logged` ·
`35 tests passing` · `MIT · runs offline` · `never touches your keys`

### Links

- [SKILL.md](https://github.com/imodoiepale/unleashed-loop.dev-skill/blob/main/skills/loop-api/SKILL.md)
- [conventions](https://github.com/imodoiepale/unleashed-loop.dev-skill/blob/main/skills/loop-api/references/conventions.md)
- [signing](https://github.com/imodoiepale/unleashed-loop.dev-skill/blob/main/skills/loop-api/references/signing.md)
- [doc-conflicts](https://github.com/imodoiepale/unleashed-loop.dev-skill/blob/main/skills/loop-api/references/doc-conflicts.md)
- [coverage](https://github.com/imodoiepale/unleashed-loop.dev-skill/blob/main/skills/loop-api/references/coverage.md)
- [security-testing](https://github.com/imodoiepale/unleashed-loop.dev-skill/blob/main/skills/loop-api/references/security-testing.md)

**Footer left** · Unofficial · not affiliated with LOOP or NCBA · confirm fees & limits with LOOP
**Footer right** · 05 / 08

---

## Slide 7 — Closing the loop

**Eyebrow left** · 06 · Closing the loop
**Eyebrow right** · After the money moves

# A payment isn’t finished<br>*when the money leaves.*

### Six cards

**ACCESSIBILITY — Built for ears, not just eyes**
Every journey completes by voice alone. Controls are labelled, confirmations are
spoken, and nothing depends on seeing where a button sits.
`VOICE-ONLY PATHS · LABELLED CONTROLS`

**INSIGHT — Ask about your own money**
“How much did I spend this week?” gets a plain answer. Spending, cash flow and
category breakdowns without a single export or spreadsheet.
`SPEND · CASH FLOW · CATEGORIES`

**REQUESTS — Requests that don’t go quiet**
A request to pay stays visible until it settles, so unpaid ones surface on their own
instead of being remembered by whoever is owed.
`LOOP PROMPT · UNPAID SURFACED`

**MERCHANTS — The payment knows the order**
Money arriving from a chat or a social sale carries its customer and its order with
it, so fulfilment stops depending on screenshots and manual searching.
`CUSTOMER · ORDER · CONVERSATION`

**TRUST — Traceable by default**
A PIN or passkey mints a short-lived token and nothing spends without one. Row-level
security on all 22 tables; every sensitive action writes an audit event.
`STEP-UP · RLS · AUDIT LOG`

**AND STILL — Chama, escrow, scan-a-bill**
Group collections with rotating payouts, milestone escrow for deals that need
holding, and Gemini Vision reading paybills, tills and receipts so nothing is typed.
`CHAMA · ESCROW · GEMINI VISION`

**Footer left** · Async results reconcile by provider reference — idempotent, both directions
**Footer right** · 06 / 08

---

## Slide 8 — Asante

**Eyebrow left** · Asante sana
**Eyebrow right** · ongeapesa.com

[Kicker] Fewer steps · fewer errors · nobody locked out

# ASANTE

[Sub] **The bank that listens.**

### What people say — or type

- “Send KES 2,000 to Mum.”
- “Request KES 5,000 from John.”
- “How much did I spend this week?”
- “Chama yetu, collect for June.”

[Closing line] Said out loud or typed with a thumb, in English, Kiswahili or Sheng —
and readable end to end by a screen reader. That is the whole product.

### Links

- [unleashed-loop.dev-skill](https://github.com/imodoiepale/unleashed-loop.dev-skill)
- [LOOP developer portal](https://sandbox.loop.co.ke/devportal/docs/loop-api/)
- [nsait.co.ke](https://nsait.co.ke)

**Footer left** · hello@ongeapesa.com · @OngeaPesa
**Footer right** · Built in Nairobi 🇰🇪 by NSAIT · Nairobi Space of AI Tools

---

## Notes on the copy

- **Say *or* type.** Voice is the headline but typed input is a first-class path,
  and the copy says so on slides 1, 4 and 8. Don’t reintroduce “no typing”.
- **Accessibility is a pillar, not a feature.** It carries a cluster on slide 3, a
  step on slide 4 and a card on slide 7. If a slide gets cut, don’t let it be the
  accessible one.
- The four lines on slide 8 are **spoken or typed commands** — what people say to
  the product. They are not testimonials and carry no attribution. Don’t add names.
- Slides 5 and 6 come from
  [`unleashed-loop.dev-skill`](https://github.com/imodoiepale/unleashed-loop.dev-skill),
  which transcribes LOOP’s published documentation. The skill is unofficial and not
  affiliated with LOOP or NCBA, and fees, limits and settlement terms must be
  confirmed with LOOP directly — slide 6’s footer carries both caveats and should
  stay.
- The language is named **Kiswahili** throughout, not “Swahili”.

### What changed, and why

An earlier version of this deck framed the problem as USSD friction for the
"M-Pesa generation", with a `*334#` graphic and a table of figures — 7–12 steps,
2–3 minutes, 15–20% wrong digits, ~40% struggling, 100% manual entry — under the
line "Ongea Pesa internal product research, 2026."

Those figures came from the repository's own product overview. **The source line
did not** — there is no such research document, and that attribution was invented.
The whole USSD framing also missed what this is actually for: merchants and small
businesses selling in chat, and blind and visually impaired users locked out of
visual payment journeys.

Slides 2, 3, 4, 7 and 8 were rewritten against the real brief. The invented source
line is gone, and slide 3 now carries five named problem clusters rather than
unsourced numbers. If you want numbers back on that slide, add ones you can cite.
