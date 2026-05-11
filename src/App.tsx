import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Decimal from 'decimal.js'
import './App.css'

// ─── High-precision constants (cached per precision level) ───────────────────

let _constCache: { prec: number; PI: Decimal; E: Decimal; PHI: Decimal } | null = null

function getConsts(prec: number) {
  if (_constCache?.prec === prec) return _constCache
  Decimal.set({ precision: prec })
  _constCache = {
    prec,
    PI:  new Decimal(1).atan().times(4),
    E:   new Decimal(1).exp(),
    PHI: new Decimal(5).sqrt().plus(1).div(2),
  }
  return _constCache
}

// ─── Recursive-descent expression parser using Decimal ───────────────────────

class Expr {
  private s: string
  private pos: number
  private PI: Decimal
  private E: Decimal
  private PHI: Decimal

  constructor(input: string, PI: Decimal, E: Decimal, PHI: Decimal) {
    this.s = input.trim(); this.pos = 0
    this.PI = PI; this.E = E; this.PHI = PHI
  }

  private ws() { while (this.pos < this.s.length && ' \t\r\n'.includes(this.s[this.pos])) this.pos++ }
  private peek() { this.ws(); return this.pos < this.s.length ? this.s[this.pos] : '' }
  private eat()  { this.ws(); return this.s[this.pos++] }

  // expr → term (('+' | '-') term)*
  parse(): Decimal {
    let v = this.term()
    for (;;) {
      const c = this.peek()
      if      (c === '+') { this.eat(); v = v.plus(this.term()) }
      else if (c === '-') { this.eat(); v = v.minus(this.term()) }
      else break
    }
    return v
  }

  private term(): Decimal {
    let v = this.pow()
    for (;;) {
      const c = this.peek()
      if      (c === '*') { this.eat(); v = v.times(this.pow()) }
      else if (c === '/') { this.eat(); v = v.div(this.pow()) }
      else break
    }
    return v
  }

  private pow(): Decimal {
    const b = this.unary()
    if (this.peek() === '^') { this.eat(); return b.pow(this.pow()) }
    return b
  }

  private unary(): Decimal {
    const c = this.peek()
    if (c === '-') { this.eat(); return this.unary().neg() }
    if (c === '+') { this.eat(); return this.unary() }
    return this.primary()
  }

  private primary(): Decimal {
    const c = this.peek()

    if (c === '(') {
      this.eat()
      const v = this.parse()
      if (this.peek() === ')') this.eat()
      return v
    }

    if (/[0-9.]/.test(c)) {
      this.ws()
      const start = this.pos
      while (this.pos < this.s.length && /[0-9.]/.test(this.s[this.pos])) this.pos++
      return new Decimal(this.s.slice(start, this.pos))
    }

    // Identifier (constant or function name)
    this.ws()
    const start = this.pos
    while (this.pos < this.s.length && /[a-z_0-9]/i.test(this.s[this.pos])) this.pos++
    const word = this.s.slice(start, this.pos).toLowerCase()
    if (!word) throw new Error('unexpected: ' + c)

    const fn1 = (op: (x: Decimal) => Decimal): Decimal => {
      if (this.peek() !== '(') throw new Error('expected ( after ' + word)
      this.eat()
      const a = this.parse()
      if (this.peek() === ')') this.eat()
      return op(a)
    }

    switch (word) {
      case 'pi':    return this.PI
      case 'tau':   return this.PI.times(2)
      case 'e':     return this.E
      case 'phi':   return this.PHI
      case 'sqrt':  return fn1(x => x.sqrt())
      case 'cbrt':  return fn1(x => x.cbrt())
      case 'sin':   return fn1(x => Decimal.sin(x))
      case 'cos':   return fn1(x => Decimal.cos(x))
      case 'tan':   return fn1(x => Decimal.tan(x))
      case 'asin':  return fn1(x => Decimal.asin(x))
      case 'acos':  return fn1(x => Decimal.acos(x))
      case 'atan':  return fn1(x => Decimal.atan(x))
      case 'abs':   return fn1(x => x.abs())
      case 'ln':    return fn1(x => x.ln())
      case 'log':   return fn1(x => Decimal.log10(x))
      case 'log2':  return fn1(x => x.log(2))
      case 'log10': return fn1(x => Decimal.log10(x))
      case 'exp':   return fn1(x => x.exp())
      default: throw new Error('unknown: ' + word)
    }
  }
}

