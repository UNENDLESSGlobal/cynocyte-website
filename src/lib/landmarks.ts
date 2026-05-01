export interface LandmarkLike {
  x: number
  y: number
  z?: number
  visibility?: number
}

export interface Point {
  x: number
  y: number
}

export interface BlendshapeLike {
  categories?: Array<{ categoryName: string; score: number }>
}

export const HAND_FINGERTIP_INDICES = [4, 8, 12, 16, 20]

export const FACE_KEYPOINTS = {
  noseTip: 1,
  mouthLeft: 61,
  mouthRight: 291,
  mouthUpper: 13,
  mouthLower: 14,
  leftEyeUpper: 159,
  leftEyeLower: 145,
  rightEyeUpper: 386,
  rightEyeLower: 374,
  browLeftOuter: 70,
  browRightOuter: 300,
}

export const POSE_SEGMENTS = [
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
] as const

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  const safe = inMax - inMin === 0 ? 0 : (value - inMin) / (inMax - inMin)
  return lerp(outMin, outMax, clamp(safe, 0, 1))
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function toCanvasPoint(
  landmark: LandmarkLike,
  width: number,
  height: number,
  mirrored = true,
): Point {
  return {
    x: (mirrored ? 1 - landmark.x : landmark.x) * width,
    y: landmark.y * height,
  }
}

export function averagePoints(points: Point[]): Point {
  if (!points.length) return { x: 0, y: 0 }

  let x = 0
  let y = 0
  for (const point of points) {
    x += point.x
    y += point.y
  }
  return { x: x / points.length, y: y / points.length }
}

export function getFingerTips(
  landmarks: LandmarkLike[],
  width: number,
  height: number,
  mirrored = true,
) {
  return HAND_FINGERTIP_INDICES.map((index) => toCanvasPoint(landmarks[index], width, height, mirrored))
}

export function getPinchAmount(landmarks: LandmarkLike[]) {
  const thumb = landmarks[4]
  const index = landmarks[8]
  const wrist = landmarks[0]
  const indexBase = landmarks[5]
  if (!thumb || !index || !wrist || !indexBase) return 1

  const pinch = Math.hypot(thumb.x - index.x, thumb.y - index.y)
  const handScale = Math.max(0.001, Math.hypot(wrist.x - indexBase.x, wrist.y - indexBase.y))
  return pinch / handScale
}

export function isPinching(landmarks: LandmarkLike[], threshold = 0.45) {
  return getPinchAmount(landmarks) < threshold
}

export function isIndexExtended(landmarks: LandmarkLike[]) {
  const tip = landmarks[8]
  const pip = landmarks[6]
  const mcp = landmarks[5]
  if (!tip || !pip || !mcp) return false
  return distanceXY(tip, mcp) > distanceXY(pip, mcp) * 1.15
}

export function getBlendshapeScore(blendshapes: BlendshapeLike[] | undefined, name: string) {
  const categories = blendshapes?.[0]?.categories ?? []
  const match = categories.find((category) => category.categoryName === name)
  return match?.score ?? 0
}

export function pointToSegmentDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return distance(point, start)

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1)
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t })
}

export function lineIntersection(a1: Point, a2: Point, b1: Point, b2: Point) {
  const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x)
  if (Math.abs(d) < 0.0001) return null

  const ua = ((b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x)) / d
  const ub = ((a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x)) / d
  if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null

  return {
    x: a1.x + ua * (a2.x - a1.x),
    y: a1.y + ua * (a2.y - a1.y),
  }
}

export function getPosePoint(
  landmarks: LandmarkLike[] | undefined,
  index: number,
  width: number,
  height: number,
  mirrored = true,
) {
  const landmark = landmarks?.[index]
  if (!landmark || (landmark.visibility ?? 1) < 0.4) return null
  return toCanvasPoint(landmark, width, height, mirrored)
}

function distanceXY(a: LandmarkLike, b: LandmarkLike) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function drawPoseSkeleton(
  ctx: CanvasRenderingContext2D,
  pose: LandmarkLike[],
  options: {
    color?: string
    lineWidth?: number
    glow?: boolean
    width?: number
    height?: number
  } = {},
) {
  const {
    color = '#ffffff',
    lineWidth = 2,
    glow = false,
    width = ctx.canvas.width,
    height = ctx.canvas.height,
  } = options

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (glow) {
    ctx.shadowColor = color
    ctx.shadowBlur = 10
  }

  // Draw segments
  for (const [start, end] of POSE_SEGMENTS) {
    const startLandmark = pose[start]
    const endLandmark = pose[end]

    if (
      !startLandmark ||
      !endLandmark ||
      (startLandmark.visibility ?? 1) < 0.4 ||
      (endLandmark.visibility ?? 1) < 0.4
    ) {
      continue
    }

    const startPoint = toCanvasPoint(startLandmark, width, height, false)
    const endPoint = toCanvasPoint(endLandmark, width, height, false)

    ctx.beginPath()
    ctx.moveTo(startPoint.x, startPoint.y)
    ctx.lineTo(endPoint.x, endPoint.y)
    ctx.stroke()
  }

  // Draw joints (keypoints)
  ctx.fillStyle = color
  const radius = lineWidth * 1.5

  for (let i = 0; i < pose.length; i++) {
    const landmark = pose[i]
    if (!landmark || (landmark.visibility ?? 1) < 0.4) continue

    const point = toCanvasPoint(landmark, width, height, false)
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}
