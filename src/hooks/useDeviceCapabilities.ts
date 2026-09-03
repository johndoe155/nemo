import { useEffect, useState } from 'react'
import { detectMobileDevice, getTargetDevicePixelRatio } from '@/lib/device'

export interface DeviceCapabilities {
  isMobile: boolean
  dpr: number // capped on mobile, native/uncapped on desktop
}

function readCapabilities(): DeviceCapabilities {
  const isMobile = detectMobileDevice()
  return { isMobile, dpr: getTargetDevicePixelRatio(isMobile) }
}

// Re-evaluates on resize / orientation change (mixed-DPR monitors, rotation).
export function useDeviceCapabilities(): DeviceCapabilities {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>(readCapabilities)

  useEffect(() => {
    const update = () => setCapabilities(readCapabilities())
    // Re-read once mounted (matchMedia is fully available after hydration).
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return capabilities
}
