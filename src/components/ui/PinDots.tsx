'use client'

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react'

interface PinDotsProps {
  length?: number
  value?: string
  onChange?: (value: string) => void
  onComplete?: (value: string) => void
  error?: boolean
  disabled?: boolean
  compact?: boolean
}

export interface PinDotsHandle {
  focus: () => void
  clear: () => void
}

const PinDots = forwardRef<PinDotsHandle, PinDotsProps>(({
  length = 6,
  value: externalValue,
  onChange: externalOnChange,
  onComplete,
  error = false,
  disabled = false,
  compact = false,
}, ref) => {
  const [internalValue, setInternalValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const retryCountRef = useRef(0)

  const isControlled = externalValue !== undefined
  const value = isControlled ? externalValue : internalValue

  // Robust focus function with retry for mobile browsers
  const attemptFocus = useCallback(() => {
    if (disabled) return
    const input = inputRef.current
    if (!input) return

    try {
      input.focus({ preventScroll: true })
    } catch {
      try { input.focus() } catch {}
    }
  }, [disabled])

  // Expose focus and clear methods to parent
  useImperativeHandle(ref, () => ({
    focus: () => {
      retryCountRef.current = 0
      attemptFocus()
    },
    clear: () => {
      if (isControlled && externalOnChange) {
        externalOnChange('')
      } else {
        setInternalValue('')
      }
    },
  }), [attemptFocus, isControlled, externalOnChange])

  // Auto-focus with retries (mobile browsers often reject first focus request)
  useEffect(() => {
    if (disabled) return

    attemptFocus()

    // Also try on next animation frame
    const rafId = requestAnimationFrame(() => {
      attemptFocus()
    })

    // Also try after a small delay (for dialog animations)
    const timerId = setTimeout(attemptFocus, 300)

    // Retry up to 2 more times for stubborn mobile browsers
    const timer2 = setTimeout(attemptFocus, 600)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(timerId)
      clearTimeout(timer2)
    }
  }, [disabled, attemptFocus])

  // Re-focus when value clears (for retry after error)
  useEffect(() => {
    if (isControlled && externalValue === '' && !disabled) {
      retryCountRef.current = 0
      const timer = setTimeout(attemptFocus, 150)
      return () => clearTimeout(timer)
    }
  }, [isControlled, externalValue, disabled, attemptFocus])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      const digits = raw.replace(/\D/g, '').slice(0, length)

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
    retryCountRef.current = 0
    attemptFocus()
  }, [attemptFocus])

  return (
    <div className="flex flex-col items-center gap-4" ref={containerRef}>
      {/* Hidden input to capture keyboard — positioned offscreen but still focusable */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleChange}
        onFocus={() => {
          containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }}
        disabled={disabled}
        className="absolute opacity-0 w-1 h-1 -top-10 left-1/2 pointer-events-none"
        style={{ fontSize: '16px' }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="رمز PIN"
        enterKeyHint="done"
      />

      {/* Visible dots — clickable to focus the hidden input */}
      <div
        className={'flex items-center justify-center ' + (compact ? 'gap-2.5' : 'gap-3.5') + (error ? ' animate-shake-error' : '')}
        onClick={handleFocus}
        onTouchStart={handleFocus}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleFocus()
          }
        }}
      >
        {Array.from({ length }, (_, i) => (
          <div
            key={i}
            className={[
              'pin-dot',
              compact ? 'pin-dot-compact' : '',
              i < value.length ? 'filled' : '',
              i === value.length && !error ? 'active' : '',
              error ? '!border-red-500/50' : '',
            ].filter(Boolean).join(' ')}
          />
        ))}
      </div>

      {value.length === 0 && !disabled && (
        <p className="text-[10px] text-muted-foreground/50 animate-pulse">
          اضغط لإدخال الرمز
        </p>
      )}
    </div>
  )
})

PinDots.displayName = 'PinDots'

export default PinDots
