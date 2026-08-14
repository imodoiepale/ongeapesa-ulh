"""
Ongea Pesa — LiveKit voice agent worker.

Runs OUTSIDE the Next.js app (Vercel cannot host a long-lived media process).
Deploy to the Hostinger VPS with systemd; see README.md in this directory.

Design constraints this file is built around:

  * It is a PARALLEL runtime, not a replacement. ElevenLabs remains the default;
    a user only reaches this worker when an admin sets profiles.voice_engine to
    'livekit'. The money path must therefore behave identically.

  * Every money tool posts the SAME payload to the SAME endpoint the ElevenLabs
    agent uses (POST {APP_URL}/api/voice/webhook). The webhook owns fee
    calculation, the free-transaction rule, step-up staging and the n8n call.
    Nothing about pricing or authorisation is reimplemented here — if it were,
    the two engines would drift and one of them would be wrong.

  * Fish Audio supplies the voice (TTS). It does not solve Sheng comprehension —
    that is an ASR problem, addressed separately by fine-tuning Whisper on the
    corpus collected at /training. STT is behind a swappable factory below so
    that model can drop in without touching agent logic.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any

import aiohttp
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import Agent, AgentSession, JobContext, RunContext, function_tool
from livekit.plugins import fishaudio, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv()

logger = logging.getLogger("ongea-agent")
logging.basicConfig(level=logging.INFO)

APP_URL = os.environ.get("ONGEA_APP_URL", "https://ongeapesa-ulh.nsait.co.ke")
WEBHOOK_URL = f"{APP_URL}/api/voice/webhook"
COST_URL = f"{APP_URL}/api/costs/record"
WEBHOOK_TOKEN = os.environ.get("N8N_WEBHOOK_AUTH_TOKEN", "")
CALLBACK_SECRET = os.environ.get("N8N_CALLBACK_SECRET", "")

# Fish Audio bills per character synthesised. Set this from your actual plan —
# an inaccurate rate produces a confidently wrong margin, which is worse than a
# blank one, so it is required rather than defaulted to a guess.
FISH_USD_PER_1K_CHARS = float(os.environ.get("FISH_USD_PER_1K_CHARS", "0") or 0)

# Mirrors the ElevenLabs agent prompt (scripts/configure-elevenlabs-agent.mjs).
# Keep the two in sync deliberately: a behavioural difference between engines is
# a bug, not a feature.
SYSTEM_PROMPT = """You are Ongea Pesa, a Kenyan voice payments assistant.

You speak naturally in English, Kiswahili and Sheng, matching whichever the user
uses. Keep replies short — this is spoken aloud, not read.

Rules that are not negotiable:
- NEVER invent a balance, a fee, or a transaction result. Only state what a tool
  returned to you.
- Always read back the amount and the recipient before sending, and wait for a
  clear yes.
- If the user is ambiguous about amount or recipient, ask. Do not guess.
- If a tool returns an agent_message, say that message. Do not paraphrase it.
- Never ask for a PIN or password out loud. Confirmation happens in the app.

