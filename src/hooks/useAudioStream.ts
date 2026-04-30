import { useState, useRef, useCallback, useEffect } from 'react'

interface UseAudioStreamOptions {
  enabled?: boolean
  fftSize?: number
}

export function useAudioStream({ enabled = true, fftSize = 2048 }: UseAudioStreamOptions = {}) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  const start = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      })
      setStream(s)

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(s)
      sourceRef.current = source
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = fftSize
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      analyserRef.current = analyser
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied')
    } finally {
      setLoading(false)
    }
  }, [enabled, fftSize])

  const stop = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
      setStream(null)
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
    }
    analyserRef.current = null
    sourceRef.current = null
  }, [stream])

  const getFrequencyData = useCallback(() => {
    if (!analyserRef.current) return null
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(data)
    return data
  }, [])

  const getTimeData = useCallback(() => {
    if (!analyserRef.current) return null
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteTimeDomainData(data)
    return data
  }, [])

  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return { stream, error, loading, start, stop, getFrequencyData, getTimeData, analyser: analyserRef }
}
