'use client'

import React, { useEffect, useState } from 'react'

// ===================== STATE =====================

interface ExchangeRates {
  usdToYer: number
  usdToSar: number
  sarToYer: number
}

let cachedRates: ExchangeRates = { usdToYer: 535, usdToSar: 3.75, sarToYer: 142.67 }
let ratesLoaded = false
let rateListeners: Set<(rates: ExchangeRates) => void> = new Set()

/**
 * Load exchange rates from server settings (called once)
 */
async function loadExchangeRates() {
  if (ratesLoaded) return cachedRates
  try {
    const res = await fetch('/api/settings')
    const data = await res.json()
    if (data.success && data.settings?.exchangeRates) {
      const r = data.settings.exchangeRates
      cachedRates = {
        usdToYer: r.usdToYer || 535,
        usdToSar: r.usdToSar || 3.75,
        sarToYer: r.sarToYer || 142.67,
      }
      ratesLoaded = true
      // Notify listeners
      rateListeners.forEach(fn => fn(cachedRates))
    }
  } catch {
    // Use defaults on error
  }
  return cachedRates
}

// Auto-load on module import (client-side only)
if (typeof window !== 'undefined') {
  loadExchangeRates()
}

// ===================== HOOK =====================

/**
 * React hook to get current exchange rates.
 * Re-renders when rates are loaded/updated.
 */
export function useExchangeRates(): ExchangeRates {
  const [rates, setRates] = useState<ExchangeRates>(cachedRates)

  useEffect(() => {
    if (ratesLoaded) {
      return
    }
    // Listen for rate load
    const handler = (r: ExchangeRates) => setRates({ ...r })
    rateListeners.add(handler)
    // Try loading again
    loadExchangeRates()
    return () => { rateListeners.delete(handler) }
  }, [])

  return rates
}

// ===================== CONVERSION =====================

/**
 * Converts a USDT amount to YER (Yemeni Rial).
 */
export function convertUSDTtoYER(amount: number, rate?: number): number {
  const r = rate || cachedRates.usdToYer
  return Math.round(amount * r)
}

/**
 * Converts a USDT amount to SAR (Saudi Riyal).
 */
export function convertUSDTtoSAR(amount: number, rate?: number): number {
  const r = rate || cachedRates.usdToSar
  return parseFloat((amount * r).toFixed(2))
}

/**
 * Converts a SAR amount to YER.
 */
export function convertSARtoYER(amount: number, rate?: number): number {
  const r = rate || cachedRates.sarToYer
  return Math.round(amount * r)
}

/**
 * Converts YER to USDT.
 */
export function convertYERtoUSDT(amount: number, rate?: number): number {
  const r = rate || cachedRates.usdToYer
  return parseFloat((amount / r).toFixed(2))
}

// ===================== FORMATTING =====================

/**
 * Formats a number as YER with comma grouping and "ر.ي" suffix.
 */
export function formatYER(amount: number): string {
  const formatted = Math.round(amount).toLocaleString('en-US')
  return `${formatted} ر.ي`
}

/**
 * Formats a number as USDT with 2 decimals and "USDT" suffix.
 */
export function formatUSDT(amount: number): string {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`
}

/**
 * Formats a number as SAR with 2 decimals and "ر.س" suffix.
 */
export function formatSAR(amount: number): string {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`
}

// ===================== COMPONENT =====================

interface DualAmountProps {
  amount: number
  className?: string
  size?: 'sm' | 'md'
  /** Show SAR conversion in addition to YER */
  showSAR?: boolean
}

/**
 * DualAmount — displays both USDT and YER amounts.
 * USDT is shown as the primary value, YER as a smaller muted equivalent below.
 */
export function DualAmount({ amount, className = '', size = 'md', showSAR }: DualAmountProps) {
  const rates = useExchangeRates()
  const yerAmount = convertUSDTtoYER(amount, rates.usdToYer)
  const sarAmount = convertUSDTtoSAR(amount, rates.usdToSar)

  const isSmall = size === 'sm'

  return (
    <div className={className}>
      <div className={isSmall ? 'text-sm font-bold' : 'text-base font-bold'}>
        {formatUSDT(amount)}
      </div>
      <div className={isSmall ? 'text-[10px] text-muted-foreground' : 'text-xs text-muted-foreground'}>
        ≈ {formatYER(yerAmount)}
        {showSAR && <span className="mr-2">| ≈ {formatSAR(sarAmount)}</span>}
      </div>
    </div>
  )
}

/**
 * ExchangeRateBadge — shows current exchange rates in a compact badge.
 * Can be placed in header or dashboard.
 */
export function ExchangeRateBadge({ className = '' }: { className?: string }) {
  const rates = useExchangeRates()
  return (
    <div className={`flex items-center gap-2 text-[10px] text-muted-foreground ${className}`}>
      <span>1$ = {rates.usdToYer.toLocaleString()} ر.ي</span>
      <span className="text-white/10">|</span>
      <span>1$ = {rates.usdToSar} ر.س</span>
      <span className="text-white/10">|</span>
      <span>1 ر.س = {rates.sarToYer.toLocaleString()} ر.ي</span>
    </div>
  )
}