Amounts are Kenyan shillings. "Soo" or "mia" is hundred, "elfu" is thousand,
"chwani"/"doo"/"ganji" all mean money in Sheng.
"""


@dataclass
class UserContext:
    """Per-session identity, handed over in the LiveKit room metadata by
    /api/voice/livekit-token so the worker never needs Supabase credentials."""

    user_id: str
    user_email: str
    user_name: str
    balance: str
    gate_name: str
    gate_id: str
    voice_session_id: str

    @classmethod
    def from_metadata(cls, raw: str | None) -> "UserContext":
        data: dict[str, Any] = json.loads(raw) if raw else {}
        return cls(
            user_id=data.get("user_id", ""),
            user_email=data.get("user_email", ""),
            user_name=data.get("user_name", "User"),
            balance=str(data.get("balance", "0")),
            gate_name=data.get("gate_name", ""),
            gate_id=data.get("gate_id", ""),
            voice_session_id=data.get("voice_session_id", ""),
        )


async def call_app_webhook(ctx: UserContext, payload: dict[str, Any]) -> dict[str, Any]:
    """POST to the app's voice webhook — the single money path shared with the
    ElevenLabs agent. Field names match app/api/voice/webhook/route.ts."""
    body = {
        "user_id": ctx.user_id,
        "user_email": ctx.user_email,
        "user_name": ctx.user_name,
        "gate_name": ctx.gate_name,
        "gate_id": ctx.gate_id,
        "session_id": ctx.voice_session_id,
        "source": "livekit",
        **payload,
    }
    headers = {"Content-Type": "application/json"}
    if WEBHOOK_TOKEN:
        headers["Authorization"] = WEBHOOK_TOKEN

    timeout = aiohttp.ClientTimeout(total=45)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(WEBHOOK_URL, json=body, headers=headers) as resp:
                data = await resp.json(content_type=None)
                if not resp.ok:
                    logger.error("webhook %s -> %s: %s", payload.get("type"), resp.status, data)
                return data or {}
    except Exception:
        logger.exception("voice webhook call failed")
        # Never fabricate success. The model is instructed to speak only what a
        # tool returned, so an explicit failure message is the safe outcome.
        return {
            "success": False,
            "agent_message": "I couldn't reach the payment service just now. Please try again.",
        }


async def report_tts_cost(ctx: UserContext, characters: int) -> None:
    """Record what this session's speech synthesis cost.

    Without this the economics dashboard shows voice revenue with no cost
    attached, which makes a KSH 20/min product look infinitely profitable.
    Idempotent server-side: the unique index on (reference, provider, category)
    means a retry cannot double-count a session.
    """
    if not CALLBACK_SECRET:
        logger.warning("N8N_CALLBACK_SECRET not set — skipping cost reporting")
        return
    if characters <= 0 or FISH_USD_PER_1K_CHARS <= 0:
        # No rate configured means we cannot state a cost honestly. Skip rather
        # than record a zero that would read as "this was free".
        if FISH_USD_PER_1K_CHARS <= 0:
            logger.warning("FISH_USD_PER_1K_CHARS not set — TTS cost not recorded")
        return

    # Attribute the cost to whichever TTS actually spoke, or the economics
    # dashboard credits Fish Audio for spend it never incurred.
    payload = {
        "provider": {"fish": "fish_audio", "openai": "openai", "elevenlabs": "elevenlabs"}
        .get(tts_provider(), "other"),
        "category": "tts",
        "quantity": characters,
        "unit": "characters",
        "unit_cost_usd": FISH_USD_PER_1K_CHARS / 1000.0,
        "reference_type": "voice_session",
        "reference_id": ctx.voice_session_id,
        "user_id": ctx.user_id or None,
    }
    try:
        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                COST_URL, json=payload, headers={"x-ongea-secret": CALLBACK_SECRET}
            ) as resp:
                if not resp.ok:
                    logger.error("cost report failed: %s %s", resp.status, await resp.text())
    except Exception:
        # Cost reporting must never break a live call.
        logger.exception("cost report failed")


class OngeaAgent(Agent):
    """Tool surface cloned from the ElevenLabs agent configuration."""

    def __init__(self, user: UserContext, room=None, participant_identity: str = "") -> None:
        super().__init__(instructions=SYSTEM_PROMPT)
        self.user = user
        # Bound at session start so the client tools know which tab to call.
        # RPC is point-to-point: it needs the exact participant identity, not
        # just the room, or a second device on the same account would answer.
        self._room = room
        self._participant_identity = participant_identity

    @function_tool()
    async def send_money(
        self,
        context: RunContext,
        type: str,
        amount: float,
        phone: str = "",
        till: str = "",
        paybill: str = "",
        account: str = "",
        summary: str = "",
    ) -> str:
        """Send money after the user has confirmed the amount and recipient.

        Args:
            type: one of send_phone, paybill, buy_goods_till, withdraw,
                  bank_to_mpesa, mpesa_to_bank
            amount: amount in Kenyan shillings
            phone: recipient phone for send_phone / withdraw
            till: till number for buy_goods_till
            paybill: paybill number for paybill
            account: account number, when the paybill needs one
            summary: one-line description of what the user asked for
        """
        result = await call_app_webhook(
            self.user,
            {
                "type": type,
                "amount": amount,
                "phone": phone,
                "till": till,
                "paybill": paybill,
                "account": account,
                "summary": summary,
                "request": summary,
                "voice_verified": True,
                "confidence_score": 85,
            },
        )
        # agent_message is the string the app wants spoken verbatim.
        return result.get("agent_message") or result.get("message") or "Done."

    @function_tool()
    async def read_balance(self, context: RunContext) -> str:
        """Return the user's current Ongea Pesa wallet balance."""
        # Prefer the browser: it holds the figure the user is looking at, so the
        # spoken number and the on-screen number cannot disagree. Fall back to
        # the webhook if no screen answered.
        spoken = await self._call_browser("read_balance")
        if spoken:
            return spoken
        result = await call_app_webhook(self.user, {"type": "balance", "amount": 0})
        if result.get("agent_message"):
            return str(result["agent_message"])
        return f"Your balance is {self.user.balance} shillings."

    # ── Client tools ─────────────────────────────────────────────────────────
    #
    # These run in the BROWSER, not here. ElevenLabs calls them through its
    # `clientTools` map; we reach the same functions over LiveKit RPC. Both land
    # in lib/voice-tools.ts, so the two engines cannot drift.
    #
    # Descriptions are copied verbatim from the ElevenLabs tool definitions in
    # scripts/configure-elevenlabs-agent.mjs — the model's guidance must be
    # identical on both engines, or they behave differently for the same words.

    @function_tool()
    async def open_scanner(self, context: RunContext) -> str:
        """Open the in-app camera/scanner so the user can scan a payment target
        (till, paybill, QR, phone, or receipt). Call when the user asks to scan,
        'piga hii', 'soma hii', or 'use the camera'."""
        return await self._call_browser("open_scanner") or "I couldn't open the scanner."

    @function_tool()
    async def start_scan(self, context: RunContext, mode: str = "auto") -> str:
        """Start scanning the camera image. The image is read by Vision OCR which
        returns the payment type, numbers and amount. Omit mode (or "auto") to
        auto-detect any document.

        Args:
            mode: auto, till, paybill, send_phone, withdraw, bank_to_mpesa,
                  bank_to_bank, qr, receipt
        """
        return await self._call_browser("start_scan", {"mode": mode}) or "The scan didn't complete."

    @function_tool()
    async def confirm_payment(self, context: RunContext) -> str:
        """Confirm and send the payment currently displayed from the last scan,
        routing it through the user's wallet. Only call after the user agrees."""
        return await self._call_browser("confirm_payment") or "I couldn't confirm that payment."

    @function_tool()
    async def stage_payment(
        self,
        context: RunContext,
        amount: float = 0,
        phone: str = "",
        till: str = "",
        paybill: str = "",
        account: str = "",
        type: str = "",
        recipientName: str = "",
    ) -> str:
        """Fill the on-screen payment form as the user speaks, WITHOUT sending.
        Use it to show what you understood so they can see it before confirming."""
        slots = {
            "amount": amount or None, "phone": phone or None, "till": till or None,
            "paybill": paybill or None, "account": account or None,
            "type": type or None, "recipientName": recipientName or None,
        }
        return await self._call_browser(
            "stage_payment", {k: v for k, v in slots.items() if v is not None}
        ) or "staged"

    @function_tool()
    async def send_batch(self, context: RunContext, payments: list[dict] = None) -> str:
        """Dispatch multiple payments in one interaction. Each payment becomes an
        individual request (not a single combined call). Call after the user has
        confirmed the full list of recipients and amounts. Returns a spoken
        summary of which succeeded and which failed.

        Args:
            payments: list of {amount, phone|till|paybill, account, recipientName}
        """
        if not payments:
            return "No payments specified. Please tell me who to send to and how much."
        # Runs browser-side: /api/payments/batch authenticates by session cookie,
        # which this worker does not have.
        return await self._call_browser("send_batch", {"payments": payments}) \
            or "I couldn't dispatch those payments."

    async def _call_browser(self, method: str, payload: dict[str, Any] | None = None) -> str:
        """Invoke a client tool in the user's browser over LiveKit RPC.

        Returns "" on any failure so the caller can fall back or speak an honest
        error. Never raises into the agent loop — a dropped tab or a screen that
        has not registered a handler must not kill a live call.
        """
        room = self._room
        identity = self._participant_identity
        if room is None or not identity:
            logger.error("rpc %s: no room/participant bound", method)
            return ""
        try:
            return await room.local_participant.perform_rpc(
                destination_identity=identity,
                method=method,
                payload=json.dumps(payload or {}),
                # Scanner + OCR is slow; ElevenLabs allows 20s (60s for batch).
                response_timeout=60.0 if method == "send_batch" else 20.0,
            )
        except Exception:
            logger.exception("rpc %s failed", method)
            return ""


