'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Banner {
  id: string
  title: string
  description: string
  imageUrl: string
  link: string
  active: boolean
  order: number
}

export default function BannerSlider() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())
  const [isTransitioning, setIsTransitioning] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartX = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchBanners = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/banners')
      const data = await res.json()
      if (data.success) {
        const activeBanners = (data.banners || [])
          .filter((b: Banner) => b.active)
          .sort((a: Banner, b: Banner) => a.order - b.order)
        setBanners(activeBanners)
      }
    } catch { /* silent */ }
    finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBanners()
  }, [fetchBanners])

  // Auto-slide every 5 seconds
  useEffect(() => {
    if (banners.length <= 1) return

    const startTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        goToNext()
      }, 5000)
    }

    startTimer()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [banners.length, currentIndex])

  const goToNext = () => {
    if (isTransitioning || banners.length <= 1) return
    setIsTransitioning(true)
    setCurrentIndex(prev => (prev + 1) % banners.length)
    setTimeout(() => setIsTransitioning(false), 500)
  }

  const goToPrev = () => {
    if (isTransitioning || banners.length <= 1) return
    setIsTransitioning(true)
    setCurrentIndex(prev => (prev - 1 + banners.length) % banners.length)
    setTimeout(() => setIsTransitioning(false), 500)
  }

  const goToSlide = (index: number) => {
    if (isTransitioning || index === currentIndex) return
    setIsTransitioning(true)
    setCurrentIndex(index)
    setTimeout(() => setIsTransitioning(false), 500)
  }

  // Touch handlers for swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToNext() // Swipe left -> next
      else goToPrev() // Swipe right -> prev
    }
  }

  // Don't render if no banners
  if (!loading && banners.length === 0) return null

  if (loading) {
    return (
      <div className="glass-card rounded-xl overflow-hidden h-40 shimmer">
        <div className="w-full h-full bg-white/5 animate-pulse" />
      </div>
    )
  }

  const currentBanner = banners[currentIndex]

  const handleImageError = (bannerId: string) => {
    setImageErrors(prev => new Set(prev).add(bannerId))
  }

  const handleClick = () => {
    if (currentBanner?.link) {
      window.open(currentBanner.link, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden relative" ref={containerRef}>
      {/* Slider Container */}
      <div
        className="relative h-40 sm:h-48 md:h-56 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-all duration-500 ease-in-out ${
              index === currentIndex
                ? 'opacity-100 translate-x-0'
                : index < currentIndex
                ? 'opacity-0 -translate-x-full'
                : 'opacity-0 translate-x-full'
            }`}
            onClick={index === currentIndex ? handleClick : undefined}
          >
            {/* Background Image */}
            <div className="absolute inset-0">
              {!imageErrors.has(banner.id) ? (
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className={`w-full h-full object-cover ${
                    banner.link ? 'cursor-pointer' : ''
                  }`}
                  onError={() => handleImageError(banner.id)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center">
                  <span className="text-4xl opacity-30">🖼️</span>
                </div>
              )}
              {/* Dark overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
            </div>

            {/* Text Content */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
              <h3 className="text-white text-base sm:text-lg font-bold mb-1 drop-shadow-lg">
                {banner.title}
              </h3>
              {banner.description && (
                <p className="text-white/80 text-xs sm:text-sm line-clamp-2 drop-shadow-md">
                  {banner.description}
                </p>
              )}
              {banner.link && (
                <span className="inline-block mt-2 text-xs text-gold-light font-medium opacity-80">
                  اضغط لعرض المزيد ←
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Navigation Arrows - only on larger screens or when more than 1 */}
        {banners.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goToPrev() }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors backdrop-blur-sm hidden sm:flex"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goToNext() }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors backdrop-blur-sm hidden sm:flex"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Dot Indicators */}
      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-2.5 bg-white/5">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`transition-all duration-300 rounded-full ${
                index === currentIndex
                  ? 'w-6 h-2 bg-gold'
                  : 'w-2 h-2 bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
