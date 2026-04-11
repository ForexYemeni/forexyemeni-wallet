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
  symbol: string
  flag: string
  color: string
}

const CURRENCIES: CurrencyOption[] = [
  { code: 'USDT', label: 'تيثر USDT', symbol: 'USDT', flag: '💵', color: 'text-emerald-400' },
  { code: 'YER', label: 'ريال يمني', symbol: 'ر.ي', flag: '🇾🇪', color: 'text-green-400' },
  { code: 'SAR', label: 'ريال سعودي', symbol: 'ر.س', flag: '🇸🇦', color: 'text-amber-400' },
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
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const getConvertedAmount = (usdt: number): number => {
    switch (selected) {
      case 'YER': return convertUSDTtoYER(usdt, rates.usdToYer)
      case 'SAR': return convertUSDTtoSAR(usdt, rates.usdToSar)
      default: return usdt
    }
  }

  const formatAmount = (amount: number): string => {
    switch (selected) {
      case 'YER': return formatYER(amount)
      case 'SAR': return formatSAR(amount)
      default: return formatUSDT(amount)
    }
  }

  const currentCurrency = CURRENCIES.find(c => c.code === selected)!
  const convertedBalance = getConvertedAmount(balance)
  const convertedFrozen = getConvertedAmount(frozenBalance)

  return (
    <div className={`space-y-2 ${className}`} ref={dropdownRef}>
      {/* Main balance amount */}
      <div className="text-4xl font-bold gold-text tracking-tight" dir="ltr">
        {selected === 'YER' || selected === 'SAR'
          ? <>{convertedBalance.toLocaleString('en-US', { minimumFractionDigits: selected === 'SAR' ? 2 : 0, maximumFractionDigits: selected === 'SAR' ? 2 : 0 })}</>
          : <>{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
        }
        <span className="text-lg mr-1.5 opacity-80">{currentCurrency.symbol}</span>
      </div>

      {/* Currency selector tabs */}
      <div className="flex items-center gap-1.5">
        {CURRENCIES.map((cur) => (
          <button
            key={cur.code}
            type="button"
            onClick={() => setSelected(cur.code)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              selected === cur.code
                ? `bg-white/10 border-gold/30 ${cur.color} shadow-sm`
                : 'bg-white/3 border-white/5 text-muted-foreground hover:bg-white/5 hover:text-foreground'
            }`}
          >
            <span className="text-sm">{cur.flag}</span>
            <span>{cur.symbol}</span>
          </button>
        ))}

        {/* Rate info pill */}
        {selected !== 'USDT' && (
          <div className="mr-auto flex items-center gap-1 px-2 py-1 rounded-md bg-white/3 text-[10px] text-muted-foreground">
            <span>1 USDT = </span>
            <span className="font-medium">
              {selected === 'YER' ? `${rates.usdToYer.toLocaleString()} ر.ي` : `${rates.usdToSar} ر.س`}
            </span>
          </div>
        )}
      </div>

      {/* Frozen balance */}
      {frozenBalance > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">المجمّد:</span>
          <span className="text-foreground/70" dir="ltr">
            {selected === 'YER' || selected === 'SAR'
              ? <>{convertedFrozen.toLocaleString('en-US', { minimumFractionDigits: selected === 'SAR' ? 2 : 0, maximumFractionDigits: selected === 'SAR' ? 2 : 0 })} {currentCurrency.symbol}</>
              : <>{frozenBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</>
            }
          </span>
        </div>
      )}
    </div>
  )
}