def build_stt():
    """STT is swappable on purpose.

    IMPORTANT: livekit-plugins-fishaudio is **TTS only** — there is no
    fishaudio.STT. Fish Audio is the mouth, never the ears. An earlier version of
    this file defaulted to fishaudio.STT() and would have crashed on startup.

    No commercial STT handles Sheng code-switching well, which is the whole
    reason for the corpus collected at /training. Until the fine-tune exists,
    Deepgram's multilingual model is the least-bad option and is what LiveKit's
    own example uses; Whisper via an OpenAI-compatible endpoint is the fallback
    and the shape the fine-tuned model will eventually serve.
    """
    provider = os.environ.get("ONGEA_STT", "deepgram").lower()

    if provider == "deepgram":
        from livekit.plugins import deepgram

        # CAREFUL: language="multi" does NOT mean "any language". Deepgram's
        # code-switching covers exactly ten languages — English, Spanish,
        # French, German, Hindi, Russian, Portuguese, Japanese, Italian, Dutch.
        # **Swahili is not among them, and is not supported by any Nova model.**
        # Sending Kenyan audio with language="multi" does not error; it forces
        # the audio into a language it isn't, which returns confident nonsense.
        #
        # "en" is therefore the least-bad Nova setting: Kenyan English and the
        # digits in an amount transcribe well, while Sheng and Swahili words
        # degrade. If you need real Swahili coverage, ONGEA_STT=openai with
        # gpt-4o-transcribe is the working path until the fine-tune lands.
        return deepgram.STT(
            model=os.environ.get("DEEPGRAM_MODEL", "nova-3"),
            language=os.environ.get("DEEPGRAM_LANGUAGE", "en"),
        )

    if provider in ("openai", "whisper"):
        from livekit.plugins import openai

        # The Swahili-capable fallback. Flip to it with a single env var when
        # comparing against Deepgram on real Kenyan calls.
        #
        # Default is gpt-4o-transcribe, NOT whisper-1: whisper-1 is a batch
        # endpoint, so the whole utterance must finish and upload before any
        # text comes back — roughly 0.5-1.5s of dead air per turn. The 4o
        # transcribe models stream and cover Swahili.
        #
        # language is deliberately OPTIONAL. Pinning it to "sw" (which this
        # branch previously did) locks every utterance to Swahili and destroys
        # exactly the English/Sheng code-switching Kenyan users actually speak.
        # Left unset it auto-detects; set ONGEA_STT_LANGUAGE only to force one.
        kwargs: dict[str, Any] = {
            "model": os.environ.get("ONGEA_STT_MODEL", "gpt-4o-transcribe"),
        }
        if language := os.environ.get("ONGEA_STT_LANGUAGE"):
            kwargs["language"] = language
        # Falls back to the plugin's own OPENAI_API_KEY lookup when unset.
        if api_key := os.environ.get("ONGEA_STT_API_KEY"):
            kwargs["api_key"] = api_key
        return openai.STT(**kwargs)

    if provider == "whisper_sheng":
        # The self-hosted fine-tune from docs/sheng-asr-finetuning.md, served
        # behind an OpenAI-compatible /v1/audio/transcriptions endpoint.
        from livekit.plugins import openai

        return openai.STT(
            base_url=os.environ["ONGEA_STT_BASE_URL"],
            api_key=os.environ.get("ONGEA_STT_API_KEY", "not-needed"),
            model=os.environ.get("ONGEA_STT_MODEL", "whisper-sheng-lora"),
        )

    raise ValueError(
        f"Unknown ONGEA_STT provider: {provider!r}. "
        "Use one of: deepgram, openai, whisper_sheng. Fish Audio does not provide STT."
    )


