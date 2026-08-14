# Ongea Pesa — LiveKit + Fish Audio voice worker

A second voice runtime that runs **in parallel** with the existing ElevenLabs
agent. It is opt-in per user, admin-only, and shares the exact money path.

## Why it is a separate service

Vercel serverless functions cannot hold a long-lived audio session. The worker
is a persistent process that joins LiveKit rooms — it belongs on your Hostinger
VPS, not in the Next.js deployment.

## How it fits together

```
browser  ──POST /api/voice/livekit-token──▶  Next.js (Vercel)
   │                                            │ checks profiles.voice_engine = 'livekit'
   │                                            │ opens voice_sessions row
   │        ◀── token + room + wss url ─────────┘
   │
   │        ┌──────── Hostinger VPS srv1631847 ────────┐
   └──WebRTC┼──▶  livekit-server  ◀──WebRTC──  voice-agent
            │     (self-hosted SFU)                 │  │
            └───────────────────────────────────────┼──┘
                                                    │
                            ──POST /api/voice/webhook──▶ Next.js ──▶ n8n
```

**Both halves run on your VPS.** The SFU is self-hosted
(`livekit-server/docker-compose.yml`) at
`wss://livekit.srv1631847.hstgr.cloud`, not LiveKit Cloud. Deploy it before the
worker — the worker exits at startup if it has no server to dial.

The last hop is the important one: **the worker never talks to n8n, Supabase or
NCBA directly.** It posts to the same `/api/voice/webhook` the ElevenLabs agent
uses, so fee calculation, the free-transaction rule, step-up staging and rail
routing are computed in exactly one place. If the worker reimplemented any of
that, the two engines would eventually disagree and one would be wrong.

## Smoke test FIRST — do not skip this

The `livekit-agents` API changed shape across the 1.x line. This file is pinned
to `>=1.6,<2` but the surface must be **verified against what actually installs**,
not assumed. Run this immediately after `pip install`:

```bash
source .venv/bin/activate
python - <<'PY'
from livekit.plugins import fishaudio, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel
import livekit.agents as agents

print("agents:", agents.__version__)
print("fishaudio exports:", [n for n in dir(fishaudio) if n.isupper() or n[0].isupper()])
assert not hasattr(fishaudio, "STT"), "fishaudio unexpectedly has STT — update build_stt()"
print("AgentSession:", hasattr(agents, "AgentSession"))
print("OK")
PY
```

Then check the agent itself imports and registers:

```bash
python agent.py download-files   # pulls Silero VAD + turn-detector weights
python agent.py dev              # connects to LiveKit, waits for a room
```

If `python agent.py dev` raises on `AgentSession(...)`, `WorkerOptions`, or an
event name, the installed API differs from this file. Read the traceback and the
docs for **your** installed version at
<https://docs.livekit.io/agents/> before changing anything else — a worker that
starts but mis-wires a tool is worse than one that fails loudly.

## What Fish Audio does and does not do

Fish Audio is the **voice** — TTS and voice cloning. It does not solve Sheng.

**There is no `fishaudio.STT`.** The plugin is TTS-only (confirmed against
`livekit-plugins-fishaudio` 1.6.9). Speech recognition comes from Deepgram by
default.

Sheng comprehension is a **speech recognition** problem, and no commercial STT
handles Kenyan code-switching well. That is what the `/training` page collects a
corpus for, and what `docs/sheng-asr-finetuning.md` turns into a fine-tuned
Whisper. `build_stt()` in `agent.py` is a swappable factory precisely so that
model can replace the default with one environment variable.

## Choosing an STT

We run Deepgram by default and keep OpenAI one env var away, because neither is
outright better — they fail in opposite directions.

| | Deepgram `nova-3` | OpenAI `gpt-4o-transcribe` |
|---|---|---|
| Latency | Streaming — partials arrive mid-utterance | Streaming, but slower to first token |
| Swahili | **Not supported at all** | Supported |
| Sheng | Poor | Poor, but degrades more gracefully |
| Env | `ONGEA_STT=deepgram` | `ONGEA_STT=openai` |

**Deepgram supports no Swahili in any Nova model.** `language="multi"` sounds
like "any language" but means exactly ten: English, Spanish, French, German,
Hindi, Russian, Portuguese, Japanese, Italian, Dutch. Sending Kenyan audio with
`multi` does not error — it forces the audio into a language it isn't and
returns confident nonsense. For an agent that moves money on a spoken amount,
that is the worst available failure mode, so the default is `DEEPGRAM_LANGUAGE=en`.

### A/B them on real calls

Deepgram is the latency floor; OpenAI is the language-coverage answer. Which
matters more is an empirical question about *your* users, so measure it:

```bash
# on the VPS
nano .env            # ONGEA_STT=openai
docker compose restart voice-agent
docker compose logs -f
```

Run the same handful of utterances through both — an English-only command, a
pure-Swahili one, and a code-switched one with an amount in it. The amount and
the recipient are what must be right; a mangled greeting costs nothing, a
mangled number costs money.

Neither is the destination. Both are holding positions until the fine-tune from
`docs/sheng-asr-finetuning.md` can be served through `ONGEA_STT=whisper_sheng`.

