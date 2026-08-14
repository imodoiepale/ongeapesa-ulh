# Hostinger VPS — voice worker runbook

Exact commands, in order. The **Next.js app stays on Vercel**; only the LiveKit
voice worker runs here, because a serverless function cannot hold an audio
session open.

You run these. I don't need — and won't accept — your VPS credentials.

---

## 0. Accounts and keys you need first

Get these before touching the VPS, or step 5 will block:

| Key | Where | Notes |
|---|---|---|
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | **self-hosted** — see §0b below | `wss://livekit.srv1631847.hstgr.cloud` + your generated pair. **Also add these three to Vercel.** |
| `FISH_API_KEY` | fish.audio → Developers → API keys | TTS only — Fish Audio does not do speech recognition |
| `DEEPGRAM_API_KEY` | deepgram.com → API keys | This is the STT. Free tier has credit |
| `ONGEA_LLM_API_KEY` | your LLM provider | |
| `N8N_CALLBACK_SECRET` | copy the value already in Vercel | Must match exactly or cost reporting 401s |
| `FISH_USD_PER_1K_CHARS` | your fish.audio plan pricing page | Without it, TTS cost is not recorded |

---

## 0b. Stand up the LiveKit SFU (do this first)

We self-host the media server on this box. The worker exits at startup if there
is nothing to dial, so this comes before everything below.

**Check what Traefik actually calls its entrypoint and certresolver.** Hostinger
does not document these, and guessing is the most likely way this fails:

```bash
docker inspect $(docker ps --filter name=n8n --format '{{.Names}}' | head -1) \
  --format '{{json .Config.Labels}}' | tr ',' '\n' | grep -i traefik
```

The compose file assumes `websecure` / `letsencrypt`. If yours differ, edit the
two label lines before deploying.

**Generate the key pair** — on the VPS, and never paste the output into a chat
window or commit it:

```bash
docker run --rm livekit/livekit-server generate-keys
```

**Deploy** via Docker Manager → Compose → "Compose from URL", project `livekit`:

```
https://raw.githubusercontent.com/imodoiepale/ongeapesa-ulh/main/voice-agent/livekit-server/docker-compose.hostinger.yml
```

Add one panel variable, exact `KEY: SECRET` form including the space:

```
LIVEKIT_KEYS = APIxxxxxxxx: <the generated secret>
```

### Ports, and the one that gets forgotten

| Port | Purpose | Exposure |
|---|---|---|
| 7880/tcp | signalling (HTTP + WebSocket) | behind Traefik, which supplies TLS |
| 7881/tcp | WebRTC over TCP — the fallback when UDP is blocked | published directly |
| 7882/udp | **the actual media** | published directly |

Traefik proxies HTTP and TCP. It **cannot** carry the UDP media. If 7882/udp is
not published — or if `rtc.use_external_ip` is not true, so clients get handed a
`172.x` container address — the call connects normally and then has no audio.
That symptom looks like a client bug and is miserable to trace, so verify:

```bash
docker port livekit-server            # must list 7882/udp
curl -sI https://livekit.srv.../rtc   # 101, not 200 or a Traefik 404
```

No DNS record is needed: `*.srv1631847.hstgr.cloud` already resolves to this box.

---

## 1. Create a non-root user

Never run the worker as root.

```bash
ssh root@YOUR_VPS_IP
adduser --disabled-password --gecos "" ongea
usermod -aG sudo ongea
mkdir -p /home/ongea/.ssh
cp ~/.ssh/authorized_keys /home/ongea/.ssh/ 2>/dev/null || true
chown -R ongea:ongea /home/ongea/.ssh
chmod 700 /home/ongea/.ssh && chmod 600 /home/ongea/.ssh/authorized_keys
```

Reconnect as that user and confirm it worked:

```bash
exit
ssh ongea@YOUR_VPS_IP
whoami    # must print: ongea
```

