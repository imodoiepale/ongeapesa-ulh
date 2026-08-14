#!/usr/bin/env node
// scripts/configure-loop-agent.mjs
//
// Creates "ONGEA PESA LOOP" — a duplicate of ONGEA PESA V2 with the LOOP rails
// added as tools. Idempotent: safe to re-run.
//
//   node scripts/configure-loop-agent.mjs
//
// Why a duplicate rather than editing V2: V2 is the rollback. If the LOOP tools
// confuse the model, you switch NEXT_PUBLIC_AGENT_ID back and are instantly on
// a known-good agent. Deleting V2 removes that.
//
// Why ElevenLabs rather than the self-hosted worker: the live configs are not a
// close call. V2 runs gemini-2.5-flash + eleven_flash_v2 (~75ms to first byte) +
// scribe_realtime on ElevenLabs' edge; the worker runs gpt-4o-mini + tts-1 +
// Deepgram from a single VPS in Nairobi. Three of four favour ElevenLabs and
// they compound. The worker stays as the fallback.
//
// The agent config is CLONED from V2 verbatim, not re-authored — that latency
// profile is the whole point and is easy to lose by hand.
//
// ⚠️  LOOP tools post STRAIGHT to n8n, bypassing /api/voice/webhook. That is what
//     makes them fast, but the platform fee, the free-transaction rule and voice
//     step-up all live in that webhook. LOOP payments therefore carry NO
//     platform fee and NO step-up confirmation. Fine for a sandbox demo; close
//     this before real money moves over LOOP.

const V2_AGENT_ID   = 'agent_5301kbp2gvypf0m83e579ya9nz75';
const SEND_MONEY_ID = 'tool_1201kc61sfd5f2kb453gred5j7dj';
const NEW_AGENT_NAME = 'ONGEA PESA LOOP';
const BASE_URL = 'https://api.elevenlabs.io';

const N8N_BASE = process.env.N8N_WEBHOOK_BASE_URL || 'https://n8n-lc5r.srv1631847.hstgr.cloud';
const APP_URL  = process.env.ONGEA_APP_URL || 'https://ongeapesa-ulh.nsait.co.ke';

const API_KEY = (process.env.ELEVENLABS_API_KEY || '').trim();
if (!API_KEY) {
  console.error('❌ ELEVENLABS_API_KEY not set.  export ELEVENLABS_API_KEY=sk_...');
  process.exit(1);
}

