'use client'

import { type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  iconColor?: string
}

/**
 * Reusable empty state component with animated icon,
 * clear messaging, and optional CTA button.
 */
export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction, iconColor = 'text-muted-foreground/30' }: EmptyStateProps) {
  return (
    <div className="empty-state-container">
      <div className={`empty-state-icon mb-6 ${iconColor}`}>
        <div className="w-20 h-20 mx-auto rounded-2xl glass-card flex items-center justify-center">
          <Icon className="w-10 h-10" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-foreground/80 mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="gold-gradient text-gray-900 font-bold rounded-xl px-8 h-11 hover:opacity-90 transition-opacity tap-effect">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
