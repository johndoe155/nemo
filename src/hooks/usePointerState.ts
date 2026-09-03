import { useEffect, useRef } from 'react'

// Pointer/touch state in drawing-buffer pixels (bottom-left origin), mirroring
// Shadertoy iMouse: xy follows the drag, zw is the press point while held, and
// z > 1.0 means "dragging" (the shader disables temporal accumulation then).
// Mutable ref only — no React state churn per pointermove.
export interface MousePixels {
  x: number
  y: number
  clickX: number
  clickY: number
  down: boolean
}

export function usePointerState(
  targetRef: React.RefObject<HTMLElement | null>,
  dprRef: React.RefObject<number>,
) {
  const mouseRef = useRef<MousePixels>({ x: 0, y: 0, clickX: 0, clickY: 0, down: false })

  useEffect(() => {
    const el = targetRef.current
    if (!el) return

    const toPixels = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect()
      const dpr = dprRef.current ?? 1
      const x = (clientX - rect.left) * dpr
      // Flip Y so origin is bottom-left (WebGL / Shadertoy convention).
      const y = (rect.bottom - clientY) * dpr
      return { x: Math.max(0, x), y: Math.max(0, y) }
    }

    const onPointerDown = (event: PointerEvent) => {
      // Synthetic/secondary pointers may have no capturable active pointer;
      // capture is an optimization (drags that leave the element) so guard it.
      try {
        el.setPointerCapture?.(event.pointerId)
      } catch {
        /* not a live pointer (e.g. dispatched synthetic event) — ignore */
      }
      const p = toPixels(event.clientX, event.clientY)
      mouseRef.current = {
        x: p.x,
        y: p.y,
        clickX: p.x,
        clickY: p.y,
        down: true,
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      // Shadertoy only steers while a button/touch is held; hover does not
      // move the camera and the idle position is preserved between drags.
      if (!mouseRef.current.down) return
      const p = toPixels(event.clientX, event.clientY)
      mouseRef.current.x = p.x
      mouseRef.current.y = p.y
    }

    const onPointerUp = (event: PointerEvent) => {
      try {
        el.releasePointerCapture?.(event.pointerId)
      } catch {
        /* already released / synthetic event — ignore */
      }
      // Freeze xy at the release point; clear click state (zw).
      mouseRef.current.down = false
      mouseRef.current.clickX = 0
      mouseRef.current.clickY = 0
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
    }
  }, [targetRef, dprRef])

  return mouseRef
}
