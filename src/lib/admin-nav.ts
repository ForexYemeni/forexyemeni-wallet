/**
 * Admin navigation bridge.
 * Uses window.location.hash for reliable cross-chunk communication.
 * Next.js dynamic imports can create separate module instances,
 * but window.location.hash is always shared.
 */

/**
 * Called by Sidebar / BottomNav when user clicks an admin sub-item.
 * Sets the hash and navigates to admin screen.
 */
export function navigateToAdminTab(tab: string) {
  // Set hash BEFORE changing screen so AdminPanel can read it on mount
  window.location.hash = `admin-${tab}`
  console.log('[admin-nav] navigateToAdminTab:', tab, '| hash:', window.location.hash)
}

/**
 * Called by AdminPanel on mount to read and clear the pending tab.
 * Returns the tab name or null.
 */
export function consumePendingAdminTab(): string | null {
  const hash = window.location.hash
  if (hash.startsWith('#admin-')) {
    const tab = hash.replace('#admin-', '')
    // Clear hash after reading
    history.replaceState(null, '', window.location.pathname + window.location.search)
    console.log('[admin-nav] consumePendingAdminTab:', tab)
    return tab
  }
  return null
}
