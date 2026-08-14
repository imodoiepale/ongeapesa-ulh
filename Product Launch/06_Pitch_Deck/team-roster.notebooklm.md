# Team roster — source document for NotebookLM

A single-purpose source. Drop this into a NotebookLM notebook, paste the prompt at
the bottom, and it will write the Team Roster slide for the Ongea Pesa × LOOP deck.

Everything above the prompt is **verified fact** pulled from the GitHub API and the
git history of `main` on **2026-08-14**. Nothing here is estimated. Where something
is a judgement rather than a fact, it says so.

---

## 1. The repository

| | |
|---|---|
| Repo | `github.com/imodoiepale/ongeapesa-ulh` |
| Default branch | `main` |
| Commits on `main` | 20 (17 authored + 3 merges) |
| History spans | 2026-08-13 20:36 UTC → 2026-08-14 03:05 UTC |
| Collaborators | 2 |

> **Read this before quoting any commit count.** The history is roughly one day
> long, and the very first substantial commit is titled *"Add LiveKit voice worker,
> Docker deploy, and project source — publishes the full Ongea Pesa codebase."* The
> product was built before this repository existed; this repo is where it was
> published. **Commit counts measure activity in this repo, not the body of work.**
> Do not write "James wrote 12 commits and Chris wrote 5" as though that is the
> ratio of their contribution. It is not.

---

## 2. James Epale

