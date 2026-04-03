/**
 * Shared image compression utility.
 * Compresses images to reduce file size while maintaining visual quality.
 * Uses canvas-based JPEG compression with configurable max dimensions and quality.
 */

interface CompressOptions {
  /** Maximum width/height in pixels (default: 1200) */
  maxSize?: number
  /** JPEG quality 0-1 (default: 0.8 — high quality, reduced size) */
  quality?: number
}

/**
 * Compress an image file using canvas.
 * Returns a new compressed File (JPEG format) or the original if compression fails.
 */
export function compressImage(file: File, options?: CompressOptions): Promise<File> {
  return new Promise((resolve) => {
    const { maxSize = 1200, quality = 0.8 } = options || {}

    // Skip non-image files
    if (!file.type.startsWith('image/')) {
      resolve(file)
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      let { width, height } = img

      // Only resize if image exceeds max dimensions
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width)
          width = maxSize
        } else {
          width = Math.round((width * maxSize) / height)
          height = maxSize
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        URL.revokeObjectURL(url)
        resolve(file)
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (blob && blob.size < file.size) {
            // Only use compressed version if it's actually smaller
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
          } else {
            resolve(file)
          }
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }

    img.src = url
  })
}

/**
 * Read a File as base64 data URL string.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