## Deploying: pick one of three

| | Use when | Compose file |
|---|---|---|
| **A. Hostinger Docker Manager** | You want a managed app in the panel, alongside n8n and traefik | `docker-compose.hostinger.yml` |
| **B. Docker over SSH** | You cloned the repo onto the VPS yourself | `docker-compose.yml` |
| **C. systemd + venv** | No Docker, or you want the process supervised directly | none — see Setup below |

**A is the recommended path on Hostinger.** The panel shows the worker next to
your other applications, with logs, restart and terminal in the UI.

### Deploy the SFU first

The worker is useless without a LiveKit server. Stand that up before anything
below — Docker Manager → Compose → "Compose from URL":

```
https://raw.githubusercontent.com/imodoiepale/ongeapesa-ulh/main/voice-agent/livekit-server/docker-compose.yml
```

Full instructions, including the Traefik label check and key generation, are in
`livekit-server/docker-compose.yml` itself and in
`docs/deployment/VPS_VOICE_WORKER.md`.

The one thing worth repeating here: **UDP 7882 must be published directly.**
Traefik proxies HTTP and TCP; it cannot carry WebRTC media. Miss that port and
the call connects normally and then carries no audio, which is a genuinely
confusing failure to debug from the client side.

### A. Hostinger Docker Manager

**VPS → Docker Manager → Compose → "Compose from URL"**, then paste:

```
https://raw.githubusercontent.com/imodoiepale/ongeapesa-ulh/main/voice-agent/docker-compose.hostinger.yml
```

Project name `ongea-voice-agent`. Add every variable from `.env.example` under
the panel's **Environment variables** field, then Deploy. First build takes a
few minutes — it clones the repo and bakes the model weights into the image.

That file differs from `docker-compose.yml` in two ways, both forced by the
panel having no working copy of the repo: `build.context` is a **git URL** so
Docker clones the source itself, and every value is a `${VAR}` substitution
rather than an `env_file`, so **no secret is ever written into a file that
lives in a public repo**.

### B. Docker over SSH

```bash
git clone https://github.com/imodoiepale/ongeapesa-ulh.git ongea-pesa
cd ongea-pesa/voice-agent
cp .env.example .env && chmod 600 .env && nano .env
docker compose up -d --build && docker compose logs -f
```

### C. systemd

Follow the Setup steps below.

## Setup

**1. LiveKit project** — create one at livekit.io, note the URL, API key and
secret. Put them in this directory's `.env` *and* in the Next.js environment
(`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`).

**2. VPS install**

```bash
ssh your-vps
git clone <repo> ongea-pesa && cd ongea-pesa/voice-agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill it in
```

**3. Download model weights** — Silero VAD and the turn detector run locally:

```bash
python agent.py download-files
```

**4. Clone the Ongea voice (optional but recommended)** — upload 10–30s of clean
reference audio at fish.audio, copy the model id from the URL, set `FISH_VOICE_ID`.

**5. Run it**

```bash
python agent.py dev      # local, verbose
python agent.py start    # production
```

**6. systemd** — `/etc/systemd/system/ongea-voice-agent.service`:

```ini
[Unit]
Description=Ongea Pesa LiveKit voice agent
After=network-online.target

[Service]
Type=simple
User=ongea
WorkingDirectory=/home/ongea/ongea-pesa/voice-agent
EnvironmentFile=/home/ongea/ongea-pesa/voice-agent/.env
ExecStart=/home/ongea/ongea-pesa/voice-agent/.venv/bin/python agent.py start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now ongea-voice-agent
sudo journalctl -u ongea-voice-agent -f
```

## Enabling it for a user

`profiles.voice_engine` defaults to `elevenlabs` for everyone and is **not**
user-writable — a DB trigger (`guard_voice_engine_update`) rejects any change
that does not come from the service role, so a user cannot move themselves onto
the experimental path even by crafting a request.

Flip an account from the admin settings screen, or directly:

```bash
curl -X PATCH https://ongeapesa.nsait.co.ke/api/admin/voice-engine \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"<uuid>","engine":"livekit"}'
```

Changes are written to `security_events` as `voice_engine_changed`.

## Verifying parity before trusting it

The point of running both engines is to compare them, so check the money path is
literally identical rather than assuming:

1. Do a small send on ElevenLabs. Open the n8n execution, save the request body.
2. Flip the same account to `livekit`, repeat the same send.
3. Diff the two n8n request bodies. They should differ only in `source`
   (`elevenlabs` vs `livekit`) and the ids/timestamps.

If any fee field differs, stop and fix it — that means logic has been duplicated
somewhere it should not have been.

## Known gaps

- **Barge-in and turn detection are configured but untuned.** Silero VAD plus the
  multilingual turn detector are good defaults, not Kenyan-tuned ones. Expect to
  adjust once you have real call recordings.
- **`read_balance` falls back to the balance captured at token mint.** It is a
  snapshot from session start, so it goes stale during a long call if the
  webhook does not return a fresher figure.
- **No wake word.** See `docs/natural-listening.md`; Porcupine is already a
  dependency of the web app but unused.
