import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * Which voice engine this user gets. Read-only.
 *
 * LiveKit is the DEFAULT. Only an explicit profiles.voice_engine of
 * 'elevenlabs' moves an account onto the dormant fallback — which is the
 * inverse of the original opt-in gate, because LiveKit is now the primary
 * runtime rather than the experiment.
 *
 * The client needs this to mount the right provider but must not be able to
 * change it: voice_engine is admin-settable only, enforced by
 * /api/admin/voice-engine and the guard_voice_engine_update DB trigger. This
 * route deliberately has no PATCH.
 *
 * Any failure returns 'livekit' rather than erroring — a lookup problem should
 * not silently demote a user to the fallback engine.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ engine: 'livekit' })

    const admin = createServiceClient()
    const { data } = await admin
      .from('profiles')
      .select('voice_engine')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      engine: data?.voice_engine === 'elevenlabs' ? 'elevenlabs' : 'livekit',
    })
  } catch (err) {
    console.error('voice/engine lookup failed:', err)
    return NextResponse.json({ engine: 'livekit' })
  }
}
