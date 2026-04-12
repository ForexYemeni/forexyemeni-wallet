// Firebase service account key — loaded from FIREBASE_SERVICE_ACCOUNT env var
// SECURITY: This file no longer contains any hardcoded keys
// Set FIREBASE_SERVICE_ACCOUNT in your hosting platform (Vercel, etc.)

const envKey = process.env.FIREBASE_SERVICE_ACCOUNT || ''

function resolveKey(): string {
  if (!envKey) return ''
  // Check if it's base64-encoded
  try {
    const decoded = Buffer.from(envKey, 'base64').toString()
    const parsed = JSON.parse(decoded)
    if (parsed.type === 'service_account' && parsed.private_key) return envKey
  } catch {}
  // Check if it's raw JSON
  try {
    const parsed = JSON.parse(envKey)
    if (parsed.type === 'service_account' && parsed.private_key) {
      return Buffer.from(envKey).toString('base64')
    }
  } catch {}
  return ''
}

export const _fbk = resolveKey()

if (!_fbk) {
  console.error(
    '[FIREBASE] FIREBASE_SERVICE_ACCOUNT environment variable is not set. ' +
    'The application cannot connect to Firebase.'
  )
}
