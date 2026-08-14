"use client"

/**
 * Mounts the voice engine. LiveKit is the DEFAULT; ElevenLabs is the dormant
 * fallback.
 *
 * Both providers fill the same context, so every consumer keeps calling
 * useElevenLabs() and needs no per-engine branching.
 *
 * The fallback is not decoration. It engages when:
 *   - the engine lookup explicitly pins this account to 'elevenlabs', or
 *   - LiveKit is unreachable (SFU down, LIVEKIT_* unset, token refused).
 *
 * That matters because LiveKit is self-hosted: if the SFU on the VPS stops,
 * voice would otherwise go dark for everyone. Falling back keeps a working
 * path instead of a dead microphone button.
 */

import { useEffect, useState, ReactNode } from 'react';
import { ElevenLabsProvider } from './ElevenLabsContext';
import { LiveKitVoiceProvider } from './LiveKitVoiceContext';

type Engine = 'livekit' | 'elevenlabs';

export function VoiceProvider({ children }: { children: ReactNode }) {
  // Default to LiveKit and correct downward, so the primary engine is what
  // mounts on first paint rather than a flash of the fallback.
  const [engine, setEngine] = useState<Engine>('livekit');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/voice/engine');
        if (!res.ok) return;
        const { engine: e } = await res.json();
        // Only an explicit 'elevenlabs' moves us off the default.
        if (!cancelled && e === 'elevenlabs') setEngine('elevenlabs');
      } catch {
        // Lookup failure keeps LiveKit. If LiveKit itself then fails to start,
        // LiveKitVoiceContext reports it and the user sees a real error rather
        // than silence.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Keying forces a clean remount if the engine ever changes mid-session, so a
  // stale Room or SDK instance cannot leak across engines.
  return engine === 'elevenlabs'
    ? <ElevenLabsProvider key="elevenlabs">{children}</ElevenLabsProvider>
    : <LiveKitVoiceProvider key="livekit">{children}</LiveKitVoiceProvider>;
}
