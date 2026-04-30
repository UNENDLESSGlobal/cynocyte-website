import { useState, useRef, useCallback, useEffect } from 'react'

interface UseWebcamOptions {
  width?: number
  height?: number
  enabled?: boolean
}

export function useWebcam({ width = 1280, height = 720, enabled = true }: UseWebcamOptions = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const start = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width, height, facingMode: 'user' },
        audio: false,
      })
      setStream(s)
      if (videoRef.current) {
        videoRef.current.srcObject = s
        await videoRef.current.play()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera access denied')
    } finally {
      setLoading(false)
    }
  }, [width, height, enabled])

  const stop = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [stream])

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [stream])

  return { videoRef, stream, error, loading, start, stop }
}
