import { useRef, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import './ToothpickBuilder.css'

interface Point { x: number; y: number }
interface PlacedShape { dx: number; dy: number; angle: number; depth: number }

function rot(px: number, py: number, a: number): [number, number] {
  const c = Math.cos(a), s = Math.sin(a)
  return [px * c - py * s, px * s + py * c]
}

function toWorld(p: Point, attach: Point, placed: PlacedShape): Point {
  const [rx, ry] = rot(p.x - attach.x, p.y - attach.y, placed.angle)
  return { x: placed.dx + rx, y: placed.dy + ry }
}

// Index of the neighbor that points "into" the shape from a given endpoint
function entryNeighborIdx(idx: number, len: number): number {
  return idx === len - 1 ? len - 2 : idx + 1
}

// Index of the neighbor that points "back into" the shape from a growth point
function exitNeighborIdx(idx: number, len: number): number {
  return idx === 0 ? 1 : idx - 1
}

function buildSequence(
  pts: Point[],
  attachIdx: number,
  growthIdxs: number[],
  iters: number,
): PlacedShape[] {
  if (pts.length < 2 || growthIdxs.length === 0) return []

  const attach = pts[attachIdx]
  const en = pts[entryNeighborIdx(attachIdx, pts.length)]
  const entryAngle = Math.atan2(en.y - attach.y, en.x - attach.x)

  const root: PlacedShape = { dx: 0, dy: 0, angle: 0, depth: 0 }
  const all: PlacedShape[] = [root]
  let frontier = [root]

  for (let i = 0; i < iters; i++) {
    const next: PlacedShape[] = []
    for (const placed of frontier) {
      for (const gi of growthIdxs) {
        const gpt = pts[gi]
        const wg = toWorld(gpt, attach, placed)
        const gn = pts[exitNeighborIdx(gi, pts.length)]
        const localExitAngle = Math.atan2(gpt.y - gn.y, gpt.x - gn.x)
        const worldExitAngle = placed.angle + localExitAngle
        const newAngle = worldExitAngle - entryAngle
        const child: PlacedShape = { dx: wg.x, dy: wg.y, angle: newAngle, depth: placed.depth + 1 }
        next.push(child)
        all.push(child)
      }
    }
    frontier = next
  }

  return all
}

const ATTACH_COLOR = '#6366f1'
const GROWTH_COLOR = '#22c55e'
const NEUTRAL_COLOR = '#475569'
const LINE_COLOR = '#94a3b8'

type Mode = 'draw' | 'attach' | 'growth'

export default function ToothpickBuilder() {
  const navigate = useNavigate()
  const editorRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)

  const [points, setPoints] = useState<Point[]>([])
  const [attachIdx, setAttachIdx] = useState(0)
  const [growthIdxs, setGrowthIdxs] = useState<number[]>([])
  const [iters, setIters] = useState(3)
  const [mode, setMode] = useState<Mode>('draw')

  // Editor canvas draw
  useEffect(() => {
    const canvas = editorRef.current
    if (!canvas) return
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    if (canvas.width === 0 || canvas.height === 0) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (points.length > 1) {
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
      ctx.strokeStyle = LINE_COLOR
      ctx.lineWidth = 2
      ctx.stroke()
    }

    for (let i = 0; i < points.length; i++) {
      const { x, y } = points[i]
      const isAttach = i === attachIdx
      const isGrowth = growthIdxs.includes(i)
      ctx.beginPath()
      ctx.arc(x, y, isAttach ? 9 : 6, 0, Math.PI * 2)
      ctx.fillStyle = isAttach ? ATTACH_COLOR : isGrowth ? GROWTH_COLOR : NEUTRAL_COLOR
      ctx.fill()
      ctx.strokeStyle = '#0a0a0f'
      ctx.lineWidth = 2
      ctx.stroke()

      // Index label
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '10px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(i), x, y)
    }
  }, [points, attachIdx, growthIdxs])

  // Preview canvas draw
  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas) return
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    if (canvas.width === 0 || canvas.height === 0) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const shapes = buildSequence(points, attachIdx, growthIdxs, iters)
    if (shapes.length === 0) return

    const attach = points[attachIdx]
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const placed of shapes) {
      for (const p of points) {
        const wp = toWorld(p, attach, placed)
        if (wp.x < minX) minX = wp.x
        if (wp.x > maxX) maxX = wp.x
        if (wp.y < minY) minY = wp.y
        if (wp.y > maxY) maxY = wp.y
      }
    }

    const pad = 36
    const W = canvas.width, H = canvas.height
    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1
    const scale = Math.min((W - pad * 2) / rangeX, (H - pad * 2) / rangeY)
    const ox = (W - rangeX * scale) / 2 - minX * scale
    const oy = (H - rangeY * scale) / 2 - minY * scale

    const maxDepth = shapes.reduce((m, s) => Math.max(m, s.depth), 0)

    for (const placed of shapes) {
      const t = maxDepth > 0 ? placed.depth / maxDepth : 0
      const hue = 240 + t * 100
      ctx.strokeStyle = `hsl(${hue}, 65%, 62%)`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < points.length; i++) {
        const wp = toWorld(points[i], attach, placed)
        const sx = wp.x * scale + ox
        const sy = wp.y * scale + oy
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
      ctx.stroke()
    }
  }, [points, attachIdx, growthIdxs, iters])

  const nearestPoint = (x: number, y: number): number => {
    let best = -1, bestDist = Infinity
    for (let i = 0; i < points.length; i++) {
      const d = Math.hypot(points[i].x - x, points[i].y - y)
      if (d < bestDist) { bestDist = d; best = i }
    }
    return bestDist < 24 ? best : -1
  }

  const handleEditorClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = editorRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (mode === 'draw') {
      const newIdx = points.length
      setPoints(prev => [...prev, { x, y }])
      setGrowthIdxs([newIdx])
      return
    }

    const idx = nearestPoint(x, y)
    if (idx < 0) return

    if (mode === 'attach') {
      setAttachIdx(idx)
    } else {
      setGrowthIdxs(prev =>
        prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
      )
    }
  }, [mode, points]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUndo = () => {
    const newLen = points.length - 1
    setPoints(points.slice(0, newLen))
    setGrowthIdxs(newLen > 0 ? [newLen - 1] : [])
    setAttachIdx(a => Math.min(a, Math.max(0, newLen - 1)))
  }

  const handleClear = () => {
    setPoints([])
    setGrowthIdxs([])
    setAttachIdx(0)
  }

  const modeHint: Record<Mode, string> = {
    draw: 'Click to add vertices',
    attach: 'Click a vertex to set it as the attachment point',
    growth: 'Click a vertex to toggle it as a growth point',
  }

  return (
    <div className="tb-page">
      <div className="tb-topbar">
        <button className="tb-back" onClick={() => navigate('/')}>←</button>
        <h1>Custom Sequence Builder</h1>
      </div>
      <div className="tb-body">
        {/* Left: shape editor */}
        <div className="tb-left">
          <div className="tb-panel-header">
            <span>Shape Editor</span>
            <div className="tb-actions">
              <button onClick={handleUndo} disabled={points.length === 0}>Undo</button>
              <button onClick={handleClear} disabled={points.length === 0}>Clear</button>
            </div>
          </div>
          <div className="tb-modes">
            {(['draw', 'attach', 'growth'] as Mode[]).map(m => (
              <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
                {m === 'draw' ? 'Draw' : m === 'attach' ? 'Set Attach' : 'Toggle Growth'}
              </button>
            ))}
          </div>
          <div className="tb-hint">{modeHint[mode]}</div>
          <div className="tb-canvas-wrap">
            <canvas ref={editorRef} className="tb-editor-canvas" onClick={handleEditorClick} />
          </div>
          <div className="tb-legend">
            <span><span className="tb-dot" style={{ background: ATTACH_COLOR }} />Attachment</span>
            <span><span className="tb-dot" style={{ background: GROWTH_COLOR }} />Growth</span>
            <span><span className="tb-dot" style={{ background: NEUTRAL_COLOR }} />Vertex</span>
          </div>
        </div>

        {/* Right: preview */}
        <div className="tb-right">
          <div className="tb-panel-header">
            <span>Preview</span>
            <div className="tb-iter-row">
              <span>Iterations: {iters}</span>
              <input type="range" min={0} max={20} value={iters}
                onChange={e => setIters(+e.target.value)} />
            </div>
          </div>
          <div className="tb-canvas-wrap">
            <canvas ref={previewRef} className="tb-preview-canvas" />
          </div>
        </div>
      </div>
    </div>
  )
}