| | |
|---|---|
| GitHub | [@imodoiepale](https://github.com/imodoiepale) · user id `101794204` |
| Commit name | James Epale |
| Repo role | **Owner / admin** |
| Authored commits on `main` | 12, no merges |

**What he shipped, from the commit record:**

- **Published the codebase.** The Next.js PWA, Supabase migrations, the n8n-backed
  payment rails and the LiveKit voice worker, in one commit.
- **The LOOP payment rail.** `resolveRailAndSend` gained a `rail: 'ncba' | 'loop'`
  parameter routing to `loop_send_mpesa`, `loop_pay_paybill` and
  `loop_pay_mpesa_till`. Deliberately opt-in, with NCBA left as the default, so a
  bug in the new path cannot silently move live traffic. Utility bills stay on NCBA
  because LOOP does not cover them.
- **Fixed double-booking on the LOOP rail.** The app now passes `transaction_id` to
  the `loop_*` webhooks and the workflow skips its own insert when it is present.
  Without it, one payment produced two ledger rows and the balance reconciled
  against a duplicate. Verified both ways against the LOOP sandbox.
- **Self-hosted the LiveKit SFU** on the Hostinger VPS, including the port work that
  makes WebRTC actually carry audio — 7880 behind Traefik for TLS, but 7881/tcp and
  7882/udp published directly, because Traefik cannot proxy media.
- **Voice tool parity, 2 of 7 → 7 of 7.** `lib/voice-tools.ts` became the single
  implementation of the client tools, with ElevenLabs and LiveKit as thin transports
  over it, so a tool cannot behave differently depending on the engine.
- **Speech-to-text correctness.** Found that Deepgram supports no Swahili in any Nova
  model and that `language="multi"` returns confident nonsense on Kenyan audio —
  the worst possible failure mode for an agent that moves money on a spoken amount.
  Changed the default and removed a hardcoded `language="sw"` that had been blocking
  the English/Sheng code-switching users actually speak.
- **Made TTS swappable** across Fish, OpenAI and ElevenLabs, so one pending vendor
  signup could not keep the voice worker down.
- **Operational hardening.** A `preflight()` that names every missing environment
  variable at once instead of revealing one per crash-loop restart; and removal of a
  hardcoded ElevenLabs API key from `scripts/`.

**Shape of the work:** rails, runtime and correctness. The parts that fail quietly
and expensively.

---

## 3. Chris Leo — "Chrisben"

| | |
|---|---|
| GitHub | [@Chrisleo-16](https://github.com/Chrisleo-16) · user id `152534621` |
| Commit name | Chris Leo |
| Commit email | `chrisbenevansleo@gmail.com` — this is where "Chrisben" comes from |
| Repo role | **Collaborator, write access** |
| Authored commits on `main` | 5, plus 3 merges keeping `main` current |
| Lines changed | ~1,090 added, ~590 removed |

> **Do not quote his commit messages.** All five say `fix: update nav items to
> include wallet and settings`, but one of them alone changes 83 files and another
> changes 14. The message badly understates the work; the file list is the honest
> record.

**What he actually touched:**

- **The navigation and app shell** — `app/layout.tsx`, `app/globals.css`, and the
  wallet and settings destinations.
- **The admin analytics surface** — the economics, feedback and settings pages, plus
  `components/admin/revenue-dashboard.tsx` and
  `components/ongea-pesa/analytics-dashboard.tsx`.
- **Foundation components** — `DataRow` and `MoneyAmount`, the primitives every
  screen showing an amount depends on.
- **API routes across the money path** — `gate/balance`, `gate/deposit`,
  `ncba/stk-deposit`, `daraja/stk-deposit`, `wallet/pay`, `profile`, and the voice
  routes `voice/webhook`, `voice/livekit-token`, `voice/send-scan-data` and
  `voice/session/sweep`.
- **Integration duty** — the three merge commits are him keeping `main` moving while
  both were pushing on the same day.

**Shape of the work:** the product surface. What a user and an operator actually see
and operate.

---

## 4. Who champions it forward

**Jointly — James Epale and Chris Leo.** *(This is the team's own decision, recorded
here so the slide states it consistently. It is not inferred from the repository.)*

The split the commit record supports:

- **James** — the bank-facing side. LOOP rails, settlement correctness, the voice
  runtime, deployment. The technical counterpart NCBA would deal with.
- **Chris** — the user-facing side. Navigation, the analytics and admin surfaces,
  the components that render money, and the API routes behind them.

Both under **NSAIT — Nairobi Space of AI Tools**, Nairobi.

---

## 5. Design constraints for the slide

So the slide sits inside the existing deck rather than beside it:

- **Palette** — Deep Voice Teal `#0FB5A6`, Electric Cyan `#22D3EE`, Signal Green
  `#34D399` on Abyss Ink `#0A1A1F`. Mist `#E6F7F5` for text. No other hues.
- **Type** — Sora for headings, Inter for body, JetBrains Mono for labels and data.
- **Voice** — confident, warm, local. Short sentences. Never corporate-stiff. The
  deck's own register is *"Speak. Send. Done."*, not *"revolutionary AI-powered
  ecosystem"*.
- **Two people only.** Do not invent advisors, designers or a third engineer.
- **No fabricated credentials.** No years of experience, no prior employers, no
  university, no job titles beyond what section 2 and 3 support. If NotebookLM
  cannot source it from this document, it does not go on the slide.

---

## 6. The prompt — paste this into NotebookLM

```
Using only the source document "Team roster — source document for NotebookLM",
write the copy for a single Team Roster slide in the Ongea Pesa × LOOP pitch deck.
The audience is NCBA.

Produce exactly this structure and nothing else:

1. EYEBROW LEFT  — a section label, sentence case, max 5 words.
   EYEBROW RIGHT — a short right-hand label, max 5 words.

2. HEADLINE — one line, max 9 words. It should say something true about how this
   team works, not just announce the word "Team". The deck's other headlines are
   "The voice is ours. The rails are LOOP's." and "A payment isn't finished when
   the money leaves." Match that register.

3. TWO PERSON BLOCKS, one for James Epale and one for Chris Leo. Each block:
   - Name
   - GitHub handle
   - A role line of at most 5 words describing the shape of their work
   - Two sentences on what they shipped, drawn only from the source document.
     Prefer the specific and consequential over the generic — the duplicate ledger
     row, the WebRTC media ports, the components that render money — over phrases
     like "worked on backend".
   - A mono detail line: three short terms separated by " · ", uppercase.

4. CHAMPION LINE — one sentence naming both as jointly carrying it forward, with
   the split between bank-facing and user-facing work.

5. FOOTER LEFT — one short line. FOOTER RIGHT — leave as "07 / 09".

Rules:
- Do not state or imply that commit counts represent the share of contribution.
  Section 1 explains why that would be wrong.
- Do not quote Chris's commit messages; use his file list instead.
- Invent nothing. No titles, employers, years of experience or qualifications
  that are not in the source.
- Use typographic apostrophes and quotes: ' " ".
- British spelling, to match the deck.
```

---

## 7. Once NotebookLM gives you the copy

Two options:

1. **Paste it back to Claude Code** and ask for it to be built as slide 7 of
   `deck.src.html`, with Asante moving to 08 / 09. It will match the existing type
   scale and reveal timing automatically.
2. **Build it yourself** — copy the `.card` block from slide 2 in `deck.src.html`;
   it already has the eyebrow, title, description and mono detail line in the right
   proportions. Two cards side by side rather than three.

Either way, run `python3 "Product Launch/06_Pitch_Deck/build.py"` afterwards to
rebuild the self-contained HTML.
