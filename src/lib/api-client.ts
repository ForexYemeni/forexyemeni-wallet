import { useAuthStore } from '@/lib/store'

/**
 * Authenticated fetch wrapper.
 * Automatically attaches the current user's auth token to every API request.
 *
 * Token priority:
 *  1. Explicit token passed in options (rare, for special cases)
 *  2. Zustand store token (standard client-side usage)
 *
 * Usage:
 *   // Replace:  fetch('/api/admin/stats')
 *   // With:     apiFetch('/api/admin/stats')
 *
 *   // With body:
 *   apiFetch('/api/admin/deposits', {
 *     method: 'POST',
 *     body: JSON.stringify({ depositId: 'xxx', status: 'confirmed' }),
 *   })
 */
export function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { token?: string },
): Promise<Response> {
  // Get token from explicit param > Zustand store
  const explicitToken = (init as any)?.token
  const storeToken = useAuthStore.getState()?.token
  const token = explicitToken || storeToken

  const headers = new Headers(init?.headers)

  // Add auth header if we have a token
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  // Set Content-Type for JSON bodies if not already set
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  // Remove token from init to avoid passing it to native fetch
  const { token: _t, ...restInit } = (init || {}) as any

  return fetch(input, { ...restInit, headers } as RequestInit)
}