## 2. System packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip git ffmpeg build-essential
python3 --version    # need 3.10 or newer
```

`ffmpeg` matters — the audio plugins need it and the failure without it is an
unhelpful codec error at runtime, not at install.

## 3. Clone and install

```bash
cd ~
git clone https://github.com/YOUR_USER/ongea-pesa.git
cd ongea-pesa/voice-agent
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 4. Smoke test the API surface — do not skip

`livekit-agents` changed shape across its 1.x line. Verify what actually
installed before wiring anything up:

```bash
python - <<'PY'
from livekit.plugins import fishaudio, silero
import livekit.agents as agents
print("agents:", agents.__version__)
assert not hasattr(fishaudio, "STT"), "fishaudio gained STT — update build_stt()"
print("AgentSession present:", hasattr(agents, "AgentSession"))
print("OK")
PY
```

If this raises, stop and read the traceback against
<https://docs.livekit.io/agents/> for **your** installed version. A worker that
starts but mis-wires a tool is worse than one that fails loudly.

## 5. Configure

```bash
cp .env.example .env
chmod 600 .env          # keys must not be world-readable
nano .env               # fill in everything from step 0
```

Set `ONGEA_ENVIRONMENT=live` only when you mean it — see `docs/environments.md`
for why the default is live rather than test.

## 6. Download model weights

Silero VAD and the turn detector run locally and are fetched once:

```bash
python agent.py download-files
```

## 7. Run in the foreground and watch it

```bash
python agent.py dev
```

Leave it running, open the app on a phone as an account you have flipped to
`livekit` (step 9), and start a voice session. You are looking for the worker to
log a room join. `Ctrl-C` when satisfied.

## 8. Install as a service

```bash
sudo tee /etc/systemd/system/ongea-voice-agent.service > /dev/null <<'UNIT'
[Unit]
Description=Ongea Pesa LiveKit voice agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ongea
WorkingDirectory=/home/ongea/ongea-pesa/voice-agent
EnvironmentFile=/home/ongea/ongea-pesa/voice-agent/.env
ExecStart=/home/ongea/ongea-pesa/voice-agent/.venv/bin/python agent.py start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now ongea-voice-agent
sudo systemctl status ongea-voice-agent --no-pager
sudo journalctl -u ongea-voice-agent -f
```

## 9. Enable LiveKit for one account

`profiles.voice_engine` defaults to `elevenlabs` and is not user-writable — a DB
trigger rejects any change that isn't service-role. Flip it from
`/admin-analytics/settings` → Voice Engine.

Use an account you can watch. Not a customer.

## 10. Verify end to end

1. Place a voice call. The worker log should show a room join and a greeting.
2. Say a small send. Check the n8n execution fired.
3. **Prove parity**: do the same send on an `elevenlabs` account, then diff the
   two n8n request bodies. They should differ only in `source` and ids. Any fee
   field differing means logic has been duplicated where it shouldn't be.
4. Open `/admin-analytics/economics` → Infrastructure spend should show a
   `fish_audio / tts` row, and Voice unit economics should populate.

## Firewall

The worker makes **outbound** connections only — it does not listen. You do not
need to open any inbound port for it.

```bash
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

## Updating

```bash
cd ~/ongea-pesa && git pull
cd voice-agent && source .venv/bin/activate && pip install -r requirements.txt
sudo systemctl restart ongea-voice-agent
```

## When it misbehaves

| Symptom | Cause to check first |
|---|---|
| Exits immediately | `.env` missing a required key; run `python agent.py dev` to see the traceback |
| Connects, never joins a room | `LIVEKIT_*` mismatch between VPS and Vercel — they must be the same project |
| Joins but silent | `FISH_API_KEY` invalid, or Fish Audio credit exhausted |
| Hears nothing | `DEEPGRAM_API_KEY` missing. Fish Audio is not the STT |
| `cost report failed` in logs | `N8N_CALLBACK_SECRET` differs from Vercel's value |
| No cost rows appear | `FISH_USD_PER_1K_CHARS` unset — the worker skips rather than record a false zero |
| Payments fail on livekit but work on elevenlabs | `ONGEA_APP_URL` wrong, so `/api/voice/webhook` is unreachable |
