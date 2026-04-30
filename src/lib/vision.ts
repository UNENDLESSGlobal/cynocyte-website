import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  type FaceLandmarkerResult,
  type HandLandmarkerResult,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'

const VISION_WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm'
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

type VisionFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>

let filesetPromise: Promise<VisionFileset> | null = null
let handPromise: Promise<HandLandmarker> | null = null
let facePromise: Promise<FaceLandmarker> | null = null
let posePromise: Promise<PoseLandmarker> | null = null

function getVisionFileset() {
  filesetPromise ??= FilesetResolver.forVisionTasks(VISION_WASM_BASE).catch((error) => {
    filesetPromise = null
    throw error
  })
  return filesetPromise
}

export function getHandLandmarker() {
  handPromise ??= getVisionFileset()
    .then((vision) =>
      HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: HAND_MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
      })
    )
    .catch((error) => {
      handPromise = null
      throw error
    })

  return handPromise
}

export function getFaceLandmarker() {
  facePromise ??= getVisionFileset()
    .then((vision) =>
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      })
    )
    .catch((error) => {
      facePromise = null
      throw error
    })

  return facePromise
}

export function getPoseLandmarker() {
  posePromise ??= getVisionFileset()
    .then((vision) =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: POSE_MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      })
    )
    .catch((error) => {
      posePromise = null
      throw error
    })

  return posePromise
}

export interface VisionFrame {
  hand?: HandLandmarkerResult | null
  face?: FaceLandmarkerResult | null
  pose?: PoseLandmarkerResult | null
}

export type VisionMode = 'hand' | 'face' | 'pose'

export function isVideoFrameReady(video: HTMLVideoElement | null) {
  return Boolean(video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA)
}
