'use client'

import { useRef, useEffect, useCallback, useState } from 'react'

interface PinDotsProps {
  length?: number
  value?: string
  onChange?: (value: string) => void
  onComplete?: (value: string) => void
  error?: boolean
  disabled?: boolean
  compact?: boolean
}

export default function PinDots({
  length = 6,
  value: externalValue,
  onChange: externalOnChange,
  onComplete,
  error = false,
  disabled = false,
  compact = false,
}: PinDotsProps) {
  const [internalValue, setInternalValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const isControlled = externalValue !== undefined
  const value = isControlled ? externalValue : internalValue

  // Auto-focus the hidden input
  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus()
    }
  }, [disabled])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, length)
      if (isControlled && externalOnChange) {
        externalOnChange(digits)
      } else {
        setInternalValue(digits)
      }
      if (digits.length === length && onComplete) {
        onComplete(digits)
      }
    },
    [length, onComplete, isControlled, externalOnChange]
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
        className={`flex items-center ${compact ? 'gap-2' : 'gap-3'} ${error ? 'animate-shake-error' : ''}}
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
            className={`pin-dot ${compact ? 'pin-dot-compact' : ''} ${i < value.length ? 'filled' : ''} ${
              error ? '!border-red-500/50' : ''
            }`}
          />
        ))}
      </div>
    </div>
  )
}
