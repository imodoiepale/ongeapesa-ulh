"use client"

/**
 * LiveKit voice runtime — the browser half of the self-hosted engine.
 *
 * Mirrors ElevenLabsContext deliberately: same handler registry, same public
 * surface, same tool implementations. The ONLY difference is the transport.
 * ElevenLabs delivers tool calls through its `clientTools` map; LiveKit
 * delivers them as RPC over the data channel. Both resolve to the identical
 * functions in lib/voice-tools.ts, so a tool cannot behave differently
 * depending on which engine a user happens to be on.
 *
 * Requires `canPublishData: true` on the access token — see
 * app/api/voice/livekit-token/route.ts. Without it the browser receives the RPC
 * but cannot reply, and every scan hangs until the agent times out.
 */

import {
  createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode,
} from 'react';
import { Room, RoomEvent, RpcInvocationData } from 'livekit-client';
import { createVoiceTools } from '@/lib/voice-tools';
import type { PaymentSlots, ToolHandlers } from '@/lib/voice-tools';
import { VoiceContext } from './ElevenLabsContext';
import type { VoiceContextValue } from './ElevenLabsContext';

export type { PaymentSlots, ToolHandlers };

interface Message {
  id: string;
  text: string;
  source: 'user' | 'ai';
  timestamp: Date;
}

/** RPC method names. These MUST match the @function_tool names in
 *  voice-agent/agent.py — LiveKit routes purely on the string. */
const RPC_METHODS = [
  'open_scanner',
  'start_scan',
  'confirm_payment',
  'read_balance',
  'stage_payment',
  'send_batch',
] as const;

