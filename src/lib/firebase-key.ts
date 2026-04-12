// Firebase service account key — loaded from environment variable
// Falls back to embedded key ONLY if env var is not set (for local dev)
// SECURITY: In production, the env var MUST be set

const envKey = process.env.FIREBASE_SERVICE_ACCOUNT || ''

function getKeyFromEnv(): string {
  if (envKey) {
    // Check if it's already base64-encoded (legacy format)
    try {
      const decoded = Buffer.from(envKey, 'base64').toString()
      const parsed = JSON.parse(decoded)
      if (parsed.type === 'service_account' && parsed.private_key) {
        return envKey // It's a valid base64-encoded key
      }
    } catch {
      // Not base64, might be raw JSON
    }

    // Check if it's raw JSON
    try {
      const parsed = JSON.parse(envKey)
      if (parsed.type === 'service_account' && parsed.private_key) {
        return Buffer.from(envKey).toString('base64')
      }
    } catch {
      // Invalid format
    }
  }

  return ''
}

const _resolvedKey = getKeyFromEnv()

// Legacy fallback — only used in development when env var is not set
const _legacyFallback = ""

export const _fbk = _resolvedKey || _legacyFallback

// Check at startup if the key is properly configured
if (!_fbk) {
  console.warn(
    '[SECURITY WARNING] FIREBASE_SERVICE_ACCOUNT environment variable is not set. ' +
    'The application will NOT be able to connect to Firebase. ' +
    'Please set this variable in your .env.local or hosting platform settings.'
  )
}
