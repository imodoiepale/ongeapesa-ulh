import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * Which voice engine this user gets. Read-only.
 *
 * ElevenLabs is the DEFAULT. Only an explicit profiles.voice_engine of
 * 'livekit' moves an account onto the self-hosted stack.
 *
 * ElevenLabs wins on latency and it is not close: gemini-2.5-flash +
 * eleven_flash_v2 (~75ms to first byte) + scribe_realtime on their edge, versus
 * gpt-4o-mini + tts-1 + Deepgram from one VPS. The self-hosted worker stays as
 * the fallback — it works, and it is the escape hatch if ElevenLabs is down.
 *
 * The client needs this to mount the right provider but must not be able to
 * change it: voice_engine is admin-settable only, enforced by
 * /api/admin/voice-engine and the guard_voice_engine_update DB trigger. This
 * route deliberately has no PATCH.
 *
 * Any failure returns 'elevenlabs' rather than erroring — a lookup problem
 * should not drop a user onto the slower engine.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ engine: 'elevenlabs' })

    const admin = createServiceClient()
    const { data } = await admin
      .from('profiles')
      .select('voice_engine')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      engine: data?.voice_engine === 'livekit' ? 'livekit' : 'elevenlabs',
    })
  } catch (err) {
    console.error('voice/engine lookup failed:', err)
    return NextResponse.json({ engine: 'elevenlabs' })
  }
}
