# 06 — Pitch Deck

**Ongea Pesa × LOOP** — an 8-slide pitch deck. Single self-contained HTML file, no
build step at present time, no network access required.

| File | What it is |
|---|---|
| `deck.src.html` | The source. Edit this. Artwork is referenced by token (`__ORB__`, `__VOICE__`, `__TRUST__`, `__CHAMA__`). |
| `build.py` | Inlines the artwork as data URIs. |
| `ongea-pesa-loop-deck.html` | The built deck — open this, present this, share this. Generated; don't hand-edit. |

```bash
python3 "Product Launch/06_Pitch_Deck/build.py"
```

## The slides

| # | Slide | Carries |
|---|---|---|
| 1 | Cover | Wordmark, `Ongea. Pesa itembee.`, the one-line positioning |
| 2 | Background | Who it's for, what it does, where it runs |
| 3 | The problem | The USSD friction numbers |
| 4 | The solution | Speak → Verify → Done, on the voice rule |
| 5 | Built on LOOP | All 8 wired endpoints with their `serviceCode`s, environments, auth, signing |
| 6 | Why it doesn't guess | The `loop-api` skill and the three money-costing traps |
| 7 | And then some | Scan, chama, escrow, step-up, RLS, orchestration |
| 8 | Asante | Thank-you, what people say to it, links |

## Presenting

Arrow keys / space / PageUp / PageDown move between slides; `Home` and `End` jump to
the ends. The dot rail on the right is clickable. Slides snap one per screen; on a
phone the whole thing flows as a scrollable document instead.

`Ctrl/Cmd + P` prints one slide per page.

## Design

Palette and typography come straight from
[`00_Brand_Foundation/brand-spec.md`](../00_Brand_Foundation/brand-spec.md) — Voice
Teal on Abyss Ink, Sora/Inter/JetBrains Mono, Signal Green reserved for "money
moved". Slide 5 inverts to the Mist ground; it's the one light moment in the deck and
marks the point where the product meets the bank.

Artwork is the existing brand renders from `public/brand/orbital/`. They're light
painted on black, so they composite with `mix-blend-mode: screen` — the black backing
plate drops out and only the glow lands on the slide.

Deliberately single-theme: a projected deck commits to its own ground rather than
following the viewer's light/dark setting.

## Accuracy

Slides 5 and 6 are drawn from
[`unleashed-loop.dev-skill`](https://github.com/imodoiepale/unleashed-loop.dev-skill),
which transcribes LOOP's published documentation. Two caveats travel with those
slides and are printed on slide 6: the skill is **unofficial and not affiliated with
LOOP or NCBA**, and fees, limits and settlement terms must be confirmed with LOOP
directly.

The figures on slide 3 are internal product research and are labelled as such on the
slide. Swap them for sourced figures before showing this to investors.
