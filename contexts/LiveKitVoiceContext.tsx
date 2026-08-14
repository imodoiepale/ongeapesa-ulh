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

export type { PaymentSlots, ToolHandlers };

interface LiveKitVoiceContextType {
  isConnected: boolean;
  isLoading: boolean;
  isSpeaking: boolean;
  error: string | null;
  room: Room | null;
  voiceSessionId: string | null;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  registerToolHandlers: (handlers: ToolHandlers) => void;
  unregisterToolHandlers: (keys: (keyof ToolHandlers)[]) => void;
}

const LiveKitVoiceContext = createContext<LiveKitVoiceContextType | undefined>(undefined);

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

  const roomRef = useRef<Room | null>(null);
  const toolHandlersRef = useRef<ToolHandlers>({});

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
          roomRef.current = null;
        })
        // The agent is the only other participant, so any remote audio is it.
        .on(RoomEvent.TrackSubscribed, () => setIsSpeaking(true))
        .on(RoomEvent.TrackUnsubscribed, () => setIsSpeaking(false));

      await room.connect(data.url, data.token);
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

  return (
    <LiveKitVoiceContext.Provider
      value={{
        isConnected, isLoading, isSpeaking, error,
        room: roomRef.current, voiceSessionId,
        startSession, endSession,
        registerToolHandlers, unregisterToolHandlers,
      }}
    >
      {children}
    </LiveKitVoiceContext.Provider>
  );
}

export function useLiveKitVoice() {
  const ctx = useContext(LiveKitVoiceContext);
  if (!ctx) throw new Error('useLiveKitVoice must be used within a LiveKitVoiceProvider');
  return ctx;
}