function evalDecimal(input: string, prec: number): Decimal | null {
  if (!input.trim()) return null
  const { PI, E, PHI } = getConsts(prec)
  try {
    const result = new Expr(input, PI, E, PHI).parse()
    return result.isFinite() ? result : null
  } catch {
    return null
  }
}

// ─── Quick float evaluator (for UI validity indicators only) ──────────────────

function evalFloat(expr: string): number | null {
  if (!expr.trim()) return null
  try {
    const s = expr
      .replace(/\bpi\b/gi,   '(Math.PI)')
      .replace(/\btau\b/gi,  '(2*Math.PI)')
      .replace(/\bphi\b/gi,  '((1+Math.sqrt(5))/2)')
      .replace(/\bsqrt\b/gi, 'Math.sqrt')
      .replace(/\bcbrt\b/gi, 'Math.cbrt')
      .replace(/\bsin\b/gi,  'Math.sin')
      .replace(/\bcos\b/gi,  'Math.cos')
      .replace(/\btan\b/gi,  'Math.tan')
      .replace(/\basin\b/gi, 'Math.asin')
      .replace(/\bacos\b/gi, 'Math.acos')
      .replace(/\batan\b/gi, 'Math.atan')
      .replace(/\babs\b/gi,  'Math.abs')
      .replace(/\bln\b/gi,   'Math.log')
      .replace(/\blog2\b/gi, 'Math.log2')
      .replace(/\blog\b/gi,  'Math.log10')
      .replace(/\bexp\b/gi,  'Math.exp')
      .replace(/\be\b/gi,    '(Math.E)')
      .replace(/\^/g, '**')
    const result = new Function('Math', `"use strict"; return (${s})`)(Math)
    if (typeof result !== 'number' || !isFinite(result)) return null
    return result
  } catch {
    return null
  }
}

// Returns true for plain numeric literals: "7", "1.5", "-3.14", ".5"
function isSimpleDecimal(s: string): boolean {
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s.trim())
}

// Scale two floats to integers by multiplying by 10^k (up to 15 decimal places).
function toScaledIntegers(a: number, b: number): [number, number] | null {
  if (!isFinite(a) || !isFinite(b)) return null
  for (let k = 0; k <= 15; k++) {
    const s = 10 ** k
    const ai = Math.round(a * s)
    const bi = Math.round(b * s)
    if (Number.isSafeInteger(ai) && Number.isSafeInteger(bi) &&
        Math.abs(ai / s - a) < 1e-9 && Math.abs(bi / s - b) < 1e-9) {
      return [ai, bi]
    }
  }
  return null
}

// Round to the same number of decimal places as step to prevent float drift.
function roundToStep(val: number, step: number): number {
  const decimals = (step.toString().split('.')[1] ?? '').length
  return parseFloat(val.toFixed(decimals))
}

// ─── Digit extraction ─────────────────────────────────────────────────────────

function digitsExact(num: number, den: number, count: number, base = 10): number[] {
  const d: number[] = []
  let r = ((num % den) + den) % den
  for (let i = 0; i < count; i++) {
    r *= base
    d.push(Math.floor(r / den))
    r %= den
    if (r === 0) break
  }
  return d
}

function digitsFromDecimal(value: Decimal, count: number, base = 10): number[] {
  const d: number[] = []
  let frac = value.abs().minus(value.abs().floor())
  const B = new Decimal(base)
  for (let i = 0; i < count; i++) {
    frac = frac.times(B)
    const digit = frac.floor()
    d.push(Math.min(base - 1, Math.max(0, digit.toNumber())))
    frac = frac.minus(digit)
    if (frac.isZero()) break
  }
  return d
}

const MAX_RATIONAL_DIGITS   = 10000
const MAX_IRRATIONAL_DIGITS = 500

function computeDigits(numExpr: string, denExpr: string, count: number, base = 10): number[] {
  // Fast path: both expressions are plain decimal literals — scale to integers
  const nf = evalFloat(numExpr)
  const df = evalFloat(denExpr)
  if (nf !== null && df !== null && df !== 0 &&
      isSimpleDecimal(numExpr) && isSimpleDecimal(denExpr)) {
    const scaled = toScaledIntegers(nf, df)
    if (scaled) return digitsExact(scaled[0], scaled[1], count, base)
  }

  // Slow path: arbitrary-precision Decimal for irrationals
  const cap  = Math.min(count, MAX_IRRATIONAL_DIGITS)
  const prec = cap + 20
  const numD = evalDecimal(numExpr, prec)
  const denD = evalDecimal(denExpr, prec)
  if (!numD || !denD || denD.isZero()) return []
  return digitsFromDecimal(numD.div(denD), cap, base)
}

