'use client'

/**
 * BackgroundEffects — ambient glow blobs + subtle grid pattern overlay.
 * Rendered at app root level for subtle background atmosphere.
 * Uses radial-gradient (no filter:blur) to avoid stacking context issues.
 * z-index: 0 ensures effects stay behind content (which paints on top via DOM order).
 */
export default function BackgroundEffects() {
  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      {/* Ambient glow blobs */}
      <div className="ambient-glow ambient-glow-1" />
      <div className="ambient-glow ambient-glow-2" />
      <div className="ambient-glow ambient-glow-3" />

      {/* Subtle grid pattern */}
      <div className="grid-pattern" />
    </div>
  )
}
