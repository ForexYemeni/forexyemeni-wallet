'use client'

import { useState, useRef, type ReactNode, type InputHTMLAttributes } from 'react'

interface FloatingLabelInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string
  icon?: ReactNode
  error?: string
  success?: string
  rightIcon?: ReactNode
}

export default function FloatingLabelInput({
  label,
  icon,
  error,
  success,
  rightIcon,
  value,
  onFocus,
  onBlur,
  onChange,
  className = '',
  ...props
}: FloatingLabelInputProps) {
  const [focused, setFocused] = useState(false)
  const [hasValue, setHasValue] = useState(!!value)
  const inputRef = useRef<HTMLInputElement>(null)
  const isActive = focused || hasValue

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true)
    onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false)
    onBlur?.(e)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasValue(!!e.target.value)
    onChange?.(e)
  }

  const groupClass = [
    'float-label-group',
    error ? 'error' : success ? 'success' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={groupClass}>
      <input
        ref={inputRef}
        type={props.type || 'text'}
        value={value}
        className={`float-label-input ${icon || rightIcon ? (icon ? 'pr-10 pl-12' : 'pl-12') : ''} ${rightIcon && !icon ? 'pl-12' : ''}`}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        dir={props.dir || 'rtl'}
        autoComplete={props.autoComplete || 'off'}
        {...props}
      />
      <label
        className={`float-label ${isActive ? 'active' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        {label}
      </label>
      {icon && (
        <div className="float-label-icon">{icon}</div>
      )}
      {rightIcon && (
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          onClick={props.onClick}
        >
          {rightIcon}
        </div>
      )}
      {error && (
        <div className="float-validation-msg text-red-400">
          {error}
        </div>
      )}
      {success && !error && (
        <div className="float-validation-msg text-green-400">
          {success}
        </div>
      )}
    </div>
  )
}
