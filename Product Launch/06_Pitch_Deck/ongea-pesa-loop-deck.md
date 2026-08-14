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

[Kicker] Voice-first money · Kenya

# ONGEA PESA

[Sub, line 1] **Ongea. Pesa itembee.**
[Sub, line 2] Speak. Let money move.

[Lede] You say the payment in your own words. We show it back to you. Then it goes
out over **LOOP** — NCBA’s licensed banking rails.

[Art] The orbital mark — a glowing core wrapped in soundwave rings.

**Footer left** · Speak. Send. Done.
**Footer right** · 8 slides · scroll or press →

---

## Slide 2 — Background

**Eyebrow left** · 01 · Background
**Eyebrow right** · Ongea Pesa

# Money here already moves by phone.<br>*It just doesn’t move by voice.*

[Lede] Kenya runs on mobile money — but every shilling still travels through a menu
tree you type your way down. Ongea Pesa is the layer on top: **a payment you can
simply say out loud**, in English, Kiswahili or Sheng, on any phone with a browser.

### Three cards

**WHO IT’S FOR — The M-Pesa generation**
Hustlers, chama members, mama mbogas, small traders. Mobile-only, Sheng-fluent, and
far more comfortable speaking than typing.
`MOBILE-ONLY · SHENG-FLUENT`

**WHAT IT DOES — Say it, confirm it, sent**
One sentence carries the whole instruction — amount, recipient, rail. You review it
on screen before a single shilling moves.
`ENGLISH · KISWAHILI · SHENG`

**WHERE IT RUNS — A PWA, built in Nairobi**
No app store, no 200MB download. It installs from the browser and works on the
handsets people already carry.
`INSTALLABLE PWA · OFFLINE-TOLERANT`

**Footer left** · Positioning · The bank that listens
**Footer right** · 01 / 08

---

## Slide 3 — The problem

**Eyebrow left** · 02 · The problem
**Eyebrow right** · Friction, measured

# To send one payment,<br>you press *twelve things*<br>and hope.

[Lede] The technology isn’t the hard part. **The typing is.** Every wrong digit is
somebody’s rent landing in a stranger’s account.

[Ghost type] `*334#`
[Caption] Still the front door to most people’s money

### The numbers

| | |
|---|---|
| **7–12** | menu steps to complete a single send |
| **2–3 min** | start to finish, if nothing goes wrong |
| **15–20%** | of attempts carry a wrong digit or a wrong amount |
| **~40%** | of users struggle with the menus — elderly, low-vision, low-literacy |
| **100%** | of a paper bill is still keyed in by hand, digit by digit |

[Source note] Ongea Pesa internal product research, 2026.

**Footer left** · Nobody’s problem is the technology
**Footer right** · 02 / 08

---

## Slide 4 — The solution

**Eyebrow left** · 03 · The solution
**Eyebrow right** · Speak · Verify · Done

# Say it. See it. *Send it.*

[Spoken line] **“Tuma elfu mbili kwa Mama Boi.”**
[Gloss] Send two thousand to Mama Boi — one sentence, no menu.

[Art] The voice rule: a waveform in three bands sitting directly above the three
steps. The left band is the sentence being spoken, the middle is the hold while you
confirm, the right is the send resolving into a settled line and a green dot.

### Three steps

**STEP 01 — Speak**
The voice agent pulls out the **amount**, the **recipient** and the **rail** — and
resolves “Mama Boi” against your saved contacts. English, Kiswahili, Sheng.
`INTENT + ENTITIES · CONTACT MATCH`

**STEP 02 — Verify**
We read it back and hold. Nothing moves without a **PIN or Face/Touch ID**. The
biometric match happens on your handset — we hold a public key, **never a face**.
`STEP-UP TOKEN · SHORT-LIVED`

**STEP 03 — Done**
The payment leaves on the right rail, the balance updates live, and the receipt is
already in your history before you’ve put the phone down.
`LOOP · M-PESA · PESALINK · TILL`

**Footer left** · One sentence of your own language
**Footer right** · 03 / 08

---

## Slide 5 — Built on LOOP

*The one light slide in the deck.*

**Eyebrow left** · 04 · Built on LOOP
**Eyebrow right** · NCBA · sandbox verified

# The voice is ours.<br>*The rails are LOOP’s.*

[Lede] LOOP is **NCBA’s developer platform** — the licensed pipe that actually moves
the shillings. We wired it end to end in the LOOP sandbox: money in, money out, and
a status lookup that tells us the truth about what happened.

### The eight endpoints

