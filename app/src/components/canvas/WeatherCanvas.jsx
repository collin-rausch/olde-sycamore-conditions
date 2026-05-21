import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER = `
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  varying vec2 vUv;

  void main() {
    vec3 color = mix(uHorizonColor, uZenithColor, vUv.y);
    gl_FragColor = vec4(color, 1.0);
  }
`

/**
 * Parse rgba/rgb CSS color string to normalized RGBA components.
 * @param {string} str
 * @returns {{ r: number, g: number, b: number, a: number }}
 */
function parseRgba(str) {
  const match = String(str || '').match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/,
  )
  if (!match) {
    return { r: 0.4, g: 0.55, b: 0.75, a: 1 }
  }
  return {
    r: Number(match[1]) / 255,
    g: Number(match[2]) / 255,
    b: Number(match[3]) / 255,
    a: match[4] != null ? Number(match[4]) : 1,
  }
}

/**
 * Build zenith and horizon sky colors from weather visualState.
 * @param {object|null|undefined} visualState
 * @returns {{ zenith: THREE.Color, horizon: THREE.Color }}
 */
function skyColorsFromVisualState(visualState) {
  const tint = parseRgba(visualState?.skyTintColor)
  const strength = Math.min(1, Math.max(0, visualState?.skyTintOpacity ?? 0.5))
  const exposure = visualState?.sceneExposure ?? 1

  const baseZenith = new THREE.Color(0.22, 0.42, 0.72)
  const tintColor = new THREE.Color(tint.r, tint.g, tint.b)
  const zenith = baseZenith.clone().lerp(tintColor, Math.min(1, strength * 1.8))
  zenith.multiplyScalar(exposure)

  const horizon = zenith.clone()
  horizon.r = Math.min(1, horizon.r * 1.12 + 0.06)
  horizon.g = Math.min(1, horizon.g * 1.08 + 0.05)
  horizon.b = Math.min(1, horizon.b * 0.92 + 0.03)

  return { zenith, horizon }
}

/**
 * @param {object} uniforms
 * @param {object|null|undefined} visualState
 */
function applyVisualUniforms(uniforms, visualState) {
  const { zenith, horizon } = skyColorsFromVisualState(visualState)
  uniforms.uZenithColor.value.copy(zenith)
  uniforms.uHorizonColor.value.copy(horizon)
}

/**
 * Full-screen WebGL sky gradient driven by weatherVisuals visualState.
 * @param {{ visualState: object|null|undefined }} props
 */
export default function WeatherCanvas({ visualState }) {
  const containerRef = useRef(null)
  const visualRef = useRef(visualState)
  visualRef.current = visualState

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    const canvas = renderer.domElement
    canvas.style.display = 'block'
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    container.appendChild(canvas)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 1

    const uniforms = {
      uZenithColor: { value: new THREE.Color(0.22, 0.42, 0.72) },
      uHorizonColor: { value: new THREE.Color(0.35, 0.52, 0.78) },
    }

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      depthWrite: false,
      depthTest: false,
    })

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const resize = () => {
      const width = container.clientWidth
      const height = container.clientHeight
      if (width === 0 || height === 0) return
      renderer.setSize(width, height, false)
    }

    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)

    let rafId = 0
    const tick = () => {
      applyVisualUniforms(uniforms, visualRef.current)
      renderer.render(scene, camera)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div className="weather-canvas" ref={containerRef} aria-hidden="true" />
}
