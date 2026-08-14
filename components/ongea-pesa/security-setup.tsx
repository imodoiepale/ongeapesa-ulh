"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronRight, Fingerprint, Grid3X3, Loader2, Mic2, Pause, Play, ShieldCheck } from "lucide-react"
import { enrollPasskey, getPinStatus, setPin } from "@/lib/security-client"
import { useAuth } from "@/components/providers/auth-provider"
import { FluidNav, ScreenShell, SubScreenHeader, mobileNavItems } from "@/components/foundation"
import { OnboardingProgress } from "./onboarding-progress"

/**
 * The same controls serve two entry points:
 *   "onboarding" — step 3 of 4, finishes into /first-send (the original flow)
 *   "settings"   — reached from Settings, wears the Settings chrome and returns there
 * Only the chrome and the exit differ; every handler below is shared.
 */
type SecuritySetupVariant = "onboarding" | "settings"

export function SecuritySetupScreen({ variant = "onboarding" }: { variant?: SecuritySetupVariant }) {
  const router = useRouter()
  const inSettings = variant === "settings"
  const { user } = useAuth()
  const [pin, setPinValue] = useState("")
  const [confirm, setConfirm] = useState("")
  const [currentPin, setCurrentPin] = useState("")
  const [showPinForm, setShowPinForm] = useState(false)
  const [pinDone, setPinDone] = useState(false)
  const [passkeyDone, setPasskeyDone] = useState(false)
  const [deviceBiometricsConsent, setDeviceBiometricsConsent] = useState(false)
  const [voiceEnrolled, setVoiceEnrolled] = useState(false)
  const [voicePlaybackUrl, setVoicePlaybackUrl] = useState<string | null>(null)
  const [playingVoice, setPlayingVoice] = useState(false)
  const [busy, setBusy] = useState<"pin" | "passkey" | "finish" | null>(null)
  const [error, setError] = useState("")
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null)

  // An account can already have a PIN (re-running onboarding, or set during an
  // earlier session). Changing it requires the current PIN, so we have to know
  // up front — otherwise the save fails with "Current PIN is incorrect".
  const [hasExistingPin, setHasExistingPin] = useState(false)

  useEffect(() => {
    let active = true
    getPinStatus()
      .then(({ hasPin }) => {
        if (!active) return
        setHasExistingPin(hasPin)
        // A PIN already on file satisfies the setup requirement — don't force a change.
        if (hasPin) setPinDone(true)
      })
      .catch(() => {
        /* Non-fatal: fall back to the first-time-setup form. */
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    fetch("/api/security/voice-biometric")
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!active || !response.ok) return
        setVoiceEnrolled(Boolean(payload.enrolled))
        setVoicePlaybackUrl(typeof payload.playbackUrl === "string" ? payload.playbackUrl : null)
      })
      .catch(() => {
        /* Playback is helpful but not required to finish security setup. */
      })
    return () => {
      active = false
      voiceAudioRef.current?.pause()
    }
  }, [])

  const savePin = async () => {
    if (!/^\d{6}$/.test(pin)) {
      setError("Use a 6-digit wallet PIN.")
      return
    }
    if (pin !== confirm) {
      setError("The PINs do not match.")
      return
    }
    if (hasExistingPin && !/^\d{4,6}$/.test(currentPin)) {
      setError("Enter your current PIN to change it.")
      return
    }
    setBusy("pin")
    setError("")
    try {
      await setPin(pin, hasExistingPin ? currentPin : undefined)
      setPinDone(true)
      setShowPinForm(false)
      setPinValue("")
      setConfirm("")
      setCurrentPin("")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn't save your PIN.")
    } finally {
      setBusy(null)
    }
  }

  const addPasskey = async () => {
    if (!deviceBiometricsConsent) {
      setError("Allow device face or fingerprint verification before adding a passkey.")
      return
    }
    setBusy("passkey")
    setError("")
    try {
      await enrollPasskey()
      setPasskeyDone(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Passkey enrollment was cancelled.")
    } finally {
      setBusy(null)
    }
  }

  const playVoiceSample = async () => {
    if (!voicePlaybackUrl) {
      setError("Your voice sample is enrolled, but playback is temporarily unavailable.")
      return
    }
    setError("")
    if (!voiceAudioRef.current) {
      voiceAudioRef.current = new Audio(voicePlaybackUrl)
      voiceAudioRef.current.onended = () => setPlayingVoice(false)
      voiceAudioRef.current.onerror = () => {
        setPlayingVoice(false)
        setError("We couldn't play your voice sample. Please retry.")
      }
    }
    if (playingVoice) {
      voiceAudioRef.current.pause()
      setPlayingVoice(false)
      return
    }
    try {
      await voiceAudioRef.current.play()
      setPlayingVoice(true)
    } catch {
      setPlayingVoice(false)
      setError("Your browser blocked playback. Tap the voice sample again.")
    }
  }

  const finish = async () => {
    if (!pinDone || !user?.id) {
      setError("Set your wallet PIN before finishing setup.")
      setShowPinForm(true)
      return
    }
    setBusy("finish")
    setError("")
    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Re-entering from Settings must not replay the onboarding stage write —
        // the account is already past it, and only the consent flag can change.
        ...(inSettings ? {} : { stage: "onboarding-complete" }),
        device_biometrics_consent: deviceBiometricsConsent,
      }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(typeof payload.error === "string" ? payload.error : "We couldn't save your changes. Please try again.")
      setBusy(null)
      return
    }
    // onboarding_completed_at is already stamped above, so the user can never be
    // trapped if they abandon the optional first-send step that follows.
    router.replace(inSettings ? "/settings" : "/first-send")
    router.refresh()
  }

  const pinForm = (
    <div className="onboarding-pin-form">
      {hasExistingPin && (
        <input className="onboarding-pin-form__full" value={currentPin} onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" autoComplete="current-password" aria-label="Current wallet PIN" placeholder="Current PIN" />
      )}
      <input value={pin} onChange={(event) => setPinValue(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" autoComplete="new-password" aria-label="New wallet PIN" placeholder={hasExistingPin ? "New 6-digit PIN" : "6-digit PIN"} />
      <input value={confirm} onChange={(event) => setConfirm(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" type="password" autoComplete="new-password" aria-label="Confirm wallet PIN" placeholder="Confirm PIN" />
      <button onClick={savePin} disabled={busy !== null} className="onboarding-primary">
        {busy === "pin" ? <Loader2 className="animate-spin" /> : hasExistingPin ? "Change wallet PIN" : "Set wallet PIN"}
      </button>
      {hasExistingPin && (
        <p className="onboarding-hint">Forgot your current PIN? Reset it from Settings after signing in again.</p>
      )}
    </div>
  )

  // ── Settings entry point ───────────────────────────────────────────────────
  if (inSettings) {
    const rowClass = "flex min-h-[4.5rem] w-full items-center gap-4 rounded-2xl px-3 text-left transition-colors hover:bg-black/[.04] disabled:opacity-60 disabled:hover:bg-transparent dark:hover:bg-white/[.04]"
    const tileClass = "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--teal))]/10 text-[hsl(var(--teal))] dark:bg-[hsl(var(--mint))]/10 dark:text-[hsl(var(--mint))]"

    return (
      <main id="main-content" className="orbital-page min-h-[100dvh] pb-nav">
        <ScreenShell className="pt-safe">
          <SubScreenHeader
            eyebrow="Account & trust"
            title="Security center"
            subtitle="Choose how you want to secure your account and approve payments."
          />

          <div className="mt-8">
            <p className="orbital-label mb-3 opacity-50">Ways to verify</p>
            <div className="orbital-panel divide-y divide-black/[.07] p-2 dark:divide-white/[.07]">
              <button onClick={playVoiceSample} disabled={!voiceEnrolled} className={rowClass}>
                <span className={tileClass}><Mic2 className="h-5 w-5" strokeWidth={1.6} /></span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm font-medium">Voice biometrics</strong>
                  <small className="mt-1 block text-xs opacity-50">{voiceEnrolled ? "Enrolled · tap to play your short sample" : "Complete voice enrollment to use this"}</small>
                </span>
                {playingVoice ? <Pause className="h-4 w-4 shrink-0 opacity-60" /> : voiceEnrolled ? <Check className="h-4 w-4 shrink-0 text-[hsl(var(--teal))] dark:text-[hsl(var(--mint))]" /> : <Play className="h-4 w-4 shrink-0 opacity-35" />}
              </button>

              <button onClick={addPasskey} disabled={busy !== null || passkeyDone} className={rowClass}>
                <span className={tileClass}><Fingerprint className="h-5 w-5" strokeWidth={1.6} /></span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm font-medium">Passkey</strong>
                  <small className="mt-1 block text-xs opacity-50">Use device face, fingerprint, or screen lock to sign in</small>
                </span>
                {busy === "passkey" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : passkeyDone ? <Check className="h-4 w-4 shrink-0 text-[hsl(var(--teal))] dark:text-[hsl(var(--mint))]" /> : <ChevronRight className="h-4 w-4 shrink-0 opacity-35" />}
              </button>

              <div>
                <button onClick={() => setShowPinForm((value) => !value)} disabled={busy !== null} className={rowClass} aria-expanded={showPinForm}>
                  <span className={tileClass}><Grid3X3 className="h-5 w-5" strokeWidth={1.6} /></span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-medium">Wallet PIN</strong>
                    <small className="mt-1 block text-xs opacity-50">{hasExistingPin ? "Your PIN is set. Tap to change it" : "Use a 6-digit PIN to approve transactions"}</small>
                  </span>
                  {pinDone ? <Check className="h-4 w-4 shrink-0 text-[hsl(var(--teal))] dark:text-[hsl(var(--mint))]" /> : <ChevronRight className="h-4 w-4 shrink-0 opacity-35" />}
                </button>
                {showPinForm && <div className="px-3 pb-3">{pinForm}</div>}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <p className="orbital-label mb-3 opacity-50">Device</p>
            <label className="orbital-panel flex cursor-pointer items-start gap-4 p-5">
              <input
                type="checkbox"
                checked={deviceBiometricsConsent}
                onChange={(event) => setDeviceBiometricsConsent(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[hsl(var(--teal))] dark:accent-[hsl(var(--mint))]"
              />
              <span className="min-w-0">
                <strong className="block text-sm font-medium">Allow face or fingerprint verification</strong>
                <small className="mt-1 block text-xs opacity-50">Your phone performs the match. Ongea stores only the passkey public key.</small>
              </span>
            </label>
          </div>

          <p className="mt-6 flex items-center gap-2 text-xs opacity-55">
            <ShieldCheck className="h-4 w-4 text-[hsl(var(--teal))] dark:text-[hsl(var(--mint))]" />
            Face and fingerprint data stay on this device
          </p>
          {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/[.06] p-3 text-xs text-red-600 dark:text-red-400">{error}</p>}

          <button onClick={finish} disabled={busy !== null} className="orbital-button mt-8 w-full">
            {busy === "finish" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & return to settings"}
          </button>
        </ScreenShell>
        <FluidNav items={mobileNavItems} />
      </main>
    )
  }

  // ── Onboarding entry point ─────────────────────────────────────────────────
  return (
    <main id="main-content" className="onboarding-page onboarding-page--light onboarding-security">
      <section className="onboarding-frame">
        <OnboardingProgress step={3} total={4} />

        <div className="onboarding-security__intro">
          <h1 className="orbital-display">Protect your money</h1>
          <p>Choose how you want to<br />secure your account</p>
        </div>

        <div className="onboarding-security__visual">
          <Image
            src="/brand/orbital/security-shield-light.webp"
            alt="Protective digital shield"
            fill
            sizes="260px"
            className="object-contain"
            priority
          />
        </div>

        <div className="onboarding-security__choices">
          <button
            onClick={playVoiceSample}
            disabled={!voiceEnrolled}
            className="onboarding-choice"
          >
            <Mic2 />
            <span>
              <strong>Voice biometrics</strong>
              <small>{voiceEnrolled ? "Enrolled · tap to play your short sample" : "Complete voice enrollment in step 2"}</small>
            </span>
            {playingVoice ? <Pause /> : voiceEnrolled ? <Check /> : <Play />}
          </button>

          <label className="onboarding-device-consent">
            <input
              type="checkbox"
              checked={deviceBiometricsConsent}
              onChange={(event) => setDeviceBiometricsConsent(event.target.checked)}
            />
            <span>
              <strong>Allow face or fingerprint verification</strong>
              <small>Your phone performs the match. Ongea stores only the passkey public key.</small>
            </span>
          </label>

          <button onClick={addPasskey} disabled={busy !== null || passkeyDone} className="onboarding-choice">
            <Fingerprint />
            <span><strong>Passkey</strong><small>Use device face, fingerprint,<br />or screen lock to sign in</small></span>
            {busy === "passkey" ? <Loader2 className="animate-spin" /> : passkeyDone ? <Check /> : <ChevronRight />}
          </button>

          <button
            onClick={() => setShowPinForm((value) => !value)}
            disabled={busy !== null}
            className="onboarding-choice"
            aria-expanded={showPinForm}
          >
            <Grid3X3 />
            <span>
              <strong>Wallet PIN</strong>
              <small>
                {hasExistingPin
                  ? <>Your PIN is set. Tap to<br />change it</>
                  : <>Use a 6-digit PIN to approve<br />transactions</>}
              </small>
            </span>
            {pinDone ? <Check /> : <ChevronRight />}
          </button>

          {showPinForm && pinForm}
        </div>

        <p className="onboarding-security__privacy"><ShieldCheck />Face and fingerprint data stay on this device</p>
        {error && <p role="alert" className="onboarding-error">{error}</p>}
        <button onClick={finish} disabled={busy !== null} className="onboarding-primary onboarding-security__finish">
          {busy === "finish" ? <Loader2 className="animate-spin" /> : "Finish setup"}
        </button>
      </section>
    </main>
  )
}
