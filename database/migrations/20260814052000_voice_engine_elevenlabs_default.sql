-- ElevenLabs becomes the default voice engine again; self-hosted LiveKit is the
-- fallback. Reverses 20260814041500_voice_engine_livekit_default.sql.
--
-- Not a rollback of a mistake — the self-hosted stack works, it is just slower
-- end to end and the gap is not close. ElevenLabs runs gemini-2.5-flash +
-- eleven_flash_v2 (~75ms to first byte) + scribe_realtime on their edge; the
-- worker runs gpt-4o-mini + tts-1 + Deepgram from a single VPS in Nairobi.
--
-- 'livekit' stays a legal value on purpose: pinning an account to the
-- self-hosted stack is how it gets exercised, and it is the escape hatch if
-- ElevenLabs has an outage.

ALTER TABLE public.profiles ALTER COLUMN voice_engine SET DEFAULT 'elevenlabs';

UPDATE public.profiles
SET voice_engine = 'elevenlabs'
WHERE voice_engine = 'livekit';
