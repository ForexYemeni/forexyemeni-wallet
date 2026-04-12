'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X } from 'lucide-react'

interface EnhancedUploadZoneProps {
  onFile: (file: File) => void
  accept?: string
  maxSize?: number
  preview?: string | null
  onClear?: () => void
  label?: string
  hint?: string
  required?: boolean
  compact?: boolean
}

export default function EnhancedUploadZone({
  onFile,
  accept = 'image/*',
  maxSize = 10 * 1024 * 1024, // 10MB
  preview,
  onClear,
  label,
  hint,
  required = false,
  compact = false,
}: EnhancedUploadZoneProps) {
  const [dragover, setDragover] = useState(false)
  const [sizeError, setSizeError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    (file: File) => {
      if (file.size > maxSize) {
        setSizeError(true)
        setTimeout(() => setSizeError(false), 3000)
        return
      }
      setSizeError(false)
      onFile(file)
    },
    [maxSize, onFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragover(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragover(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragover(false)
  }, [])

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) processFile(file)
      // Reset input so same file can be re-selected
      e.target.value = ''
    },
    [processFile]
  )

  // Show preview if available
  if (preview) {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-gold/20">
        <img
          src={preview}
          alt="معاينة"
          className="w-full object-cover rounded-2xl"
          style={{ maxHeight: compact ? '120px' : '160px' }}
        />
        {onClear && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            className="absolute top-2 left-2 w-8 h-8 bg-red-500/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-red-500 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div
        className={`upload-zone ${dragover ? 'dragover' : ''} ${compact ? '!p-4' : ''}`}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick()
        }}
      >
        <Upload
          className={`text-gold/60 mb-2 ${compact ? 'w-6 h-6' : 'w-8 h-8'}`}
        />
        {label && (
          <span className={`text-gold/80 ${compact ? 'text-xs' : 'text-sm'} font-medium`}>
            {label}
            {required && <span className="text-red-400 mr-1">*</span>}
          </span>
        )}
        {hint && (
          <span className={`text-muted-foreground/60 ${compact ? 'text-[10px]' : 'text-xs'} mt-1 upload-zone-hint`}>
            {hint}
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
      {sizeError && (
        <p className="text-[11px] text-red-400 flex items-center gap-1 px-1">
          حجم الملف يتجاوز الحد المسموح (10 ميغابايت)
        </p>
      )}
    </div>
  )
}