// ─── UI ───────────────────────────────────────────────────────────────────────

const INSERTS = [
  { label: 'π',    value: 'pi'    },
  { label: 'e',    value: 'e'     },
  { label: 'φ',    value: 'phi'   },
  { label: '√(',   value: 'sqrt(' },
  { label: '∛(',   value: 'cbrt(' },
  { label: 'sin(', value: 'sin('  },
  { label: 'cos(', value: 'cos('  },
  { label: 'tan(', value: 'tan('  },
  { label: 'xⁿ',  value: '^'     },
]

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

function App() {
  const [numExpr, setNumExpr] = useState('1')
  const [denExpr, setDenExpr] = useState('7')
  const [numDigits, setNumDigits] = useState(1000)
  const [segLen, setSegLen] = useState(8)
  const [base, setBase] = useState(10)
  const [allNumeratorsMode, setAllNumeratorsMode] = useState(false)

  const dNumExpr  = useDebounced(numExpr,  300)
  const dDenExpr  = useDebounced(denExpr,  300)
  const dNumDigits = useDebounced(numDigits, 300)
  const dSegLen   = useDebounced(segLen,   150)
  const dBase     = useDebounced(base,     150)

  const numAnimDirRef  = useRef<1 | -1>(1)
  const [numAnimActive, setNumAnimActive] = useState(false)
  const [numAnimMin,    setNumAnimMin]    = useState('0')
  const [numAnimMax,    setNumAnimMax]    = useState('10')
  const [numAnimStep,   setNumAnimStep]   = useState('1')

  const denAnimDirRef  = useRef<1 | -1>(1)
  const [denAnimActive, setDenAnimActive] = useState(false)
  const [denAnimMin,    setDenAnimMin]    = useState('1')
  const [denAnimMax,    setDenAnimMax]    = useState('20')
  const [denAnimStep,   setDenAnimStep]   = useState('1')

  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const panRef         = useRef({ x: 0, y: 0 })
  const zoomRef        = useRef(1)
  const isDragging     = useRef(false)
  const dragStart      = useRef({ x: 0, y: 0 })
  const dragStartPan   = useRef({ x: 0, y: 0 })
  const activeInput    = useRef<'num' | 'den'>('num')
  const numInputRef    = useRef<HTMLInputElement>(null)
  const denInputRef    = useRef<HTMLInputElement>(null)

  // Fast float eval for border-color validity only
  const numVal = evalFloat(numExpr)
  const denVal = evalFloat(denExpr)

  // Whether both sides are plain decimal literals — determines slider cap
  const isSimpleRational =
    numVal !== null && denVal !== null && denVal !== 0 &&
    isSimpleDecimal(numExpr) && isSimpleDecimal(denExpr) &&
    toScaledIntegers(numVal, denVal) !== null

  // In all-numerators mode every fraction is rational, so always allow the full cap
  const maxDigits = (allNumeratorsMode || isSimpleRational) ? MAX_RATIONAL_DIGITS : MAX_IRRATIONAL_DIGITS

  const effectiveDigits = Math.min(numDigits, maxDigits)

  // Skip debounce for whichever field is animating so the canvas updates each tick
  const effectiveNumExpr = numAnimActive ? numExpr : dNumExpr
  const effectiveDenExpr = denAnimActive ? denExpr : dDenExpr

  // Heavy Decimal computation, only runs after inputs settle
  const digits = useMemo(
    () => computeDigits(effectiveNumExpr, effectiveDenExpr, Math.min(dNumDigits, maxDigits), dBase),
    [effectiveNumExpr, effectiveDenExpr, dNumDigits, maxDigits, dBase],
  )

  const allNumeratorsDigits = useMemo(() => {
    if (!allNumeratorsMode) return null
    const den = evalFloat(effectiveDenExpr)
    if (den === null || !Number.isInteger(den) || den < 2) return null
    const count = Math.min(dNumDigits, MAX_RATIONAL_DIGITS)
    const result: number[][] = []
    for (let n = 1; n < den; n++) result.push(digitsExact(n, den, count, dBase))
    return result
  }, [allNumeratorsMode, effectiveDenExpr, dNumDigits, dBase])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0a0a0f'
    ctx.fillRect(0, 0, w, h)

    const zoom   = zoomRef.current
    const step   = dSegLen * zoom
    const startX = w / 2 + panRef.current.x
    const startY = h / 2 + panRef.current.y

    if (allNumeratorsMode) {
      if (!allNumeratorsDigits || allNumeratorsDigits.length === 0) return
      ctx.lineWidth = Math.max(0.3, zoom * 0.7)
      allNumeratorsDigits.forEach((pathDigits, idx) => {
        if (pathDigits.length === 0) return
        const hue = (idx / allNumeratorsDigits.length) * 360
        ctx.strokeStyle = `hsla(${hue}, 85%, 65%, 0.75)`
        ctx.beginPath()
        let x = startX, y = startY
        ctx.moveTo(x, y)
        for (let i = 0; i < pathDigits.length; i++) {
          const angle = (pathDigits[i] / dBase) * 2 * Math.PI
          x += Math.cos(angle) * step
          y += Math.sin(angle) * step
          ctx.lineTo(x, y)
        }
        ctx.stroke()
      })
    } else {
      if (digits.length === 0) return
      const N = digits.length

      // Pre-compute all vertex positions with a typed array (fast)
      const xs = new Float32Array(N + 1)
      const ys = new Float32Array(N + 1)
      xs[0] = startX
      ys[0] = startY
      for (let i = 0; i < N; i++) {
        const angle = (digits[i] / dBase) * 2 * Math.PI
        xs[i + 1] = xs[i] + Math.cos(angle) * step
        ys[i + 1] = ys[i] + Math.sin(angle) * step
      }

      // Batch segments into ~200 stroke() calls instead of N calls.
      // Each batch shares one colour, so we still get a smooth gradient.
      const BATCH = Math.max(1, Math.floor(N / 200))
      ctx.lineWidth = Math.max(0.5, zoom)

      for (let i = 0; i < N; i += BATCH) {
        const end = Math.min(i + BATCH, N)
        const hue = ((i + end) * 0.5 / N) * 360
        ctx.strokeStyle = `hsl(${hue}, 85%, 65%)`
        ctx.beginPath()
        ctx.moveTo(xs[i], ys[i])
        for (let j = i + 1; j <= end; j++) ctx.lineTo(xs[j], ys[j])
        ctx.stroke()
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    ctx.arc(startX, startY, 3, 0, 2 * Math.PI)
    ctx.fill()
  }, [digits, allNumeratorsDigits, allNumeratorsMode, dSegLen, dBase])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      canvas.width  = canvas.offsetWidth  * dpr
      canvas.height = canvas.offsetHeight * dpr
      draw()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    return () => observer.disconnect()
  }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect   = canvas.getBoundingClientRect()
      const mx     = e.clientX - rect.left  - rect.width  / 2
      const my     = e.clientY - rect.top   - rect.height / 2
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      panRef.current = {
        x: mx + (panRef.current.x - mx) * factor,
        y: my + (panRef.current.y - my) * factor,
      }
      zoomRef.current = Math.max(0.01, Math.min(200, zoomRef.current * factor))
      draw()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [draw])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current   = true
    dragStart.current    = { x: e.clientX, y: e.clientY }
    dragStartPan.current = { ...panRef.current }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return
    panRef.current = {
      x: dragStartPan.current.x + (e.clientX - dragStart.current.x),
      y: dragStartPan.current.y + (e.clientY - dragStart.current.y),
    }
    draw()
  }

  const stopDrag = () => { isDragging.current = false }

  useEffect(() => {
    if (!numAnimActive) return
    const min = parseFloat(numAnimMin)
    const max = parseFloat(numAnimMax)
    const step = parseFloat(numAnimStep)
    if (isNaN(min) || isNaN(max) || isNaN(step) || step <= 0 || min >= max) return
    numAnimDirRef.current = 1
    const id = setInterval(() => {
      setNumExpr(prev => {
        const val = parseFloat(prev)
        if (isNaN(val)) return prev
        let next = roundToStep(val + numAnimDirRef.current * step, step)
        if (next >= max) { next = max; numAnimDirRef.current = -1 }
        else if (next <= min) { next = min; numAnimDirRef.current = 1 }
        return String(next)
      })
    }, 50)
    return () => clearInterval(id)
  }, [numAnimActive, numAnimMin, numAnimMax, numAnimStep])

  useEffect(() => {
    if (!denAnimActive) return
    const min = parseFloat(denAnimMin)
    const max = parseFloat(denAnimMax)
    const step = parseFloat(denAnimStep)
    if (isNaN(min) || isNaN(max) || isNaN(step) || step <= 0 || min >= max) return
    denAnimDirRef.current = 1
    const id = setInterval(() => {
      setDenExpr(prev => {
        const val = parseFloat(prev)
        if (isNaN(val)) return prev
        let next = roundToStep(val + denAnimDirRef.current * step, step)
        if (next >= max) { next = max; denAnimDirRef.current = -1 }
        else if (next <= min) { next = min; denAnimDirRef.current = 1 }
        return String(next)
      })
    }, 50)
    return () => clearInterval(id)
  }, [denAnimActive, denAnimMin, denAnimMax, denAnimStep])

  const insertSymbol = (s: string) => {
    if (activeInput.current === 'num') {
      setNumExpr(x => x + s)
      numInputRef.current?.focus()
    } else {
      setDenExpr(x => x + s)
      denInputRef.current?.focus()
    }
  }

  const decimalStr = numVal !== null && denVal !== null && denVal !== 0
    ? (numVal / denVal).toPrecision(10)
    : '—'

  return (
    <div className="app">
      <header className="controls">
        <div className="left-controls">
          <div className="fraction-input">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                ref={numInputRef}
                className={numVal === null ? 'invalid' : ''}
                value={numExpr}
                onChange={e => setNumExpr(e.target.value)}
                onFocus={() => { activeInput.current = 'num' }}
                placeholder="numerator"
                spellCheck={false}
                disabled={allNumeratorsMode}
                style={allNumeratorsMode ? { opacity: 0.35 } : undefined}
              />
              <button
                className={`all-num-btn${allNumeratorsMode ? ' active' : ''}`}
                onClick={() => setAllNumeratorsMode(m => !m)}
                title="Draw paths for all numerators 1 through den−1"
              >
                All&nbsp;nums
              </button>
            </div>
            <div className="anim-row" style={allNumeratorsMode ? { opacity: 0.35, pointerEvents: 'none' } : undefined}>
              <button
                className={`anim-play${numAnimActive ? ' active' : ''}`}
                onClick={() => setNumAnimActive(a => !a)}
                title="Animate numerator"
              >
                {numAnimActive ? '⏹' : '▶'}
              </button>
              <label className="anim-field"><span>min</span><input value={numAnimMin} onChange={e => setNumAnimMin(e.target.value)} /></label>
              <label className="anim-field"><span>max</span><input value={numAnimMax} onChange={e => setNumAnimMax(e.target.value)} /></label>
              <label className="anim-field"><span>step</span><input value={numAnimStep} onChange={e => setNumAnimStep(e.target.value)} /></label>
            </div>
            <span className="bar" />
            <input
              ref={denInputRef}
              className={denVal === null || denVal === 0 ? 'invalid' : ''}
              value={denExpr}
              onChange={e => setDenExpr(e.target.value)}
              onFocus={() => { activeInput.current = 'den' }}
              placeholder="denominator"
              spellCheck={false}
            />
            <div className="anim-row">
              <button
                className={`anim-play${denAnimActive ? ' active' : ''}`}
                onClick={() => setDenAnimActive(a => !a)}
                title="Animate denominator"
              >
                {denAnimActive ? '⏹' : '▶'}
              </button>
              <label className="anim-field"><span>min</span><input value={denAnimMin} onChange={e => setDenAnimMin(e.target.value)} /></label>
              <label className="anim-field"><span>max</span><input value={denAnimMax} onChange={e => setDenAnimMax(e.target.value)} /></label>
              <label className="anim-field"><span>step</span><input value={denAnimStep} onChange={e => setDenAnimStep(e.target.value)} /></label>
            </div>
          </div>
          <span className="decimal-preview">≈ {decimalStr}</span>
          <div className="inserts">
            {INSERTS.map(({ label, value }) => (
              <button
                key={value}
                className="insert-btn"
                onMouseDown={e => e.preventDefault()}
                onClick={() => insertSymbol(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="sliders">
          <label>
            <span>
              Digits: {effectiveDigits.toLocaleString()}
              {!isSimpleRational && <span className="cap-note"> (max {MAX_IRRATIONAL_DIGITS} for irrationals)</span>}
            </span>
            <input
              type="range"
              min="10"
              max={maxDigits}
              step="10"
              value={effectiveDigits}
              onChange={e => setNumDigits(parseInt(e.target.value))}
            />
          </label>
          <label>
            <span>Base: {base}</span>
            <input
              type="range"
              min="2"
              max="36"
              value={base}
              onChange={e => setBase(parseInt(e.target.value))}
            />
          </label>
          <label>
            <span>Step: {segLen}px</span>
            <input
              type="range"
              min="2"
              max="30"
              value={segLen}
              onChange={e => setSegLen(parseInt(e.target.value))}
            />
          </label>
        </div>
      </header>
      <canvas
        ref={canvasRef}
        className="canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      />
    </div>
  )
}

export default App
