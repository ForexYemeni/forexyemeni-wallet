'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface SocialLinks {
  whatsapp: string
  phone: string
  telegram: string
  facebook: string
  instagram: string
  twitter: string
  tiktok: string
  updatedAt: string
}

interface SocialItem {
  key: keyof SocialLinks
  label: string
  href: (value: string) => string
  icon: (size: number) => React.ReactNode
  color: string
  bgColor: string
}

// Custom SVG icons for social platforms
const WhatsAppIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const PhoneIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const TelegramIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
)

const FacebookIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
)

const InstagramIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 100-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.88 0 1.441 1.441 0 012.88 0z" />
  </svg>
)

const TwitterIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

const TikTokIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
)

const ChatSupportIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

export default function SocialFloatingButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [socialLinks, setSocialLinks] = useState<SocialLinks | null>(null)
  const [loaded, setLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchSocialLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.success && data.settings?.socialLinks) {
        setSocialLinks(data.settings.socialLinks)
      }
    } catch {
      // silent
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    fetchSocialLinks()
  }, [fetchSocialLinks])

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  if (!loaded) return null

  // Don't render if no social links are configured
  if (!socialLinks) return null

  const configuredLinks = ([
    {
      key: 'whatsapp' as keyof SocialLinks,
      label: 'واتساب',
      href: (v: string) => `https://wa.me/${v}`,
      icon: (size: number) => <WhatsAppIcon size={size} />,
      color: '#25D366',
      bgColor: 'bg-[#25D366]',
    },
    {
      key: 'phone' as keyof SocialLinks,
      label: 'هاتف',
      href: (v: string) => `tel:${v}`,
      icon: (size: number) => <PhoneIcon size={size} />,
      color: '#3B82F6',
      bgColor: 'bg-[#3B82F6]',
    },
    {
      key: 'telegram' as keyof SocialLinks,
      label: 'تيلجرام',
      href: (v: string) => `https://t.me/${v}`,
      icon: (size: number) => <TelegramIcon size={size} />,
      color: '#0088cc',
      bgColor: 'bg-[#0088cc]',
    },
    {
      key: 'facebook' as keyof SocialLinks,
      label: 'فيسبوك',
      href: (v: string) => v,
      icon: (size: number) => <FacebookIcon size={size} />,
      color: '#1877F2',
      bgColor: 'bg-[#1877F2]',
    },
    {
      key: 'instagram' as keyof SocialLinks,
      label: 'إنستقرام',
      href: (v: string) => v,
      icon: (size: number) => <InstagramIcon size={size} />,
      color: '#E4405F',
      bgColor: 'bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888]',
    },
    {
      key: 'twitter' as keyof SocialLinks,
      label: 'تويتر',
      href: (v: string) => v,
      icon: (size: number) => <TwitterIcon size={size} />,
      color: '#000000',
      bgColor: 'bg-gray-900',
    },
    {
      key: 'tiktok' as keyof SocialLinks,
      label: 'تيك توك',
      href: (v: string) => v,
      icon: (size: number) => <TikTokIcon size={size} />,
      color: '#000000',
      bgColor: 'bg-gray-900',
    },
  ] as SocialItem[]).filter((item) => socialLinks[item.key]?.trim())

  if (configuredLinks.length === 0) return null

  return (
    <div ref={containerRef} className="fixed z-50 bottom-24 left-4 md:bottom-8 md:left-4">
      {/* Social Icons Panel */}
      <div
        className={`absolute bottom-16 left-0 flex flex-col gap-2 transition-all duration-300 ease-out ${
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {configuredLinks.map((item, index) => (
          <a
            key={item.key}
            href={item.href(socialLinks[item.key] || '')}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 transition-all duration-200"
            style={{
              transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
            }}
            title={item.label}
          >
            {/* Label tooltip */}
            <span
              className={`whitespace-nowrap text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg transition-all duration-200 ${
                isOpen
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-2'
              }`}
              style={{
                backgroundColor: item.color,
                color: 'white',
                transitionDelay: isOpen ? `${index * 50 + 50}ms` : '0ms',
              }}
            >
              {item.label}
            </span>
            {/* Icon button */}
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg
                transition-all duration-200 hover:scale-110 active:scale-95
                ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}
              `}
              style={{
                backgroundColor: item.color,
                transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
              }}
            >
              {item.icon(20)}
            </div>
          </a>
        ))}
      </div>

      {/* Yemen Flag Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full overflow-hidden shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 relative group`}
        style={{
          transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
        aria-label="تواصل معنا"
      >
        {/* Yemen Flag - three horizontal stripes */}
        <div className="absolute inset-0 rounded-full overflow-hidden border-2 border-white/20">
          {/* Red stripe (top third) */}
          <div className="absolute top-0 left-0 right-0 h-[calc(33.333%+2px)]" style={{ backgroundColor: '#CE1126' }} />
          {/* White stripe (middle third) */}
          <div className="absolute top-[calc(33.333%-1px)] left-0 right-0 h-[calc(33.333%+2px)] bg-white" />
          {/* Black stripe (bottom third) */}
          <div className="absolute bottom-0 left-0 right-0 h-[calc(33.333%+2px)]" style={{ backgroundColor: '#000000' }} />
        </div>
        {/* Chat icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="drop-shadow-md">
            <ChatSupportIcon />
          </div>
        </div>
        {/* Shine effect on hover */}
        <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-tr from-transparent via-white/20 to-transparent" />
      </button>
    </div>
  )
}
