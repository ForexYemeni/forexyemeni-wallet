/**
 * Direct admin navigation bridge.
 * Works regardless of mount timing — uses a module-level handler
 * so Sidebar/BottomNav can call AdminPanel's tab setter directly.
 */

type TabHandler = ((tab: string) => void) | null
let _handler: TabHandler = null
let _pendingTab: string | null = null

/** Called by AdminPanel on mount */
export function registerAdminTabHandler(handler: (tab: string) => void) {
  _handler = handler
  // If a navigation was queued before mount, execute it now
  if (_pendingTab) {
    handler(_pendingTab)
    _pendingTab = null
  }
}

/** Called by AdminPanel on unmount */
export function unregisterAdminTabHandler() {
  _handler = null
}

/**
 * Called by Sidebar / BottomNav when user clicks an admin sub-item.
 * If AdminPanel is already mounted → calls handler directly (instant).
 * If not yet mounted → queues the tab and fires when AdminPanel registers.
 */
export function navigateToAdminTab(tab: string) {
  if (_handler) {
    _handler(tab)
  } else {
    _pendingTab = tab
  }
}