| Operation | serviceCode | Direction |
|---|---|---|
| Send Money — LOOP wallet | `MRCHNT_SENDMONEY` | money out |
| Send Money — M-Pesa | `MRCHNT_SENDMONEY` | money out |
| Send Money — PesaLink (bank) | `MRCHNT_SENDMONEY` | money out |
| LOOP Prompt — request to pay | `NEO_MRCHNT_RTP` | money in |
| Pay to LOOP Till | `MRCHNT_PAYMENTS` | money out |
| Pay to M-Pesa Till | `MRCHNT_PAYMENTS` | money out |
| Pay to M-Pesa Paybill | `MRCHNT_PAYMENTS` | money out |
| Transaction Status Inquiry | `MRCHNT_TXN_INQUIRY` | read only |

*On the slide these run in the order: LOOP Prompt, the three Send Money rows, the
three Pay to rows, then Transaction Status Inquiry.*

### Environments and auth

| Label | Value |
|---|---|
| Sandbox | `sandbox.loop.co.ke/gateway/…` |
| Production | `api.loop.co.ke/gateway/…` |
| Auth | `OAuth 2.0 client_credentials → short-lived Bearer` |
| Signing | `HMAC-SHA256 merchantTill\|timestamp\|nonce` |

[Panel note] Routing comes down to one question: is the destination a LOOP wallet,
an M-Pesa number, a bank account, or a till?

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

## Slide 7 — And then some

**Eyebrow left** · 06 · And then some
**Eyebrow right** · Beyond the send

# Everything else we built<br>*while we were in there.*

### Six cards

**SCAN — Point at the bill**
Gemini Vision reads paybills, tills, QR codes, receipts and bank slips — account,
amount and reference come out filled in. Pay now, or save it for later.
`GEMINI VISION · CONFIDENCE-SCORED`

**CHAMA — The group, handled**
Start a collection and every member gets their own prompt. Cycles, contributions and
rotating payouts tracked without a WhatsApp argument.
`STK PER MEMBER · CYCLES · PAYOUTS`

**ESCROW — Money that waits**
Funds park against milestones and only release when both sides agree. Disputes have
an actual path instead of a phone call.
`MILESTONES · PARTICIPANTS · DISPUTES`

**SECURITY — Step-up before it spends**
A PIN or passkey mints a short-lived token, and no send or withdrawal moves without
one. Five bad tries locks the account for fifteen minutes.
`PIN · WEBAUTHN PASSKEY · LOCKOUT`

**DATA — Locked by default**
Row-level security on all 22 tables, so a user’s rows are reachable only by that
user. Every sensitive action writes an audit event.
`RLS ON 22 TABLES · AUDIT LOG`

**ORCHESTRATION — One nervous system**
A 145-node workflow routes voice intents, provider callbacks and reconciliation. A
result that arrives twice is only ever counted once.
`n8n · CALLBACKS · RECONCILIATION`

**Footer left** · Async results reconcile by provider reference — idempotent, both directions
**Footer right** · 06 / 08

---

## Slide 8 — Asante

**Eyebrow left** · Asante sana
**Eyebrow right** · ongeapesa.com

[Kicker] Fewer taps · fewer wrong digits · more people who can just ask

# ASANTE

[Sub] **The bank that listens.**

### What people say to it

- “Tuma elfu mbili kwa Mama Boi.”
- “Lipa hii bill ya stima.”
- “Chama yetu, collect for June.”
- “Balance yangu ni ngapi?”
- “Nitumie change, haraka.”

[Closing line] Five sentences. No menus, no typing, no wrong digits. That is the
whole product.

### Links

- [unleashed-loop.dev-skill](https://github.com/imodoiepale/unleashed-loop.dev-skill)
- [LOOP developer portal](https://sandbox.loop.co.ke/devportal/docs/loop-api/)
- [nsait.co.ke](https://nsait.co.ke)

**Footer left** · hello@ongeapesa.com · @OngeaPesa
**Footer right** · Built in Nairobi 🇰🇪 by NSAIT · Nairobi Space of AI Tools

---

## Notes on the copy

- The five lines on slide 8 are **spoken commands** — what people say to the
  product. They are not testimonials and carry no attribution. Don’t add names to
  them.
- Slide 3’s figures are internal product research and are labelled as such on the
  slide itself. Replace them with sourced figures before an investor sees this.
- Slides 5 and 6 come from
  [`unleashed-loop.dev-skill`](https://github.com/imodoiepale/unleashed-loop.dev-skill),
  which transcribes LOOP’s published documentation. The skill is unofficial and not
  affiliated with LOOP or NCBA, and fees, limits and settlement terms must be
  confirmed with LOOP directly — slide 6’s footer carries both caveats and should
  stay.
- The language is named **Kiswahili** throughout, not “Swahili”.
