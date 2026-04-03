/**
 * Device Fingerprint Generator
 * Generates a unique fingerprint based on browser characteristics.
 * This fingerprint is stored server-side and checked on every login.
 */

export async function generateDeviceFingerprint(): Promise<string> {
  const components: string[] = []

  // 1. User Agent
  components.push(navigator.userAgent)

  // 2. Screen resolution
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`)

  // 3. Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone)

  // 4. Language
  components.push(navigator.language)

  // 5. Platform
  components.push(navigator.platform || '')

  // 6. Hardware concurrency
  components.push(`${navigator.hardwareConcurrency || 0}`)

  // 7. Device memory
  components.push(`${(navigator as any).deviceMemory || 0}`)

  // 8. Canvas fingerprint
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 50
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#f60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText('ForexYemeni-FP-Device-Check', 2, 15)
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
      ctx.fillText('ForexYemeni-FP-Device-Check', 4, 17)
      components.push(canvas.toDataURL())
    }
  } catch {
    // Canvas not available
  }

  // 9. WebGL renderer info
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
        const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        components.push(`${vendor || ''}|${renderer || ''}`)
      }
    }
  } catch {
    // WebGL not available
  }

  // 10. Touch support
  components.push(`touch:${typeof ontouchstart !== 'undefined' ? '1' : '0'}`)

  // 11. Max touch points
  components.push(`maxTouch:${navigator.maxTouchPoints || 0}`)

  // Hash the components
  const raw = components.join('|||')
  const hash = await hashString(raw)
  return hash
}

async function hashString(str: string): Promise<string> {
  // Use SubtleCrypto for SHA-256 hash
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    // Fallback: simple hash
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }
}

export function getDeviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) {
    if (/Samsung/.test(ua)) return 'Samsung Android'
    if (/Huawei/.test(ua)) return 'Huawei Android'
    return 'Android'
  }
  if (/Windows/.test(ua)) return 'Windows PC'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Linux/.test(ua)) return 'Linux'
  return 'جهاز غير معروف'
}