export function LiveKitVoiceProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);
  const [userBalance, setUserBalance] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);

  // Transcripts arrive as agent/user text on the room; kept for parity with the
  // ElevenLabs surface so the chat panel renders identically on both engines.
  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [
      ...prev,
      { id: Date.now().toString(), text, source: 'user', timestamp: new Date() },
    ]);
  }, []);

  const roomRef = useRef<Room | null>(null);
  const toolHandlersRef = useRef<ToolHandlers>({});
  // Audio elements created by track.attach(). Tracked so they can be removed on
  // disconnect — otherwise every session leaves one behind in the DOM.
  const audioElsRef = useRef<HTMLAudioElement[]>([]);

  const registerToolHandlers = useCallback((handlers: ToolHandlers) => {
    toolHandlersRef.current = { ...toolHandlersRef.current, ...handlers };
  }, []);

  const unregisterToolHandlers = useCallback((keys: (keyof ToolHandlers)[]) => {
    keys.forEach(k => { delete toolHandlersRef.current[k]; });
  }, []);

  // See ElevenLabsContext: the tool closures are built once, so reading the
  // state variable directly would pin read_balance to its mount-time value.
  const userBalanceRef = useRef(0);
  useEffect(() => { userBalanceRef.current = userBalance; }, [userBalance]);

  const voiceToolsRef = useRef(
    createVoiceTools({
      handlers: () => toolHandlersRef.current,
      fallbackBalance: () => userBalanceRef.current,
    }),
  );

  const startSession = useCallback(async () => {
    if (roomRef.current) return;
    setIsLoading(true);
    setError(null);

    try {
      // Mints the token AND opens the voice_sessions row, so billing and the
      // 15-minute expiry behave the same as on the ElevenLabs path.
      const res = await fetch('/api/voice/livekit-token', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start the voice session');

      setVoiceSessionId(data.voiceSessionId ?? null);
      setUserBalance(Number(data.balance ?? 0));

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      // Register BEFORE connect. The agent can call a tool the instant it sees
      // the participant, and an unregistered method is a hard RPC error rather
      // than a retry.
      const tools = voiceToolsRef.current as Record<string, (p?: any) => Promise<string>>;
      for (const method of RPC_METHODS) {
        room.localParticipant.registerRpcMethod(method, async (inv: RpcInvocationData) => {
          try {
            const payload = inv.payload ? JSON.parse(inv.payload) : {};
            return await tools[method](payload);
          } catch (err: any) {
            // Return a spoken-safe string rather than throwing: the agent is
            // instructed to say what a tool returned, and an RPC exception
            // would surface to the user as dead air.
            console.error(`RPC ${method} failed:`, err);
            return `Sorry, that didn't work.`;
          }
        });
      }

      room
        .on(RoomEvent.Connected, () => { setIsConnected(true); setIsLoading(false); })
        .on(RoomEvent.Disconnected, () => {
          setIsConnected(false);
          setIsSpeaking(false);
          // Drop the playback elements with the session, or they pile up in the
          // DOM one per call and can keep a dead stream referenced.
          audioElsRef.current.forEach(e => e.remove());
          audioElsRef.current = [];
          roomRef.current = null;
        })
        // The agent is the only other participant, so any remote audio is it.
        // Subscribing to a track is NOT the same as playing it. LiveKit hands
        // over a MediaStreamTrack and it stays silent until it is attached to
        // an <audio> element in the DOM. Without this the session connects,
        // shows "listening", bills the user — and plays nothing, which looks
        // like a broken agent rather than a missing element.
        .on(RoomEvent.TrackSubscribed, (track: any) => {
          if (track?.kind !== 'audio') return;
          const el: HTMLAudioElement = track.attach();
          el.autoplay = true;
          // Off-screen: this element is for playback, not for looking at.
          el.style.display = 'none';
          document.body.appendChild(el);
          audioElsRef.current.push(el);
          setIsSpeaking(true);
        })
        .on(RoomEvent.TrackUnsubscribed, (track: any) => {
          if (track?.kind !== 'audio') return;
          // detach() returns the elements it was attached to; remove them or
          // they accumulate in the DOM across sessions.
          (track.detach() as HTMLMediaElement[]).forEach(e => e.remove());
          audioElsRef.current = audioElsRef.current.filter(e => e.isConnected);
          setIsSpeaking(false);
        });

      await room.connect(data.url, data.token);

      // Browsers block autoplaying audio until a user gesture. startSession is
      // called from a tap, so this is allowed here — but it must be called
      // explicitly or the first greeting is silently dropped on mobile.
      try {
        await room.startAudio();
      } catch (e) {
        console.warn('startAudio blocked; audio resumes on next interaction', e);
      }

      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (err: any) {
      console.error('LiveKit session failed:', err);
      setError(err?.message ?? 'Could not start the voice session');
      setIsLoading(false);
      roomRef.current = null;
    }
  }, []);

  const endSession = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try { await room.disconnect(); } finally {
      roomRef.current = null;
      setIsConnected(false);
      setIsSpeaking(false);
    }
  }, []);

  // A tab closed mid-call must not leave the room (and the meter) open.
  useEffect(() => () => { roomRef.current?.disconnect(); }, []);

  // Fills the SAME context ElevenLabsProvider does, so voice-interface,
  // payment-scanner, batch-send and global-voice-widget keep calling
  // useElevenLabs() and work on either engine with no per-engine branching.
  const value: VoiceContextValue = {
    isConnected,
    isLoading,
    isSpeaking,
    messages,
    sendMessage,
    clearMessages: () => setMessages([]),
    // ElevenLabs exposes its SDK object here. LiveKit's equivalent is the Room,
    // and error is surfaced on it so a caller reading `.error` sees something
    // useful rather than undefined.
    conversation: { room: roomRef.current, error, voiceSessionId },
    startSession,
    endSession,
    registerToolHandlers,
    unregisterToolHandlers,
    // ElevenLabs pushes mid-call context to the model. LiveKit has no direct
    // equivalent on the agent side yet, so this is a no-op rather than a throw:
    // a caller nudging context must not break a live call.
    sendContextualUpdate: async (text: string) => {
      console.debug('[livekit] contextual update ignored (unsupported):', text);
    },
  };

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
