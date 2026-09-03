import bufferASource from './shaders/bufferA.glsl?raw'
import bufferBSource from './shaders/bufferB.glsl?raw'
import bufferCSource from './shaders/bufferC.glsl?raw'
import bufferDSource from './shaders/bufferD.glsl?raw'
import imageSource from './shaders/image.glsl?raw'

import noiseTextureUrl from '../assets/color_noise.png'
import diskTextureUrl from '../assets/london.png'

export const CHANNEL_TEXTURES = {
  /** iChannel0: 256x256 RGBA white-noise LUT (iq's noise()). */
  noise: noiseTextureUrl,
  /** iChannel1: photo modulating the accretion-disk streaks. */
  diskPhoto: diskTextureUrl,
} as const

export interface ShadertoyPassSource {
  name: 'A' | 'B' | 'C' | 'D' | 'Image'
  source: string
}

export const SHADERTOY_PASSES: readonly ShadertoyPassSource[] = [
  { name: 'A', source: bufferASource },
  { name: 'B', source: bufferBSource },
  { name: 'C', source: bufferCSource },
  { name: 'D', source: bufferDSource },
  { name: 'Image', source: imageSource },
] as const
