'use client'

/**
 * Pre-built skeleton layouts for common page patterns.
 * Use these while data is loading to show structure preview.
 */

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Balance card skeleton */}
      <div className="skeleton-block h-36 w-full" />
      {/* Quick action buttons */}
      <div className="flex gap-4">
        <div className="skeleton-block h-20 flex-1" />
        <div className="skeleton-block h-20 flex-1" />
        <div className="skeleton-block h-20 flex-1" />
      </div>
      {/* Transactions */}
      <div className="space-y-3">
        <div className="skeleton-line w-32 h-5" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-4 flex items-center gap-4">
            <div className="skeleton-circle w-10 h-10 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton-line w-3/4" />
              <div className="skeleton-line w-1/2 h-3" />
            </div>
            <div className="skeleton-line w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function TransactionsSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="skeleton-line w-40 h-6" />
      <div className="flex gap-2">
        <div className="skeleton-block h-9 w-20" />
        <div className="skeleton-block h-9 w-20" />
        <div className="skeleton-block h-9 w-20" />
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="glass-card p-4 flex items-center gap-4">
          <div className="skeleton-circle w-11 h-11 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton-line w-2/3" />
            <div className="skeleton-line w-1/3 h-3" />
          </div>
          <div className="text-left space-y-2">
            <div className="skeleton-line w-16 ml-auto" />
            <div className="skeleton-line w-24 ml-auto h-3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="skeleton-line w-32 h-6" />
      <div className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="skeleton-circle w-14 h-14 shrink-0" />
          <div className="space-y-2">
            <div className="skeleton-line w-40" />
            <div className="skeleton-line w-28 h-3" />
          </div>
        </div>
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="glass-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="skeleton-circle w-9 h-9 shrink-0" />
            <div className="skeleton-line w-32" />
          </div>
          <div className="skeleton-line w-20" />
        </div>
      ))}
    </div>
  )
}

export function NotificationsSkeleton() {
  return (
    <div className="space-y-3 animate-fade-in">
      <div className="skeleton-line w-36 h-6" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="glass-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="skeleton-circle w-8 h-8 shrink-0" />
            <div className="skeleton-line w-2/3" />
          </div>
          <div className="skeleton-line w-full h-3" />
          <div className="skeleton-line w-1/4 h-3" />
        </div>
      ))}
    </div>
  )
}
