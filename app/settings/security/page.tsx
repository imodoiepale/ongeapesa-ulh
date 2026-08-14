// app/settings/security/page.tsx
//
// Same controls as the onboarding step at /security-setup, but wearing the
// Settings chrome (back link, no step counter) and returning to /settings
// instead of pushing on into the onboarding flow.

import { SecuritySetupScreen } from '@/components/ongea-pesa/security-setup';

export default function SettingsSecurityPage() {
  return <SecuritySetupScreen variant="settings" />;
}
