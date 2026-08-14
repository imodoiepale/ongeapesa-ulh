"use client"

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useConversation } from '@elevenlabs/react';
import { useUser } from './UserContext';
import type { BatchItem, BatchResponse } from '@/lib/batch-payments';
import { createVoiceTools } from '@/lib/voice-tools';
import type { PaymentSlots, ToolHandlers } from '@/lib/voice-tools';
import { PLATFORM_FEE_RATE } from '@/lib/transaction-fees';
import { VOICE_RATE_PER_MINUTE } from '@/lib/voice-funding';

interface Message {
  id: string;
  text: string;
  source: 'user' | 'ai';
  timestamp: Date;
}

// Both types now live in lib/voice-tools.ts, shared with the LiveKit engine.
// Re-exported so existing importers of this module keep working.
export type { PaymentSlots, ToolHandlers } from '@/lib/voice-tools';

interface ElevenLabsContextType {
  isConnected: boolean;
  isLoading: boolean;
  messages: Message[];
  sendMessage: (text: string) => void;
  clearMessages: () => void;
  isSpeaking: boolean;
  conversation: any;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  registerToolHandlers: (handlers: ToolHandlers) => void;
  unregisterToolHandlers: (keys: (keyof ToolHandlers)[]) => void;
  sendContextualUpdate: (text: string) => Promise<void>;
}

const ElevenLabsContext = createContext<ElevenLabsContextType | undefined>(undefined);

