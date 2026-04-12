'use client'

/**
 * BackgroundEffects — ambient glow blobs + grid pattern overlay.
 * Place once at app root level for subtle background atmosphere.
 * Very lightweight — uses only CSS, no JS computation.
 */
export default function BackgroundEffects() {
  return (
    <>
      {/* Ambient glow blobs */}
      <div className="ambient-glow ambient-glow-1" aria-hidden="true" />
      <div className="ambient-glow ambient-glow-2" aria-hidden="true" />
      <div className="ambient-glow ambient-glow-3" aria-hidden="true" />

      {/* Subtle grid pattern */}
      <div className="grid-pattern" aria-hidden="true" />
    </>
  )
}
