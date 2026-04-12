'use client'

import { useRef, useEffect, useCallback } from 'react'

interface PinDotsProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  error?: boolean
  disabled?: boolean
}

export default function PinDots({
  length = 4,
  value,
  onChange,
  onComplete,
  error = false,
  disabled = false,
}: PinDotsProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus the hidden input
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus()
    }
  }, [disabled])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, length)
      onChange(digits)
      if (digits.length === length && onComplete) {
        onComplete(digits)
      }
    },
    [length, onChange, onComplete]
  )

  const handleFocus = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Hidden input to capture keyboard */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="sr-only"
        autoComplete="off"
        aria-label="رمز PIN"
      />

      {/* Visible dots */}
      <div
        className={`flex items-center gap-3 ${error ? 'animate-shake-error' : ''}`}
        onClick={handleFocus}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleFocus()
        }}
      >
        {Array.from({ length }, (_, i) => (
          <div
            key={i}
            className={`pin-dot ${i < value.length ? 'filled' : ''} ${
              error ? '!border-red-500/50' : ''
            }`}
          />
        ))}
      </div>
    </div>
  )
}
