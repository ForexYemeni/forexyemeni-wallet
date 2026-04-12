// Firebase service account key — loaded from FIREBASE_SERVICE_ACCOUNT env var
// Supports both base64-encoded keys and raw JSON strings

const envKey = process.env.FIREBASE_SERVICE_ACCOUNT || ''

function resolveKey(): string {
  if (!envKey) return ''
  
  // Check if it's raw JSON (starts with { or [)
  const trimmed = envKey.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed.type === 'service_account' && parsed.private_key) {
        return trimmed
      }
    } catch {}
    return ''
  }
  
  // Check if it's base64-encoded
  try {
    const decoded = Buffer.from(envKey, 'base64').toString()
    const parsed = JSON.parse(decoded)
    if (parsed.type === 'service_account' && parsed.private_key) return envKey
  } catch {}
  
  return ''
}

export const _fbk = resolveKey()

if (!_fbk) {
  console.error(
    '[FIREBASE] FIREBASE_SERVICE_ACCOUNT environment variable is not set or invalid. ' +
    'The application cannot connect to Firebase.'
  )
}