def tts_provider() -> str:
    return os.environ.get("ONGEA_TTS", "fish").lower()


def build_tts():
    """TTS is swappable, for the same reason STT is.

    Fish Audio is the nicest voice for the money and stays the default, but it
    is a separate vendor account — and being unable to speak at all because one
    signup is pending is a bad way to be blocked. `openai` reuses the key the
    LLM already needs, so it costs no new account.

    Voice quality differs; the money path does not. Switching is safe.
    """
    provider = tts_provider()

    if provider == "fish":
        return fishaudio.TTS(
            model=os.environ.get("FISH_TTS_MODEL", "s2.1-pro"),
            # A cloned Ongea Pesa voice; see README for creating one.
            reference_id=os.environ.get("FISH_VOICE_ID") or None,
            latency=os.environ.get("FISH_LATENCY", "balanced"),
        )

    if provider == "openai":
        from livekit.plugins import openai

        # Falls back to the LLM key: one OpenAI key covers both.
        api_key = (
            os.environ.get("OPENAI_API_KEY")
            or os.environ.get("ONGEA_LLM_API_KEY")
            or None
        )
        return openai.TTS(
            model=os.environ.get("ONGEA_TTS_MODEL", "gpt-4o-mini-tts"),
            voice=os.environ.get("ONGEA_TTS_VOICE", "alloy"),
            api_key=api_key,
        )

    if provider == "elevenlabs":
        # You already pay for ElevenLabs as the default engine. Using it here
        # keeps ONE voice across both runtimes, which matters while you are
        # A/B testing them — otherwise you are comparing voices as well as
        # engines and cannot tell which changed.
        # Needs: pip install livekit-plugins-elevenlabs
        from livekit.plugins import elevenlabs

        return elevenlabs.TTS(
            voice_id=os.environ.get("ELEVENLABS_VOICE_ID") or None,
            api_key=os.environ.get("ELEVENLABS_API_KEY"),
        )

    raise ValueError(
        f"Unknown ONGEA_TTS provider: {provider!r}. Use one of: fish, openai, elevenlabs."
    )


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    participant = await ctx.wait_for_participant()
    user = UserContext.from_metadata(participant.metadata)
    logger.info("session start user=%s room=%s", user.user_id, ctx.room.name)

    if not user.user_id:
        # Without identity we cannot attribute a payment to anyone. Refuse
        # rather than run an anonymous money-capable agent.
        logger.error("no user metadata on participant; refusing session")
        return

    from livekit.plugins import openai

    session = AgentSession(
        stt=build_stt(),
        llm=openai.LLM(
            model=os.environ.get("ONGEA_LLM_MODEL", "gpt-4o-mini"),
            api_key=os.environ["ONGEA_LLM_API_KEY"],
            base_url=os.environ.get("ONGEA_LLM_BASE_URL") or None,
        ),
        tts=build_tts(),
        # VAD detects speech presence and drives barge-in; the turn detector adds
        # the semantic "have they actually finished?" signal on top, which is what
        # stops the agent interrupting mid-sentence.
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    # Tally synthesised characters so the session's TTS cost can be reported.
    spoken_chars = {"n": 0}

    @session.on("speech_created")
    def _count_speech(event) -> None:  # noqa: ANN001 - LiveKit event object
        text = getattr(event, "text", None) or ""
        spoken_chars["n"] += len(text)

    await session.start(
        room=ctx.room,
        agent=OngeaAgent(user, room=ctx.room, participant_identity=participant.identity),
    )

    greeting = f"Niaje {user.user_name.split(' ')[0]}, ni Ongea Pesa. Nikusaidie aje?"
    await session.say(greeting, allow_interruptions=True)

    # Report cost when the room empties, whichever way the call ended.
    async def _on_shutdown() -> None:
        await report_tts_cost(user, spoken_chars["n"])

    ctx.add_shutdown_callback(_on_shutdown)


def preflight() -> None:
    """Name every missing variable at once, before the SDK dies on the first one.

    The LiveKit worker raises on one variable at a time - fix LIVEKIT_API_KEY and
    it restarts only to die on LIVEKIT_URL. Under `restart: unless-stopped` that
    is an endless crash-loop where each round reveals exactly one more thing, and
    the traceback buries the real cause. This reports the whole set once.
    """
    required = {
        "LIVEKIT_URL": "wss://<project>.livekit.cloud - from livekit.io Settings -> Keys",
        "LIVEKIT_API_KEY": "from the same LiveKit project",
        "LIVEKIT_API_SECRET": "from the same LiveKit project",
        "ONGEA_LLM_API_KEY": "OpenAI (or compatible) key for intent + tool calling",
    }
    # Only demand the key for the TTS actually selected — the same way STT works
    # below. Blocking startup on a vendor you are not using is noise.
    tts = tts_provider()
    if tts == "fish":
        required["FISH_API_KEY"] = (
            "fish.audio -> Developers -> API keys. "
            "No account? Set ONGEA_TTS=openai to reuse your OpenAI key instead."
        )
    elif tts == "elevenlabs":
        required["ELEVENLABS_API_KEY"] = "elevenlabs.io (ONGEA_TTS=elevenlabs)"
    # openai TTS falls back to ONGEA_LLM_API_KEY, already required above.

    stt = os.environ.get("ONGEA_STT", "deepgram").lower()
    if stt == "deepgram":
        required["DEEPGRAM_API_KEY"] = "deepgram.com -> API keys (ONGEA_STT=deepgram)"
    elif stt in ("openai", "whisper"):
        required["OPENAI_API_KEY"] = "platform.openai.com (ONGEA_STT=openai)"

    missing = [k for k in required if not (os.environ.get(k) or "").strip()]
    if not missing:
        logger.info(
            "preflight ok - stt=%s llm=%s app=%s",
            stt, os.environ.get("ONGEA_LLM_MODEL", "gpt-4o-mini"), APP_URL,
        )
        return

    logger.error("=" * 68)
    logger.error("CANNOT START - %d required environment variable(s) missing:", len(missing))
    for k in missing:
        logger.error("  %-22s %s", k, required[k])
    logger.error("")
    logger.error("Set these in Hostinger: Docker Manager -> ongea-voice-agent ->")
    logger.error("Environment variables, then redeploy. Full list: voice-agent/.env.example")
    logger.error("=" * 68)
    raise SystemExit(1)


# Subcommands that do not connect to anything and therefore need no credentials.
# `download-files` runs during `docker build`, where no environment exists yet —
# gating it behind preflight fails the image build instead of the container.
_NO_CREDENTIALS_NEEDED = {"download-files", "help", "--help", "-h"}


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2 or sys.argv[1] not in _NO_CREDENTIALS_NEEDED:
        preflight()
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