export function ElevenLabsProvider({ children }: { children: ReactNode }) {
  const { userId } = useUser();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userBalance, setUserBalance] = useState<number>(0);
  const voiceSessionIdRef = useRef<string | null>(null);
  const voiceBudgetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionSettledRef = useRef(false);

  // Handler registry for client-tool delegates
  const toolHandlersRef = useRef<ToolHandlers>({});

  const registerToolHandlers = (handlers: ToolHandlers) => {
    toolHandlersRef.current = { ...toolHandlersRef.current, ...handlers };
  };

  const unregisterToolHandlers = (keys: (keyof ToolHandlers)[]) => {
    keys.forEach(k => { delete toolHandlersRef.current[k]; });
  };

  // Mirror of userBalance readable from inside the tools. The tool closures are
  // created once, so reading the state variable directly would pin them to its
  // value at mount and read_balance would go stale mid-call.
  const userBalanceRef = useRef(0);
  useEffect(() => { userBalanceRef.current = userBalance; }, [userBalance]);

  // The ONE tool implementation — shared with the LiveKit engine via
  // lib/voice-tools.ts. This context only supplies the transport.
  const voiceToolsRef = useRef(
    createVoiceTools({
      handlers: () => toolHandlersRef.current,
      fallbackBalance: () => userBalanceRef.current,
    }),
  );

  const settleVoiceSession = useCallback(async () => {
    const voiceSessionId = voiceSessionIdRef.current;
    if (!voiceSessionId || sessionSettledRef.current) return;
    sessionSettledRef.current = true;
    if (voiceBudgetTimerRef.current) clearTimeout(voiceBudgetTimerRef.current);

    try {
      const response = await fetch('/api/voice/session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_session_id: voiceSessionId }),
        keepalive: true,
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && Number.isFinite(Number(result.balance))) {
        setUserBalance(Number(result.balance));
        window.dispatchEvent(new CustomEvent('ongea:wallet-balance-updated', { detail: { balance: Number(result.balance) } }));
      } else if (!response.ok) {
        sessionSettledRef.current = false;
      }
    } catch {
      sessionSettledRef.current = false;
    }
  }, []);

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log('🎙️ Global ElevenLabs connected');
      console.log('📊 Connection status:', conversation.status);
      setIsConnected(true);
      setIsLoading(false);
    },
    onDisconnect: (reason?: any) => {
      console.log('🎙️ Global ElevenLabs disconnected');
      console.log('📊 Disconnect reason:', reason);
      console.log('📊 Final status:', conversation.status);
      console.trace('Disconnect call stack');
      setIsConnected(false);
      setIsLoading(false); // Reset loading state to prevent stuck state
      void settleVoiceSession();
    },
    onMessage: (message: any) => {
      console.log('📨 ElevenLabs message:', message);

      // Handle AI responses
      if (message.source === 'ai' || message.type === 'agent_response') {
        const text = message.message || message.text || message.agent_response || message.response;
        if (text) {
          addMessage(text, 'ai');
        }
      }

      // Handle user transcripts
      if (message.source === 'user' || message.type === 'user_transcript') {
        const text = message.message || message.text || message.user_transcript;
        if (text) {
          addMessage(text, 'user');
        }
      }
    },
    onError: (error: any) => {
      console.error('🔴 Global ElevenLabs error:', error);
      console.error('🔴 Error details:', JSON.stringify(error, null, 2));
      console.error('🔴 Current status:', conversation.status);
      setIsLoading(false);
      setIsConnected(false); // Ensure disconnected state on error
    },
    onStatusChange: (status: any) => {
      console.log('📊 ElevenLabs status changed:', status);
    },
    // Transport only. The handlers themselves live in lib/voice-tools.ts and
    // are shared byte-for-byte with the LiveKit engine, so the two runtimes
    // cannot drift in what a tool actually does.
    clientTools: voiceToolsRef.current,
  });

  // Add message to chat
  const addMessage = (text: string, source: 'user' | 'ai') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      source,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  // Send text message to AI
  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    // Add user message immediately
    addMessage(text, 'user');

    // Note: ElevenLabs conversation API doesn't have direct text send
    // We'll use the conversation's internal methods if available
    console.log('💬 Sending message to ElevenLabs:', text);

    // The conversation API is voice-based, so we log this
    // In production, you might want to convert text to speech or use a different API
  };

  // Clear all messages
  const clearMessages = () => {
    setMessages([]);
  };

  // Get signed URL for ElevenLabs
  const getSignedUrl = async (): Promise<{ signedUrl: string; balance: number; userName: string; userEmail: string; userId: string; gateName: string; gateId: string; voiceSessionId: string | null }> => {
    try {
      const response = await fetch('/api/get-signed-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get signed URL');
      }
      
      const { signedUrl, userId: returnedUserId, balance, userName, userEmail, gateName, gateId, voiceSessionId } = await response.json();
      console.log('✅ Got signed URL for userId:', returnedUserId, 'email:', userEmail, 'balance:', balance, 'name:', userName);
      return { signedUrl, balance, userName, userEmail, userId: returnedUserId, gateName: gateName || '', gateId: gateId || '', voiceSessionId: voiceSessionId || null };
    } catch (error) {
      console.error('❌ Error getting signed URL:', error);
      throw error;
    }
  };

  // Fetch and track user balance in real-time
  useEffect(() => {
    if (!userId) return;

    const fetchBalance = async () => {
      try {
        const response = await fetch('/api/balance');
        if (response.ok) {
          const data = await response.json();
          const balance = data.balance || 0;
          setUserBalance(balance);
          console.log('💰 Balance updated for ElevenLabs context:', balance);
        }
      } catch (error) {
        console.error('Failed to fetch balance:', error);
      }
    };

    // Fetch immediately
    fetchBalance();

    // Refresh balance every 10 seconds for real-time updates
    const balanceInterval = setInterval(fetchBalance, 10000);

    return () => clearInterval(balanceInterval);
  }, [userId]); // Only depend on userId to prevent interference with conversation

  // Manual start function exposed for components to use
  const startElevenLabsSession = async () => {
    if (!userId) {
      console.log('⚠️ Cannot start session: No userId');
      return;
    }

    // Comprehensive guard: check if already connected OR connecting
    const currentStatus = conversation.status;
    if (currentStatus === 'connected' || currentStatus === 'connecting') {
      console.log('⚠️ Session already active or connecting (status:', currentStatus, '), skipping duplicate start');
      if (currentStatus === 'connected') {
        setIsConnected(true);
      }
      setIsLoading(false);
      return;
    }

    // If loading flag is set, don't start another
    if (isLoading) {
      console.log('⚠️ Session already starting (loading flag set), please wait');
      return;
    }

    try {
      setIsLoading(true);
      console.log('🚀 Starting global ElevenLabs session for userId:', userId);
      
      // Request microphone permissions BEFORE starting session
      console.log('🎤 Requesting microphone permissions...');
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('✅ Microphone access granted');
      } catch (micError) {
        console.error('❌ Microphone access denied:', micError);
        setIsLoading(false);
        setIsConnected(false);
        throw new Error('Microphone access is required for voice interaction');
      }
      
      const { signedUrl, balance, userName, userEmail, userId: returnedUserId, gateName, gateId, voiceSessionId } = await getSignedUrl();
      const firstMinuteDebit = VOICE_RATE_PER_MINUTE * (1 + PLATFORM_FEE_RATE);
      if (balance < firstMinuteDebit) {
        throw new Error(`Add at least KSH ${firstMinuteDebit.toFixed(2)} to use voice.`);
      }
      sessionSettledRef.current = false;
      console.log('📝 Received signed URL (first 100 chars):', signedUrl.substring(0, 100));
      
      // Prepare dynamic variables to pass to the session
      const dynamicVariables = {
        user_id: returnedUserId,
        user_email: userEmail || '',
        user_name: userName || 'User',
        balance: balance.toString(),
        gate_name: gateName || '',
        gate_id: gateId || ''
      };
      
      console.log('💰 Dynamic variables for ElevenLabs session:', dynamicVariables);
      console.log('📡 Starting session with conversation.startSession()...');
      
      await conversation.startSession({ 
        signedUrl: signedUrl,
        dynamicVariables: dynamicVariables
      });

      voiceSessionIdRef.current = voiceSessionId;

      if (voiceSessionId) {
        await fetch('/api/voice/session', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voice_session_id: voiceSessionId }),
        }).catch(() => undefined);
      }

      const affordableSeconds = Math.max(1, Math.floor((balance / firstMinuteDebit) * 60));
      voiceBudgetTimerRef.current = setTimeout(() => {
        void conversation.endSession?.();
        void settleVoiceSession();
      }, Math.min(affordableSeconds, 15 * 60) * 1000);
      
      console.log('✅ conversation.startSession() completed - waiting for onConnect callback');
      
      // Update local balance state
      setUserBalance(balance);
    } catch (error) {
      console.error('Failed to start ElevenLabs session:', error);
      setIsLoading(false);
      setIsConnected(false);
    }
  };

  // Inject text into the live ElevenLabs session
  const sendContextualUpdate = async (text: string) => {
    try {
      if ((conversation as any).sendContextualUpdate) {
        await (conversation as any).sendContextualUpdate(text);
      } else if ((conversation as any).sendUserMessage) {
        await (conversation as any).sendUserMessage(text);
      }
      // fallback: just log — the feature degrades gracefully
    } catch (e) {
      console.warn('sendContextualUpdate not available:', e);
    }
  };

  // End session function
  const endElevenLabsSession = async () => {
    try {
      console.log('🛑 Ending ElevenLabs session');

      if (conversation?.endSession && conversation.status === 'connected') {
        await conversation.endSession();
      }

      await settleVoiceSession();

      setIsConnected(false);
      setIsLoading(false);
      clearMessages();

      console.log('✅ Session ended successfully');
    } catch (error) {
      console.error('Failed to end ElevenLabs session:', error);
      // Force disconnect
      setIsConnected(false);
      setIsLoading(false);
    }
  };

  const value = {
    isConnected,
    isLoading,
    messages,
    sendMessage,
    clearMessages,
    isSpeaking: conversation.isSpeaking || false,
    conversation,
    startSession: startElevenLabsSession,
    endSession: endElevenLabsSession,
    registerToolHandlers,
    unregisterToolHandlers,
    sendContextualUpdate,
  };

  return (
    <ElevenLabsContext.Provider value={value}>
      {children}
    </ElevenLabsContext.Provider>
  );
}

export function useElevenLabs() {
  const context = useContext(ElevenLabsContext);
  if (!context) {
    throw new Error('useElevenLabs must be used within ElevenLabsProvider');
  }
  return context;
}
