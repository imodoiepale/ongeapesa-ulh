/**
 * Voice client tools — the ONE implementation, shared by both voice engines.
 *
 * ElevenLabs reaches these through `clientTools` in ElevenLabsContext; LiveKit
 * reaches the same functions through `room.registerRpcMethod` in
 * LiveKitVoiceContext. Different transports, identical behaviour.
 *
 * That is deliberate and matches how the money path already works: the LiveKit
 * worker posts to the same `/api/voice/webhook` the ElevenLabs agent uses, so
 * fees and authorisation are computed in exactly one place. Duplicating these
 * handlers per engine would reintroduce precisely the drift that design avoids —
 * and a behavioural difference between engines is a bug, not a feature.
 *
 * Every tool returns a STRING, because that is what both transports hand back
 * to the model to speak.
 */

import { normalizeVoiceItem, summariseBatchResults } from '@/lib/batch-payments';
import type { BatchItem, BatchResponse } from '@/lib/batch-payments';

export interface PaymentSlots {
  amount?: number;
  phone?: string;
  till?: string;
  paybill?: string;
  account?: string;
  type?: string;
  recipientName?: string;
}

export interface ToolHandlers {
  openScanner?: () => void;
  startScan?: (mode?: string | null) => void;
  confirmPayment?: () => void;
  getBalance?: () => number;
  /** Called after send_batch completes — navigate to batch screen and show results */
  showBatch?: (payments: BatchItem[], results?: BatchResponse) => void;
  stagePayment?: (slots: PaymentSlots & { index?: number }) => void;
}

export interface VoiceToolDeps {
  /** Current handler registry. A getter, not a snapshot — screens mount and
   *  unmount mid-call and must be able to (de)register while connected. */
  handlers: () => ToolHandlers;
  /** Used only when no screen has registered a getBalance handler. */
  fallbackBalance: () => number;
}

export type VoiceTools = ReturnType<typeof createVoiceTools>;

export function createVoiceTools({ handlers, fallbackBalance }: VoiceToolDeps) {
  return {
    // These tools drive the UI, so a missing handler means the screen that owns
    // the action isn't mounted. Optional chaining used to swallow that and still
    // return the success string, so the agent would cheerfully say "Opening
    // scanner now" while nothing opened. Report what actually happened — a model
    // that is told the truth can retry or explain; one that is told it succeeded
    // cannot.
    open_scanner: async (): Promise<string> => {
      const handler = handlers().openScanner;
      if (!handler) return 'The scanner is already open.';
      handler();
      return 'Opening scanner now';
    },

    start_scan: async (params?: { mode?: string }): Promise<string> => {
      const mode = params?.mode ?? null;
      const handler = handlers().startScan;
      if (!handler) return 'Could not start the scan — the scanner is not open yet.';
      handler(mode);
      return `Starting ${mode ?? 'auto'} scan`;
    },

    confirm_payment: async (): Promise<string> => {
      const handler = handlers().confirmPayment;
      if (!handler) return 'There is nothing on screen to confirm right now.';
      handler();
      return 'Confirming payment';
    },

    read_balance: async (): Promise<string> => {
      const bal = handlers().getBalance?.() ?? fallbackBalance();
      return `Your balance is KSh ${bal.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
    },

    stage_payment: async (params: PaymentSlots): Promise<string> => {
      handlers().stagePayment?.(params);
      return 'staged';
    },

    /**
     * send_batch — dispatches multiple payments as individual requests.
     * The agent passes { payments: Array<{ amount, kind?, phone?, till?, paybill?, account?, ... }> }.
     * Each item is normalised by normalizeVoiceItem and sent to /api/payments/batch.
     * Returns a spoken summary the agent can read back directly.
     *
     * This runs in the BROWSER for both engines, never on the LiveKit worker.
     * /api/payments/batch authenticates by session cookie, which the worker does
     * not have — routing it through the browser reuses the existing auth instead
     * of opening a second, secret-gated way to move money.
     */
    send_batch: async (params?: {
      payments?: Record<string, any>[];
      narration?: string;
    }): Promise<string> => {
      const rawItems = params?.payments ?? [];
      if (rawItems.length === 0) {
        return 'No payments specified. Please tell me who to send to and how much.';
      }

      const items: BatchItem[] = rawItems.map(normalizeVoiceItem);
      const total = items.reduce((s, p) => s + p.amount, 0);
      const n = items.length;

      console.log(`🎙️ send_batch: ${n} items, KES ${total}`);

      let json: BatchResponse;
      try {
        const res = await fetch('/api/payments/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payments: items, narration: params?.narration }),
        });
        json = await res.json();
      } catch (err: any) {
        return `Network error — payments not sent. Please try again.`;
      }

      // Notify any mounted component (e.g. BatchSend screen) with the results
      handlers().showBatch?.(items, json);

      if (!json.success && json.error === 'Insufficient funds') {
        return `Insufficient funds. You need KES ${json.shortfall?.toFixed(2) ?? '?'} more to cover all ${n} payments.`;
      }

      return summariseBatchResults(json.results ?? []);
    },
  };
}
