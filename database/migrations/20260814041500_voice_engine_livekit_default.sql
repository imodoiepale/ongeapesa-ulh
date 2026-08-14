-- LiveKit becomes the default voice engine; ElevenLabs stays the dormant fallback.
--
-- 20260806122500_voice_engine_toggle.sql set DEFAULT 'elevenlabs' when LiveKit
-- was an admin-only experiment. The app now treats LiveKit as primary, but every
-- existing row still said 'elevenlabs' — so /api/voice/engine truthfully reported
-- the fallback, VoiceProvider mounted the dormant engine, and the browser kept
-- calling /api/get-signed-url. Inverting the code without migrating the data left
-- the switch half done: code said LiveKit, data said ElevenLabs, and data won.
--
-- 'elevenlabs' stays a legal value on purpose: pinning an account back to the
-- fallback is the escape hatch if LiveKit misbehaves. Do NOT drop it from the
-- profiles_voice_engine_check constraint.
--
-- guard_voice_engine_update permits postgres and service_role, so this migration
-- passes; it only blocks ordinary users from switching themselves.

ALTER TABLE public.profiles ALTER COLUMN voice_engine SET DEFAULT 'livekit';

UPDATE public.profiles
SET voice_engine = 'livekit'
WHERE voice_engine = 'elevenlabs';
