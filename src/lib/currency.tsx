'use client'

import React from 'react'

// ===================== CONSTANTS =====================

/** Conversion rate: 1 USDT = 535 YER (Yemeni Rial) */
export const USDT_TO_YER_RATE = 535

// ===================== CONVERSION =====================

/**
 * Converts a USDT amount to YER (Yemeni Rial).
 * @param amount - USDT amount
 * @returns YER amount (rounded to nearest integer, no decimals)
 */
export function convertUSDTtoYER(amount: number): number {
  return Math.round(amount * USDT_TO_YER_RATE)
}

// ===================== FORMATTING =====================

/**
 * Formats a number as YER with comma grouping and "ر.ي" suffix.
 * YER has no decimals.
 * @param amount - Amount in YER
 * @returns Formatted string, e.g. "12,840 ر.ي"
 */
export function formatYER(amount: number): string {
  const formatted = Math.round(amount).toLocaleString('en-US')
  return `${formatted} ر.ي`
}

/**
 * Formats a number as USDT with 2 decimals and "USDT" suffix.
 * @param amount - Amount in USDT
 * @returns Formatted string, e.g. "24.00 USDT"
 */
export function formatUSDT(amount: number): string {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
}

// ===================== COMPONENT =====================

interface DualAmountProps {
  amount: number
  /** Optional additional CSS class for the container */
  className?: string
  /** Size variant: 'sm' for compact, 'md' for default */
  size?: 'sm' | 'md'
}

/**
 * DualAmount — displays both USDT and YER amounts.
 * USDT is shown as the primary value, YER as a smaller muted equivalent below.
 */
export function DualAmount({ amount, className = '', size = 'md' }: DualAmountProps) {
  const yerAmount = convertUSDTtoYER(amount)

  const isSmall = size === 'sm'

  return (
    <div className={className}>
      <div className={isSmall ? 'text-sm font-bold' : 'text-base font-bold'}>
        {formatUSDT(amount)}
      </div>
      <div className={isSmall ? 'text-[10px] text-muted-foreground' : 'text-xs text-muted-foreground'}>
        ≈ {formatYER(yerAmount)}
      </div>
    </div>
  )
}
