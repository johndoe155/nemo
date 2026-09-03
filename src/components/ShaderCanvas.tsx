import { useEffect, useRef } from 'react'
import { GargantuaRenderer } from '@/lib/gargantuaRenderer'
import { usePointerState } from '@/hooks/usePointerState'
import { useDocumentVisibility } from '@/hooks/useDocumentVisibility'
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities'
import { AdaptiveRenderScale, MOBILE_RENDER_SCALE_CAP } from '@/lib/renderScale'

const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

/**
 * Full-viewport canvas running the Gargantua multipass shader. No UI chrome:
 * renderer errors are logged to the console. Keyboard arrow keys orbit the
 * camera alongside mouse/touch drag.
 */
export function ShaderCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // DPR is capped on mobile, native on desktop (see lib/device.ts).
  const { dpr: targetDpr, isMobile } = useDeviceCapabilities()
  const dprRef = useRef<number>(targetDpr)
  dprRef.current = targetDpr
  const resizeFnRef = useRef<(() => void) | null>(null)
  const mouseRef = usePointerState(canvasRef, dprRef)
  const visibleRef = useDocumentVisibility()
  const keysRef = useRef({ up: false, down: false, left: false, right: false })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let renderer: GargantuaRenderer | null = null
    try {
      renderer = new GargantuaRenderer(canvas, { mobile: isMobile })
    } catch (error) {
      console.error('[gargantua] WebGL init failed:', error)
      return
    }
    const gfx = renderer

    try {
      const compileError = gfx.verifyPrograms()
      if (compileError) {
        console.error('[gargantua] shader compile/link failed:', compileError)
        gfx.dispose()
        return
      }
    } catch (error) {
      console.error('[gargantua] shader compile failed:', error)
      gfx.dispose()
      return
    }

    const rafRef = { frame: 0 }
    const clockRef = { elapsed: 0, last: performance.now() }
    const adaptive = new AdaptiveRenderScale(isMobile)
    let appliedScale = isMobile ? MOBILE_RENDER_SCALE_CAP : 1

    const resize = () => {
      const container = containerRef.current
      if (!container || !renderer) return
      const rect = container.getBoundingClientRect()
      gfx.resize(rect.width, rect.height, dprRef.current)
    }
    resizeFnRef.current = resize

    const frame = (now: number) => {
      rafRef.frame = requestAnimationFrame(frame)
      if (!visibleRef.current) return

      const frameMs = now - clockRef.last
      const delta = Math.min(0.1, frameMs / 1000)
      clockRef.last = now
      clockRef.elapsed += delta

      try {
        gfx.render(clockRef.elapsed, mouseRef.current)
        gfx.keyboardOrbit(delta, keysRef.current)

        const scale = adaptive.report(frameMs)
        if (scale !== appliedScale) {
          appliedScale = scale
          gfx.setRenderScale(scale)
        }
      } catch (error) {
        cancelAnimationFrame(rafRef.frame)
        rafRef.frame = 0
        console.error('[gargantua] render failed:', error)
      }
    }

    resize()
    clockRef.last = performance.now()
    rafRef.frame = requestAnimationFrame(frame)

    const onKeyDown = (event: KeyboardEvent) => {
      if (!ARROW_KEYS.has(event.key)) return
      event.preventDefault()
      const k = keysRef.current
      if (event.key === 'ArrowUp') k.up = true
      else if (event.key === 'ArrowDown') k.down = true
      else if (event.key === 'ArrowLeft') k.left = true
      else if (event.key === 'ArrowRight') k.right = true
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (!ARROW_KEYS.has(event.key)) return
      const k = keysRef.current
      if (event.key === 'ArrowUp') k.up = false
      else if (event.key === 'ArrowDown') k.down = false
      else if (event.key === 'ArrowLeft') k.left = false
      else if (event.key === 'ArrowRight') k.right = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    const onResize = () => resize()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    const resizeObserver = new ResizeObserver(onResize)
    if (containerRef.current) resizeObserver.observe(containerRef.current)

    const onVisibility = () => {
      if (visibleRef.current) {
        clockRef.last = performance.now()
        if (rafRef.frame === 0) rafRef.frame = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(rafRef.frame)
      rafRef.frame = 0
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      document.removeEventListener('visibilitychange', onVisibility)
      resizeObserver.disconnect()
      resizeFnRef.current = null
      gfx.dispose()
      renderer = null
    }
  }, [mouseRef, visibleRef, isMobile])

  // Re-apply the buffer size when the target DPR changes without recreating.
  useEffect(() => {
    resizeFnRef.current?.()
  }, [targetDpr])

  return (
    <div ref={containerRef} className="shader-root">
      <canvas ref={canvasRef} className="shader-canvas" />
    </div>
  )
}
