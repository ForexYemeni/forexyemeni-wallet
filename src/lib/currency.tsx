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
let refreshPromise: Promise<ExchangeRates> | null = null

/**
 * Load exchange rates from server settings (called once)
 */
async function loadExchangeRates(forceRefresh = false): Promise<ExchangeRates> {
  if (ratesLoaded && !forceRefresh) return cachedRates

  // Deduplicate concurrent requests
  if (refreshPromise && !forceRefresh) return refreshPromise

  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.success && data.settings?.exchangeRates) {
        const r = data.settings.exchangeRates
        cachedRates = {
          usdToYer: Number(r.usdToYer) || 535,
          usdToSar: Number(r.usdToSar) || 3.75,
          sarToYer: Number(r.sarToYer) || 142.67,
        }
        ratesLoaded = true
        // Notify all listeners
        rateListeners.forEach(fn => fn({ ...cachedRates }))
      }
    } catch {
      // Use defaults on error
    } finally {
      refreshPromise = null
    }
    return { ...cachedRates }
  })()

  return refreshPromise
}

// Auto-load on module import (client-side only)
if (typeof window !== 'undefined') {
  loadExchangeRates()
}

/**
 * Force refresh exchange rates from server.
 * Call this after admin saves new rates.
 */
export function refreshExchangeRates(): Promise<ExchangeRates> {
  ratesLoaded = false
  return loadExchangeRates(true)
}

/**
 * Get cached rates synchronously (no network call)
 */
export function getCachedRates(): ExchangeRates {
  return { ...cachedRates }
}

// ===================== HOOK =====================

/**
 * React hook to get current exchange rates.
 * Re-renders when rates are loaded/updated.
 */
export function useExchangeRates(): ExchangeRates {
  const [rates, setRates] = useState<ExchangeRates>(cachedRates)

  useEffect(() => {
    // Always listen for rate updates (even after initial load)
    const handler = (r: ExchangeRates) => setRates({ ...r })
    rateListeners.add(handler)
    // Trigger load - loadExchangeRates handles caching internally
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

// ===================== CURRENCY SELECTOR =====================

type CurrencyCode = 'USDT' | 'YER' | 'SAR'

interface CurrencyOption {
  code: CurrencyCode
  label: string
  flag: string
}

const CURRENCIES: CurrencyOption[] = [
  { code: 'USDT', label: 'دولار (USDT)', flag: '💵' },
  { code: 'YER', label: 'ريال يمني (ر.ي)', flag: '🇾🇪' },
  { code: 'SAR', label: 'ريال سعودي (ر.س)', flag: '🇸🇦' },
]

interface BalanceCurrencySelectorProps {
  /** Balance in USDT (base currency) */
  balance: number
  /** Frozen balance in USDT */
  frozenBalance?: number
  className?: string
}

/**
 * BalanceCurrencySelector — shows a currency dropdown that converts
 * the user's balance to the selected currency in real-time.
 */
export function BalanceCurrencySelector({ balance, frozenBalance = 0, className = '' }: BalanceCurrencySelectorProps) {
  const [selected, setSelected] = useState<CurrencyCode>('USDT')
  const [open, setOpen] = useState(false)
  const rates = useExchangeRates()

  const convert = (usdt: number): string => {
    switch (selected) {
      case 'YER':
        return formatYER(convertUSDTtoYER(usdt, rates.usdToYer))
      case 'SAR':
        return formatSAR(convertUSDTtoSAR(usdt, rates.usdToSar))
      default:
        return formatUSDT(usdt)
    }
  }

  const currentCurrency = CURRENCIES.find(c => c.code === selected)!

  return (
    <div className={`relative ${className}`}>
      {/* Main balance display */}
      <div className="space-y-1">
        <div className="text-4xl font-bold gold-text tracking-tight">
          {convert(balance)}
        </div>

        {/* Currency selector dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen(!open)}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-xs text-muted-foreground hover:text-foreground"
            >
              <span>{currentCurrency.flag}</span>
              <span>{currentCurrency.label}</span>
              <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open && (
              <div className="absolute top-full right-0 mt-1 w-48 glass-card rounded-xl border border-white/10 shadow-lg z-50 overflow-hidden">
                {CURRENCIES.map((cur) => (
                  <button
                    key={cur.code}
                    type="button"
                    onClick={() => { setSelected(cur.code); setOpen(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-white/5 transition-colors text-right ${
                      selected === cur.code ? 'bg-gold/10 text-gold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span className="text-base">{cur.flag}</span>
                    <span className="flex-1">{cur.label}</span>
                    {selected === cur.code && (
                      <svg className="w-3.5 h-3.5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick rate preview */}
          {selected !== 'USDT' && (
            <span className="text-[10px] text-muted-foreground">
              ({formatUSDT(balance)})
            </span>
          )}
        </div>

        {/* Frozen balance */}
        {frozenBalance > 0 && (
          <div className="flex items-center gap-2 text-sm pt-1">
            <span className="text-muted-foreground">المجمّد:</span>
            <span className="text-foreground/70">{convert(frozenBalance)}</span>
          </div>
        )}

        {/* Rate info */}
        {selected !== 'USDT' && (
          <div className="text-[10px] text-muted-foreground/60 mt-1">
            {selected === 'YER' && `سعر الصرف: 1 USDT = ${rates.usdToYer.toLocaleString()} ر.ي`}
            {selected === 'SAR' && `سعر الصرف: 1 USDT = ${rates.usdToSar} ر.س`}
          </div>
        )}
      </div>
    </div>
  )
}
