'use client'

import { Check } from 'lucide-react'

interface StepProgressProps {
  steps: { key: string; label: string }[]
  currentStep: string
  className?: string
}

export default function StepProgress({ steps, currentStep, className = '' }: StepProgressProps) {
  const currentIndex = steps.findIndex(s => s.key === currentStep)

  return (
    <div className={`step-progress-bar ${className}`}>
      {steps.map((step, idx) => {
        const isActive = step.key === currentStep
        const isCompleted = idx < currentIndex
        const isUpcoming = idx > currentIndex
        const state = isActive ? 'active' : isCompleted ? 'completed' : 'upcoming'

        // Determine connector state
        let connectorState = ''
        if (idx < steps.length - 1) {
          const nextIsCompleted = idx + 1 < currentIndex
          const nextIsActive = idx + 1 === currentIndex
          if (isCompleted && nextIsCompleted) {
            connectorState = 'filled'
          } else if (isCompleted && nextIsActive) {
            connectorState = 'current'
          }
        }

        return (
          <div key={step.key} className="step-progress-item">
            <div className={`step-progress-circle ${state}`}>
              {isCompleted ? (
                <Check className="w-4 h-4" />
              ) : (
                <span>{idx + 1}</span>
              )}
            </div>
            <span className={`step-progress-label ${state}`}>
              {step.label}
            </span>

            {/* Connector between steps */}
            {idx < steps.length - 1 && (
              <div className={`step-progress-connector ${connectorState}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