async function el(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

// Property shape copied verbatim from the working send_money tool. ElevenLabs
// rejects or silently ignores partial shapes, so every key is present.
const prop = (description, dyn = '') => ({
  type: 'string',
  description,
  enum: null,
  is_system_provided: false,
  dynamic_variable: dyn,
  allowed_values_dynamic_variable: '',
  constant_value: '',
  is_omitted: false,
});

// user_id is injected by ElevenLabs from the dynamic variables that
// app/api/get-signed-url/route.ts already passes — the model never sees or
// guesses it, which is what stops one user paying from another's wallet.
const USER_ID = prop('', 'user_id');

// The webhook returns the transactions row the n8n workflow wrote. Exposing it
// lets the agent speak the REAL outcome instead of assuming success — the same
// treatment send_money gets.
const RESPONSE_SCHEMA = {
  type: 'object',
  description: 'The ledger row after the LOOP call settled.',
  properties: {
    status: { type: 'string', description: "completed | processing | failed" },
    amount: { type: 'string', description: 'Amount in KES' },
    provider: { type: 'string', description: "always 'loop'" },
    external_ref: { type: 'string', description: "LOOP's reference for reconciliation" },
  },
};

const money = (extra = {}) => ({
  amount: prop('Amount in Kenyan shillings, digits only, e.g. "500"'),
  narration: prop('One-line description of what the user asked for'),
  user_id: USER_ID,
  ...extra,
});

const LOOP_TOOLS = [
  {
    name: 'loop_send_mpesa',
    description:
      "Send money OUT of LOOP to someone's M-Pesa phone number. Use when the recipient is on M-Pesa, not LOOP. Call only after the user has confirmed the amount and the number.",
    required: ['amount', 'phone'],
    properties: money({ phone: prop("Recipient's phone, 07XXXXXXXX or 2547XXXXXXXX") }),
  },
  {
    name: 'loop_send_loop',
    description:
      "Send money INSIDE LOOP to another LOOP wallet. Fastest and cheapest — prefer this when the recipient is on LOOP. Call only after the user confirms.",
    required: ['amount', 'phone'],
    properties: money({ phone: prop("Recipient's LOOP phone number") }),
  },
  {
    name: 'loop_send_pesalink',
    description:
      'Send money to a BANK account via PesaLink. Use when the user names a bank rather than M-Pesa or LOOP.',
    required: ['amount', 'phone'],
    properties: money({ phone: prop("Recipient's PesaLink-registered phone number") }),
  },
  {
    name: 'loop_pay_till',
    description: 'Pay a LOOP merchant till. Use for a LOOP till, not an M-Pesa buy-goods till.',
    required: ['amount', 'till'],
    properties: money({ till: prop('LOOP till number'), account: prop('Account number, if the till needs one') }),
  },
  {
    name: 'loop_pay_mpesa_till',
    description: 'Pay an M-Pesa buy-goods till number. Use for "lipa na M-Pesa" tills.',
    required: ['amount', 'till'],
    properties: money({ till: prop('M-Pesa till (buy goods) number'), account: prop('Account number, if required') }),
  },
  {
    name: 'loop_pay_paybill',
    description: 'Pay an M-Pesa paybill. Requires both the paybill number and the account number.',
    required: ['amount', 'paybill'],
    properties: money({ paybill: prop('Paybill number'), account: prop('Account/reference number for the paybill') }),
  },
  {
    name: 'loop_prompt',
    description:
      "Request money INTO the user's wallet — a LOOP Prompt sent to their phone to approve. Use for top-ups. Tell the user to approve it on their phone; the money only arrives after they do.",
    required: ['amount', 'phone'],
    properties: money({ phone: prop("Phone number to send the payment prompt to") }),
  },
  {
    name: 'loop_txn_inquiry',
    description:
      'Check the status of an earlier LOOP payment by its reference. Read-only — it never moves money.',
    required: ['txnReference'],
    properties: {
      txnReference: prop('The txnReference of the payment being asked about'),
      user_id: USER_ID,
    },
  },
];

const LOOP_PROMPT_SECTION = `

## LOOP rails — inside LOOP vs outside LOOP

Money can go to a LOOP wallet or out of LOOP entirely, and they are different
tools:

- INSIDE LOOP  -> loop_send_loop. Fastest and cheapest. Prefer it when the
                  recipient is on LOOP.
- OUTSIDE LOOP -> loop_send_mpesa (a phone number), loop_pay_mpesa_till (buy
                  goods), loop_pay_paybill (paybill + account), or
                  loop_send_pesalink (a bank account).
- TOPPING UP   -> loop_prompt. It sends a prompt to the user's phone; say
                  clearly that the money arrives only once they approve it.
- CHECKING     -> loop_txn_inquiry. Read-only.

If the user says "send 500 to Mary" and it is not obvious which they mean, ASK:
"Is Mary on LOOP, or should I send it to her M-Pesa?" Do not assume. Once they
answer, name the rail in your read-back: "Sending 500 to Mary on LOOP" or
"Sending 500 to Mary's M-Pesa 0712...".

Never call two payment tools for one request. Read back the amount and the
recipient, wait for a clear yes, then call exactly one.`;

async function main() {
  console.log('🔧  Ongea Pesa — LOOP agent configurator');
  console.log('='.repeat(56));
  console.log(`    Cloning from : ${V2_AGENT_ID}`);
  console.log(`    n8n base     : ${N8N_BASE}`);

  // 1. Existing tools, for idempotency by name.
  console.log('\n[1] Fetching workspace tools...');
  const allTools = (await el('GET', '/v1/convai/tools')).tools ?? [];
  const byName = {};
  for (const t of allTools) {
    const n = t.tool_config?.name ?? t.name;
    if (n) byName[n] = t.id ?? t.tool_id;
  }
  console.log(`    ${allTools.length} tools in workspace`);

  // 2. Create / patch the LOOP webhook tools.
  console.log(`\n[2] Creating / updating ${LOOP_TOOLS.length} LOOP tools...`);
  const loopToolIds = [];
  for (const def of LOOP_TOOLS) {
    const body = {
      tool_config: {
        type: 'webhook',
        name: def.name,
        description: def.description,
        // immediate: the agent waits for the real result and speaks it, rather
        // than replying before the payment resolved.
        execution_mode: 'immediate',
        response_timeout_secs: 30,
        api_schema: {
          url: `${N8N_BASE}/webhook/${def.name}`,
          method: 'POST',
          request_body_schema: {
            type: 'object',
            description: `LOOP ${def.name}`,
            required: def.required,
            properties: def.properties,
          },
        },
        response_body_schema: RESPONSE_SCHEMA,
      },
    };

    let id;
    if (byName[def.name]) {
      id = byName[def.name];
      process.stdout.write(`    PATCH  ${def.name.padEnd(22)} ... `);
      await el('PATCH', `/v1/convai/tools/${id}`, body);
    } else {
      process.stdout.write(`    CREATE ${def.name.padEnd(22)} ... `);
      id = (await el('POST', '/v1/convai/tools', body)).id;
    }
    loopToolIds.push(id);
    console.log(`✅ ${id}`);
  }

  // 3. Point send_money at the CURRENT domain. It was still on
  //    ongeapesa.nsait.co.ke, which resolves but serves the OLD deployment —
  //    so every ElevenLabs payment was hitting stale code.
  console.log('\n[3] Repointing send_money at the current domain...');
  try {
    const sm = await el('GET', `/v1/convai/tools/${SEND_MONEY_ID}`);
    const cfg = sm.tool_config ?? {};
    const oldUrl = cfg.api_schema?.url;
    const newUrl = `${APP_URL}/api/voice/webhook`;
    if (oldUrl === newUrl) {
      console.log(`    already correct: ${newUrl}`);
    } else {
      await el('PATCH', `/v1/convai/tools/${SEND_MONEY_ID}`, {
        tool_config: { ...cfg, api_schema: { ...cfg.api_schema, url: newUrl } },
      });
      console.log(`    ${oldUrl}\n    -> ${newUrl}  ✅`);
    }
  } catch (err) {
    console.log(`    ⚠️  could not update send_money: ${err.message}`);
  }

  // 4. Clone V2's conversation_config verbatim.
  console.log('\n[4] Cloning ONGEA PESA V2 config...');
  const v2 = await el('GET', `/v1/convai/agents/${V2_AGENT_ID}`);
  const cc = structuredClone(v2.conversation_config ?? {});
  const v2ToolIds = cc.agent?.prompt?.tool_ids ?? [];
  console.log(`    llm=${cc.agent?.prompt?.llm}  tts=${cc.tts?.model_id}  tools=${v2ToolIds.length}`);

  cc.agent = cc.agent ?? {};
  cc.agent.prompt = cc.agent.prompt ?? {};
  cc.agent.prompt.prompt = (cc.agent.prompt.prompt ?? '') + LOOP_PROMPT_SECTION;
  // V2's tools (6 client + send_money) plus the LOOP rails.
  cc.agent.prompt.tool_ids = Array.from(new Set([...v2ToolIds, ...loopToolIds]));

  // V2's config also carries a legacy inline `tools` array alongside tool_ids.
  // Sending both is rejected: "Cannot specify both tools and tool IDs". tool_ids
  // is the current form and the one we are extending, so drop the inline copy.
  if (cc.agent.prompt.tools) {
    console.log(`    dropping ${cc.agent.prompt.tools.length} legacy inline tool(s) — tool_ids wins`);
    delete cc.agent.prompt.tools;
  }

  // 5. Create or update the duplicate agent.
  console.log(`\n[5] Creating / updating "${NEW_AGENT_NAME}"...`);
  const agents = (await el('GET', '/v1/convai/agents?page_size=100')).agents ?? [];
  const existing = agents.find(a => a.name === NEW_AGENT_NAME);

  let agentId;
  if (existing) {
    agentId = existing.agent_id;
    await el('PATCH', `/v1/convai/agents/${agentId}`, { conversation_config: cc });
    console.log(`    PATCHED ${agentId}`);
  } else {
    const created = await el('POST', '/v1/convai/agents/create', {
      name: NEW_AGENT_NAME,
      conversation_config: cc,
    });
    agentId = created.agent_id;
    console.log(`    CREATED ${agentId}`);
  }

  // 6. Verify what actually landed, rather than trusting the writes.
  console.log('\n[6] Verifying...');
  const check = await el('GET', `/v1/convai/agents/${agentId}`);
  const p = check.conversation_config?.agent?.prompt ?? {};
  console.log(`    tools attached : ${(p.tool_ids ?? []).length}`);
  console.log(`    llm            : ${p.llm}`);
  console.log(`    tts model      : ${check.conversation_config?.tts?.model_id}`);
  console.log(`    prompt chars   : ${(p.prompt ?? '').length}`);

  console.log('\n' + '='.repeat(56));
  console.log('✅ Done.\n');
  console.log('Set this in Vercel, then REDEPLOY (NEXT_PUBLIC_* is baked in at build):');
  console.log(`\n    NEXT_PUBLIC_AGENT_ID=${agentId}\n`);
  console.log('Rollback: set it back to ONGEA PESA V2');
  console.log(`    NEXT_PUBLIC_AGENT_ID=${V2_AGENT_ID}`);
  console.log('\n⚠️  LOOP tools post straight to n8n, so LOOP payments carry NO');
  console.log('    platform fee and NO step-up confirmation. Sandbox only.');
}

main().catch(err => {
  console.error('\n❌', err.message);
  process.exit(1);
});
