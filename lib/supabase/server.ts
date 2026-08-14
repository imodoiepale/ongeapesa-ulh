import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Service role client - bypasses RLS for admin operations
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Name the missing variable. Previously these were `!` assertions, so an empty
  // value reached supabase-js and surfaced as a bare "supabaseKey is required"
  // — an uncaught throw, which Next.js returns as a 500 with an EMPTY body. No
  // message, no variable name, nothing in the response to act on.
  //
  // Vercel marks these vars "sensitive", meaning their values cannot be read
  // back from the dashboard or the API, so a blank one is invisible until
  // something breaks. Saying which is missing is the only cheap way to tell.
  const missing = [
    !url?.trim() && 'NEXT_PUBLIC_SUPABASE_URL',
    !key?.trim() && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean)

  if (missing.length) {
    throw new Error(
      `Supabase service client is not configured — missing: ${missing.join(', ')}. ` +
      `Set it in the Vercel project environment and REDEPLOY (env changes do not ` +
      `reach a running deployment on their own).`,
    )
  }

  return createSupabaseClient(url!, key!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
