"use client"

/**
 * Mounts the voice engine. ElevenLabs is the DEFAULT; the self-hosted LiveKit
 * stack is the fallback, used only for accounts explicitly pinned to it.
 *
 * ElevenLabs is markedly faster end to end, which is what makes voice usable.
 *
 * Both providers fill the same context, so every consumer keeps calling
 * useElevenLabs() and needs no per-engine branching.
 *
 * The self-hosted path is kept, not deleted. It is the escape hatch if
 * ElevenLabs has an outage, and an account can be pinned to it by setting
 * profiles.voice_engine = 'livekit'.
 */

import { useEffect, useState, ReactNode } from 'react';
import { ElevenLabsProvider } from './ElevenLabsContext';
import { LiveKitVoiceProvider } from './LiveKitVoiceContext';

type Engine = 'elevenlabs' | 'livekit';

export function VoiceProvider({ children }: { children: ReactNode }) {
  // Default to the primary engine so it mounts on first paint, rather than
  // showing a flash of the other one while the lookup resolves.
  const [engine, setEngine] = useState<Engine>('elevenlabs');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/voice/engine');
        if (!res.ok) return;
        const { engine: e } = await res.json();
        // Only an explicit 'livekit' moves us off the default.
        if (!cancelled && e === 'livekit') setEngine('livekit');
      } catch {
        // A lookup failure keeps ElevenLabs. Never demote someone to the
        // slower engine because a fetch failed.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Keying forces a clean remount if the engine ever changes mid-session, so a
  // stale Room or SDK instance cannot leak across engines.
  return engine === 'livekit'
    ? <LiveKitVoiceProvider key="livekit">{children}</LiveKitVoiceProvider>
    : <ElevenLabsProvider key="elevenlabs">{children}</ElevenLabsProvider>;
}
