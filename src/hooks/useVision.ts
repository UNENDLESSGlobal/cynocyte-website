import { useCallback, useMemo, useRef, useState } from 'react'
import type { FaceLandmarker, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision'
import { useWebcam } from '@/hooks/useWebcam'
import { getFaceLandmarker, getHandLandmarker, getPoseLandmarker, isVideoFrameReady, type VisionFrame } from '@/lib/vision'

interface UseVisionOptions {
  width?: number
  height?: number
  hand?: boolean
  face?: boolean
  pose?: boolean
}

export function useVision({
  width = 1280,
  height = 720,
  hand = false,
  face = false,
  pose = false,
}: UseVisionOptions) {
  const webcam = useWebcam({ width, height })
  const handRef = useRef<HandLandmarker | null>(null)
  const faceRef = useRef<FaceLandmarker | null>(null)
  const poseRef = useRef<PoseLandmarker | null>(null)
  const [visionLoading, setVisionLoading] = useState(false)
  const [visionError, setVisionError] = useState<string | null>(null)

  const startVision = useCallback(async () => {
    setVisionLoading(true)
    setVisionError(null)

    try {
      await webcam.start()

      const [loadedHand, loadedFace, loadedPose] = await Promise.all([
        hand ? getHandLandmarker() : Promise.resolve(null),
        face ? getFaceLandmarker() : Promise.resolve(null),
        pose ? getPoseLandmarker() : Promise.resolve(null),
      ])

      handRef.current = loadedHand
      faceRef.current = loadedFace
      poseRef.current = loadedPose
    } catch (error) {
      setVisionError(error instanceof Error ? error.message : 'Unable to start webcam tracking')
    } finally {
      setVisionLoading(false)
    }
  }, [face, hand, pose, webcam])

  const stopVision = useCallback(() => {
    webcam.stop()
  }, [webcam])

  const detectFrame = useCallback((timestamp = performance.now()): VisionFrame | null => {
    const video = webcam.videoRef.current
    if (!isVideoFrameReady(video)) return null

    return {
      hand: handRef.current?.detectForVideo(video, timestamp) ?? null,
      face: faceRef.current?.detectForVideo(video, timestamp) ?? null,
      pose: poseRef.current?.detectForVideo(video, timestamp) ?? null,
    }
  }, [webcam.videoRef])

  return useMemo(
    () => ({
      ...webcam,
      visionError,
      visionLoading,
      startVision,
      stopVision,
      detectFrame,
    }),
    [detectFrame, startVision, stopVision, visionError, visionLoading, webcam],
  )
}
