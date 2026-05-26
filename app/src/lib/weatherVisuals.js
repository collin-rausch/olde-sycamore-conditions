/**
 * @fileoverview Cinematic weather visual engine for Olde Sycamore Golf Club.
 * Layer 1: raw weatherData → Layer 2: environmentalState → Layer 3: visualState.
 * Pure JavaScript, zero dependencies. Olde Sycamore area (35.1653°N, 80.6093°W).
 */

/** @typedef {'clear'|'golden'|'overcast'|'storm'|'foggy'|'night'|'rain'|'snow'} SceneMood */
/** @typedef {'spring'|'summer'|'fall'|'winter'} Season */
/** @typedef {'none'|'low'|'high'} LightningFrequency */
/** @typedef {'none'|'pollen'|'dust'|'mist'} AmbientParticles */
/** @typedef {'low'|'medium'|'high'} PerformanceMode */

/**
 * @typedef {object} VisualState
 * @property {string} dominantEffect - Highest-priority active effect.
 * @property {string[]} effectPriority - Active effects in priority order.
 * @property {string} skyTintColor - CSS rgba sky tint.
 * @property {number} skyTintOpacity - 0–1 sky tint strength.
 * @property {number} vignetteOpacity - 0–0.35 edge darkening.
 * @property {number} sceneExposure - 0.85–1.15 CSS brightness.
 * @property {number} ambientColorTemperature - 2200–7000 Kelvin.
 * @property {string} ambientTintColor - Subtle rgba ambient wash (max α 0.12).
 * @property {number} cloudOpacity - 0–1 from cloud cover.
 * @property {number} cloudSpeed - px/frame, max 0.8.
 * @property {number} cloudSpeedVariance - 0–0.3 per-layer variance.
 * @property {number} cloudLayerCount - 0–3 layers.
 * @property {number} cloudShadowStrength - 0–0.25.
 * @property {boolean} showRain
 * @property {number} rainDensity - 0–1.
 * @property {number} rainDensityNoise - ±0.05 organic fluctuation.
 * @property {number} rainAngle - degrees from vertical, max 20.
 * @property {number} rainSpeed - px/frame.
 * @property {number} rainOpacity - 0–0.6.
 * @property {boolean} showLightning
 * @property {LightningFrequency} lightningFrequency
 * @property {number} lightningRandomSeed - Sine-derived, never Math.random().
 * @property {boolean} showSun
 * @property {number} sunIntensity - 0–1 from UV.
 * @property {{ x: number, y: number }} sunPosition - Screen %.
 * @property {number} moonlightIntensity - 0–0.4.
 * @property {number} windIntensity - 0–1 normalized.
 * @property {number} windGustFactor - 0–1 gust multiplier.
 * @property {number} flagIntensity - 0–1 for CSS flag sway.
 * @property {number} hazeOpacity - 0–0.15.
 * @property {number} hazeBreathing - ±0.01 sine variance.
 * @property {number} fogOpacity - 0–0.4.
 * @property {AmbientParticles} ambientParticles
 * @property {boolean} heatHaze
 * @property {string} seasonalColorShift - rgba seasonal tint.
 * @property {{ fromMood: string, toMood: string, progress: number }} transitionState
 * @property {PerformanceMode} performanceMode
 * @property {SceneMood} sceneMood - Display mood (may lag during transition).
 * @property {number} sceneContrast - 0.8–1.2.
 * @property {number} sceneSaturation - 0.7–1.1.
 * @property {{ cloudDrift: number, rainVariance: number, hazeBreath: number, gustPulse: number, lightFlicker: number }} temporalNoise
 */

/** Olde Sycamore Golf Plantation latitude (degrees). */
export const CHARLOTTE_LAT = 35.1653

/** Olde Sycamore Golf Plantation longitude (degrees). */
export const CHARLOTTE_LON = -80.6093

const TIMEZONE = 'America/New_York'

const EFFECT_PRIORITY = [
  'lightning',
  'storm',
  'rain',
  'fog',
  'golden',
  'overcast',
  'clouds',
  'clear',
  'night',
]

const LIGHTNING_CODES = new Set([95, 96, 99])
const STORM_CODES = new Set([95, 96, 99])
const RAIN_CODES = new Set([
  51, 53, 55, 61, 63, 65, 80, 81, 82,
])
const FOG_CODES = new Set([45, 48])
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86])
const OVERCAST_CODE = 3

const LERP_RATES = {
  skyTintOpacity: 0.04,
  cloudOpacity: 0.02,
  fogOpacity: 0.008,
  rainDensity: 0.06,
  windGustFactor: 0.12,
  hazeOpacity: 0.015,
  sunIntensity: 0.03,
  vignetteOpacity: 0.02,
  sceneExposure: 0.025,
  ambientColorTemperature: 0.02,
  default: 0.03,
}

const MOOD_SKY = {
  clear: { color: 'rgba(255, 248, 235, 1)', opacity: 0.08 },
  golden: { color: 'rgba(255, 180, 90, 1)', opacity: 0.18 },
  overcast: { color: 'rgba(120, 130, 145, 1)', opacity: 0.22 },
  storm: { color: 'rgba(25, 35, 55, 1)', opacity: 0.38 },
  foggy: { color: 'rgba(200, 205, 210, 1)', opacity: 0.28 },
  night: { color: 'rgba(8, 12, 35, 1)', opacity: 0.55 },
  rain: { color: 'rgba(40, 55, 75, 1)', opacity: 0.32 },
  snow: { color: 'rgba(220, 230, 245, 1)', opacity: 0.2 },
}

const MOOD_EXPOSURE = {
  clear: 1.05,
  golden: 1.08,
  overcast: 0.95,
  storm: 0.82,
  foggy: 0.92,
  night: 0.45,
  rain: 0.88,
  snow: 0.98,
}

const MOOD_KELVIN = {
  clear: 5500,
  golden: 3200,
  overcast: 6500,
  storm: 6800,
  foggy: 6000,
  night: 2800,
  rain: 6200,
  snow: 7000,
}

const SEASONAL_TINT = {
  spring: 'rgba(180, 220, 160, 1)',
  summer: 'rgba(255, 230, 160, 1)',
  fall: 'rgba(220, 160, 90, 1)',
  winter: 'rgba(180, 200, 230, 1)',
}

const DEFAULT_WEATHER = {
  temperature_f: 72,
  feels_like_f: 70,
  humidity: 55,
  wind_speed_mph: 8,
  wind_direction: 180,
  weather_code: 0,
  cloud_cover: 15,
  uv_index: 6,
  precip_probability: 10,
  is_day: 1,
}

/**
 * Linear interpolation between two numbers.
 * @param {number} a - Start value.
 * @param {number} b - End value.
 * @param {number} t - Interpolation factor (rate per step, not 0–1 normalized).
 * @returns {number}
 */
export function lerp(a, b, t) {
  const safeA = a ?? 0
  const safeB = b ?? 0
  const delta = safeB - safeA
  if (Math.abs(delta) < 0.0001) return safeB
  const step = clamp(t, 0.001, 1)
  return safeA + delta * step
}

/**
 * Clamp a value to an inclusive range.
 * @param {number} val - Input value.
 * @param {number} min - Minimum.
 * @param {number} max - Maximum.
 * @returns {number}
 */
export function clamp(val, min, max) {
  const n = Number(val)
  if (Number.isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}

/**
 * Current hour in US Eastern (Charlotte), 0–23.
 * @param {Date} [date] - Optional reference time.
 * @returns {number}
 */
export function getEasternHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date)
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 12)
}

/**
 * 16-point compass label from wind direction in degrees.
 * @param {number} degrees - Meteorological wind direction (0–360).
 * @returns {string}
 */
export function getWindCardinal(degrees) {
  if (degrees == null || Number.isNaN(Number(degrees))) return '—'
  const labels = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ]
  const idx = Math.round((((Number(degrees) % 360) + 360) % 360) / 22.5) % 16
  return labels[idx]
}

/**
 * Smooth 0–1 temporal oscillator. Never uses Math.random().
 * @param {number} periodSeconds - Full cycle length in seconds.
 * @param {number} [phaseOffset=0] - Phase offset 0–1.
 * @returns {number}
 */
export function temporalSine(periodSeconds, phaseOffset = 0) {
  const period = Math.max(periodSeconds, 0.1)
  const phase = ((Date.now() / 1000) / period + phaseOffset) % 1
  return (Math.sin(phase * Math.PI * 2) + 1) / 2
}

/**
 * Parabolic sun arc for Charlotte: 6 AM bottom-left → noon top-center → 6 PM bottom-right.
 * @param {number} hour - Hour 0–23 (Eastern).
 * @param {number} [lat=CHARLOTTE_LAT] - Latitude in degrees.
 * @returns {{ x: number, y: number }} Screen percentages (0–100).
 */
export function getSunPosition(hour, lat = CHARLOTTE_LAT) {
  const h = clamp(hour, 0, 23)
  const dayStart = 6
  const dayEnd = 18
  const t = clamp((h - dayStart) / (dayEnd - dayStart), 0, 1)
  const latFactor = clamp((lat - 30) / 20, 0.85, 1.15)
  const x = 12 + t * 76
  const arc = Math.sin(t * Math.PI)
  const y = 78 - arc * 58 * latFactor
  return { x: clamp(x, 8, 92), y: clamp(y, 14, 82) }
}

/**
 * Convert color temperature (Kelvin) to a subtle ambient rgba tint.
 * @param {number} kelvin - Color temperature 2200–7000K.
 * @param {number} [opacity=0.08] - Alpha, capped at 0.12.
 * @returns {string}
 */
export function kelvinToRgba(kelvin, opacity = 0.08) {
  const k = clamp(kelvin, 2200, 7000) / 100
  const a = clamp(opacity, 0, 0.12)
  let r, g, b

  if (k <= 66) {
    r = 255
    g = clamp(99.4708025861 * Math.log(k) - 161.1195681661, 0, 255)
    b = k <= 19 ? 0 : clamp(138.5177312231 * Math.log(k - 10) - 305.0447927307, 0, 255)
  } else {
    r = clamp(329.698727446 * Math.pow(k - 60, -0.1332047592), 0, 255)
    g = clamp(288.1221695283 * Math.pow(k - 60, -0.0755148492), 0, 255)
    b = 255
  }

  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`
}

/**
 * @param {Date} [date]
 * @returns {Season}
 */
function getSeason(date = new Date()) {
  const month = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    month: 'numeric',
  }).format(date)
  const m = Number(month)
  if (m === 12 || m <= 2) return 'winter'
  if (m <= 5) return 'spring'
  if (m <= 8) return 'summer'
  return 'fall'
}

/**
 * Approximate solar elevation for Charlotte (0–90°).
 * @param {number} hour
 * @param {number} lat
 * @returns {number}
 */
function computeSunElevation(hour, lat = CHARLOTTE_LAT) {
  if (hour < 5 || hour > 21) return 0
  const t = clamp((hour - 6) / 12, 0, 1)
  const seasonal = lat > 35 ? 1.05 : 0.95
  return clamp(Math.sin(t * Math.PI) * 75 * seasonal, 0, 90)
}

/**
 * Approximate solar azimuth (0–360°, 90° ≈ east at sunrise).
 * @param {number} hour
 * @returns {number}
 */
function computeSunAzimuth(hour) {
  if (hour < 5 || hour > 21) return 0
  return clamp(90 + ((hour - 6) / 12) * 180, 0, 360)
}

/**
 * @param {object} weather
 * @returns {boolean}
 */
function isGoldenHourTime(weather) {
  const isDay = weather?.is_day ?? 1
  if (isDay === 0) return false
  const hour = getEasternHour()
  return hour >= 17 && hour <= 20
}

/**
 * Normalize raw Supabase weather row.
 * @param {object|null|undefined} weather
 * @returns {object}
 */
function normalizeWeather(weather) {
  if (!weather) return { ...DEFAULT_WEATHER }
  return { ...DEFAULT_WEATHER, ...weather }
}

/**
 * Derive raw scene mood from weather (before transition smoothing).
 * @param {object} w
 * @param {number} hour
 * @returns {SceneMood}
 */
function resolveTargetMood(w, hour) {
  const code = w.weather_code ?? 0
  const precip = w.precip_probability ?? 0
  const isDay = w.is_day ?? 1

  if (isDay === 0) return 'night'
  if (SNOW_CODES.has(code)) return 'snow'
  if (STORM_CODES.has(code)) return 'storm'
  if (RAIN_CODES.has(code) || precip > 40) return 'rain'
  if (FOG_CODES.has(code)) return 'foggy'
  if (isGoldenHourTime(w)) return 'golden'
  if (code === OVERCAST_CODE || (w.cloud_cover ?? 0) > 65) return 'overcast'
  return 'clear'
}

/**
 * Build ordered list of active effects with meaningful intensity.
 * @param {object} w
 * @param {SceneMood} targetMood
 * @param {object} env
 * @returns {string[]}
 */
function buildEffectPriority(w, targetMood, env) {
  const code = w.weather_code ?? 0
  const precip = w.precip_probability ?? 0
  const cloudCover = w.cloud_cover ?? 0
  const active = []

  if (LIGHTNING_CODES.has(code)) active.push('lightning')
  if (STORM_CODES.has(code) || (precip > 60 && (w.wind_speed_mph ?? 0) > 15)) {
    active.push('storm')
  }
  if (RAIN_CODES.has(code) || precip > 40) active.push('rain')
  if (FOG_CODES.has(code) || targetMood === 'foggy') active.push('fog')
  if (env.isGoldenHour && env.isNight === false) active.push('golden')
  if (code === OVERCAST_CODE || cloudCover > 50) active.push('overcast')
  if (cloudCover > 15 && targetMood !== 'night') active.push('clouds')
  if (env.isNight) active.push('night')
  if (active.length === 0 || targetMood === 'clear') active.push('clear')

  return EFFECT_PRIORITY.filter((e) => active.includes(e))
}

/**
 * Layer 2 — environmental state from weather + time + season.
 * @param {object|null|undefined} weather - Raw Supabase weather_cache row.
 * @returns {{
 *   sceneMood: SceneMood,
 *   isGoldenHour: boolean,
 *   isNight: boolean,
 *   easternHour: number,
 *   sunElevation: number,
 *   sunAzimuth: number,
 *   season: Season,
 * }}
 */
export function getEnvironmentalState(weather) {
  const w = normalizeWeather(weather)
  const hour = getEasternHour()
  const isNight = (w.is_day ?? 1) === 0
  const isGoldenHour = !isNight && isGoldenHourTime(w)

  return {
    sceneMood: resolveTargetMood(w, hour),
    isGoldenHour,
    isNight,
    easternHour: hour,
    sunElevation: isNight ? 0 : computeSunElevation(hour),
    sunAzimuth: isNight ? 0 : computeSunAzimuth(hour),
    season: getSeason(),
  }
}

/**
 * Compute live temporal noise channels (sine-only).
 * @returns {{
 *   cloudDrift: number,
 *   rainVariance: number,
 *   hazeBreath: number,
 *   gustPulse: number,
 *   lightFlicker: number,
 * }}
 */
function computeTemporalNoise() {
  return {
    cloudDrift: temporalSine(30, 0),
    rainVariance: temporalSine(8, 0.25),
    hazeBreath: temporalSine(12, 0),
    gustPulse: temporalSine(4, 0.1),
    lightFlicker: temporalSine(0.5, 0),
  }
}

/**
 * Apply dominant-effect attenuation for unified cinematic atmosphere.
 * @param {object} vs - visualState (mutated in place).
 * @returns {object}
 */
function applyRendererAttenuation(vs) {
  const d = vs.dominantEffect

  if (d === 'storm' || d === 'lightning') {
    if (vs.effectPriority.includes('golden')) {
      vs.skyTintOpacity *= 0.2
    }
    vs.hazeOpacity *= 0.1
    vs.sceneSaturation = clamp(vs.sceneSaturation * 0.75, 0.7, 1.1)
    vs.ambientColorTemperature = clamp(vs.ambientColorTemperature + 400, 2200, 7000)
    vs.ambientTintColor = kelvinToRgba(vs.ambientColorTemperature, 0.1)
  }

  if (d === 'rain') {
    vs.sunIntensity *= 0.3
    vs.sceneSaturation = clamp(vs.sceneSaturation * 0.85, 0.7, 1.1)
    vs.cloudShadowStrength *= 0.4
  }

  if (d === 'fog') {
    vs.cloudShadowStrength *= 0.2
    vs.sceneContrast = clamp(vs.sceneContrast * 0.88 + 0.12 * 0.88, 0.8, 1.2)
    vs.vignetteOpacity *= 0.6
  }

  if (d === 'golden') {
    vs.hazeOpacity = clamp(vs.hazeOpacity + 0.03, 0, 0.15)
    vs.sceneSaturation = clamp(Math.max(vs.sceneSaturation, 1.05), 0.7, 1.1)
    vs.vignetteOpacity = clamp(vs.vignetteOpacity + 0.04, 0, 0.35)
  }

  if (d === 'night') {
    vs.hazeOpacity *= 0.1
    vs.sunIntensity = 0
    vs.cloudOpacity *= 0.1
    vs.sceneSaturation = clamp(vs.sceneSaturation * 0.1, 0.7, 1.1)
    vs.ambientTintColor = kelvinToRgba(vs.ambientColorTemperature, 0.04)
  }

  return vs
}

/**
 * Deep-clone a visual state for store reset.
 * @param {object} state
 * @returns {object}
 */
function cloneVisualState(state) {
  return JSON.parse(JSON.stringify(state))
}

/**
 * Layer 3 — full visual state target from weather (before lerp).
 * @param {object|null|undefined} weather
 * @param {{ previousMood?: string, transitionProgress?: number }} [options]
 * @returns {VisualState}
 */
export function getVisualState(weather, options = {}) {
  const w = normalizeWeather(weather)
  const env = getEnvironmentalState(w)
  const noise = computeTemporalNoise()
  const targetMood = env.sceneMood
  const previousMood = options.previousMood ?? targetMood
  const transitionProgress = options.transitionProgress ?? 1

  const code = w.weather_code ?? 0
  const precip = w.precip_probability ?? 0
  const cloudCover = clamp((w.cloud_cover ?? 0) / 100, 0, 1)
  const humidity = clamp((w.humidity ?? 50) / 100, 0, 1)
  const windMph = w.wind_speed_mph ?? 0
  const uv = clamp((w.uv_index ?? 0) / 11, 0, 1)
  const tempF = w.temperature_f ?? 72
  const isDay = env.isNight ? 0 : 1

  const effectPriority = buildEffectPriority(w, targetMood, env)
  const dominantEffect = effectPriority[0] ?? 'clear'

  const moodSky = MOOD_SKY[targetMood] ?? MOOD_SKY.clear
  const exposure = MOOD_EXPOSURE[targetMood] ?? 1
  const kelvin = MOOD_KELVIN[targetMood] ?? 5500

  const windIntensity = clamp(windMph / 28, 0, 1)
  const windGustFactor = clamp(
    0.65 + noise.gustPulse * 0.35,
    0,
    1,
  )

  const showRain =
    RAIN_CODES.has(code) || precip > 40 || targetMood === 'rain'
  const rainBase = showRain
    ? clamp(precip / 100 + (RAIN_CODES.has(code) ? 0.35 : 0), 0.15, 1)
    : 0

  const showLightning = LIGHTNING_CODES.has(code)
  const lightningFrequency = showLightning
    ? (code === 99 || precip > 70 ? 'high' : 'low')
    : 'none'

  const fogOpacity = FOG_CODES.has(code)
    ? clamp(0.22 + humidity * 0.18, 0, 0.4)
    : clamp(humidity * 0.06, 0, 0.15)

  const cloudLayers =
    cloudCover > 0.6 ? 3 : cloudCover > 0.3 ? 2 : cloudCover > 0.08 ? 1 : 0

  const perfScale =
    { low: 0.7, medium: 1, high: 1.15 }[
      /** @type {PerformanceMode} */ ('medium')
    ]

  /** @type {PerformanceMode} */
  const performanceMode = 'medium'

  const sceneMoodForOutput =
    transitionProgress >= 0.95 ? targetMood : previousMood

  const vs = {
    dominantEffect,
    effectPriority,
    skyTintColor: moodSky.color,
    skyTintOpacity: clamp(moodSky.opacity, 0, 1),
    vignetteOpacity: clamp(0.12 + (env.isNight ? 0.12 : 0), 0, 0.35),
    sceneExposure: clamp(exposure, 0.85, 1.15),
    ambientColorTemperature: kelvin,
    ambientTintColor: kelvinToRgba(kelvin, 0.08),
    cloudOpacity: clamp(cloudCover * (env.isNight ? 0.35 : 1), 0, 1),
    cloudSpeed: clamp(0.15 + cloudCover * 0.5, 0, 0.8) * perfScale,
    cloudSpeedVariance: clamp(0.08 + cloudCover * 0.15, 0, 0.3),
    cloudLayerCount: clamp(cloudLayers, 0, 3),
    cloudShadowStrength: clamp(cloudCover * 0.22, 0, 0.25),
    showRain,
    rainDensity: clamp(rainBase + (noise.rainVariance - 0.5) * 0.1, 0, 1),
    rainDensityNoise: 0.05,
    rainAngle: clamp(4 + windIntensity * 14, 0, 20),
    rainSpeed: clamp(1.2 + rainBase * 2.5, 0.5, 4) * perfScale,
    rainOpacity: clamp(0.15 + rainBase * 0.35, 0, 0.6),
    showLightning,
    lightningFrequency,
    lightningRandomSeed: Math.floor(temporalSine(3600, 0) * 10000),
    showSun: isDay === 1 && !showRain && targetMood !== 'storm' && !env.isNight,
    sunIntensity: clamp(uv * (1 - cloudCover * 0.6), 0, 1),
    sunPosition: getSunPosition(env.easternHour),
    moonlightIntensity: env.isNight
      ? clamp(0.12 + (1 - cloudCover) * 0.22, 0, 0.4)
      : 0,
    windIntensity,
    windGustFactor,
    flagIntensity: clamp(windIntensity * windGustFactor, 0, 1),
    hazeOpacity: clamp(humidity * 0.12 + (noise.hazeBreath - 0.5) * 0.02, 0, 0.15),
    hazeBreathing: (noise.hazeBreath - 0.5) * 0.02,
    fogOpacity,
    ambientParticles: resolveAmbientParticles(w, env, tempF),
    heatHaze: tempF > 90 && targetMood === 'clear' && isDay === 1,
    seasonalColorShift: SEASONAL_TINT[env.season],
    transitionState: {
      fromMood: previousMood,
      toMood: targetMood,
      progress: clamp(transitionProgress, 0, 1),
    },
    performanceMode,
    sceneMood: sceneMoodForOutput,
    sceneContrast: clamp(1 - cloudCover * 0.12, 0.8, 1.2),
    sceneSaturation: clamp(1 - cloudCover * 0.08, 0.7, 1.1),
    temporalNoise: noise,
  }

  return applyRendererAttenuation(vs)
}

/**
 * @param {object} w
 * @param {object} env
 * @param {number} tempF
 * @returns {AmbientParticles}
 */
function resolveAmbientParticles(w, env, tempF) {
  if (env.isNight || env.sceneMood === 'storm' || env.sceneMood === 'rain') {
    return 'none'
  }
  if ((w.humidity ?? 0) > 88 && (w.weather_code ?? 0) <= 2) return 'mist'
  if (env.season === 'spring' && tempF > 60 && tempF < 85) return 'pollen'
  if (env.season === 'summer' && tempF > 82) return 'dust'
  return 'none'
}

/**
 * Lerp numeric field with named rate.
 * @param {number|null|undefined} current
 * @param {number|null|undefined} target
 * @param {string} key
 * @returns {number}
 */
function lerpNumeric(current, target, key) {
  const rate = LERP_RATES[key] ?? LERP_RATES.default
  return lerp(current ?? 0, target ?? 0, rate)
}

/**
 * Smoothly interpolate current visualState toward target.
 * Non-numeric values snap. transitionState.progress steps by 0.002.
 * @param {object|null|undefined} current
 * @param {object|null|undefined} target
 * @returns {VisualState}
 */
export function lerpVisualState(current, target) {
  if (!target) return current ?? getVisualState(null)
  if (!current) return cloneVisualState(target)

  const moodChanged =
    current.transitionState?.toMood != null &&
    target.transitionState?.toMood != null &&
    current.transitionState.toMood !== target.transitionState.toMood

  const progress = moodChanged
    ? 0.002
    : clamp((current.transitionState?.progress ?? 1) + 0.002, 0, 1)
  const displayMood =
    progress >= 0.95
      ? target.transitionState?.toMood ?? target.sceneMood
      : current.sceneMood ?? target.sceneMood

  const out = {
    ...target,
    dominantEffect: target.dominantEffect,
    effectPriority: [...(target.effectPriority ?? [])],
    skyTintColor: target.skyTintColor,
    ambientTintColor: target.ambientTintColor,
    showRain: target.showRain,
    showLightning: target.showLightning,
    lightningFrequency: target.lightningFrequency,
    lightningRandomSeed: target.lightningRandomSeed,
    showSun: target.showSun,
    seasonalColorShift: target.seasonalColorShift,
    ambientParticles: target.ambientParticles,
    heatHaze: target.heatHaze,
    performanceMode: target.performanceMode,
    sceneMood: displayMood,
    transitionState: {
      fromMood: current.transitionState?.fromMood ?? current.sceneMood ?? 'clear',
      toMood: target.transitionState?.toMood ?? target.sceneMood,
      progress,
    },
    temporalNoise: computeTemporalNoise(),
    skyTintOpacity: lerpNumeric(current.skyTintOpacity, target.skyTintOpacity, 'skyTintOpacity'),
    vignetteOpacity: lerpNumeric(current.vignetteOpacity, target.vignetteOpacity, 'vignetteOpacity'),
    sceneExposure: lerpNumeric(current.sceneExposure, target.sceneExposure, 'sceneExposure'),
    ambientColorTemperature: lerpNumeric(
      current.ambientColorTemperature,
      target.ambientColorTemperature,
      'ambientColorTemperature',
    ),
    cloudOpacity: lerpNumeric(current.cloudOpacity, target.cloudOpacity, 'cloudOpacity'),
    cloudSpeed: lerpNumeric(current.cloudSpeed, target.cloudSpeed, 'cloudSpeed'),
    cloudSpeedVariance: lerpNumeric(
      current.cloudSpeedVariance,
      target.cloudSpeedVariance,
      'cloudSpeedVariance',
    ),
    cloudLayerCount: Math.round(
      lerpNumeric(current.cloudLayerCount, target.cloudLayerCount, 'cloudOpacity'),
    ),
    cloudShadowStrength: lerpNumeric(
      current.cloudShadowStrength,
      target.cloudShadowStrength,
      'default',
    ),
    rainDensity: lerpNumeric(current.rainDensity, target.rainDensity, 'rainDensity'),
    rainDensityNoise: target.rainDensityNoise,
    rainAngle: lerpNumeric(current.rainAngle, target.rainAngle, 'default'),
    rainSpeed: lerpNumeric(current.rainSpeed, target.rainSpeed, 'default'),
    rainOpacity: lerpNumeric(current.rainOpacity, target.rainOpacity, 'default'),
    sunIntensity: lerpNumeric(current.sunIntensity, target.sunIntensity, 'sunIntensity'),
    sunPosition: {
      x: lerpNumeric(current.sunPosition?.x, target.sunPosition?.x, 'default'),
      y: lerpNumeric(current.sunPosition?.y, target.sunPosition?.y, 'default'),
    },
    moonlightIntensity: lerpNumeric(
      current.moonlightIntensity,
      target.moonlightIntensity,
      'default',
    ),
    windIntensity: lerpNumeric(current.windIntensity, target.windIntensity, 'default'),
    windGustFactor: lerpNumeric(
      current.windGustFactor,
      target.windGustFactor,
      'windGustFactor',
    ),
    flagIntensity: lerpNumeric(current.flagIntensity, target.flagIntensity, 'default'),
    hazeOpacity: lerpNumeric(current.hazeOpacity, target.hazeOpacity, 'hazeOpacity'),
    hazeBreathing: target.hazeBreathing,
    fogOpacity: lerpNumeric(current.fogOpacity, target.fogOpacity, 'fogOpacity'),
    sceneContrast: lerpNumeric(current.sceneContrast, target.sceneContrast, 'default'),
    sceneSaturation: lerpNumeric(current.sceneSaturation, target.sceneSaturation, 'default'),
  }

  out.ambientTintColor = kelvinToRgba(out.ambientColorTemperature, 0.08)

  return out
}

/**
 * Stateful store for RAF-driven visual interpolation.
 * @returns {{
 *   current: VisualState|null,
 *   update: (weather: object|null|undefined) => VisualState,
 *   reset: (weather?: object|null|undefined) => VisualState,
 * }}
 */
export function createVisualStateStore() {
  /** @type {VisualState|null} */
  let current = null

  return {
    get current() {
      return current
    },

    /**
     * Compute target, lerp toward it, refresh temporal noise. Call each animation frame.
     * @param {object|null|undefined} weather
     * @returns {VisualState}
     */
    update(weather) {
      const previousMood = current?.sceneMood ?? null
      const transitionProgress = current?.transitionState?.progress ?? 1

      const target = getVisualState(weather, {
        previousMood: previousMood ?? getEnvironmentalState(weather).sceneMood,
        transitionProgress,
      })

      if (!current) {
        current = cloneVisualState(target)
        return current
      }

      current = lerpVisualState(current, target)
      return current
    },

    /**
     * Snap current state to target (no lerp). Use on first frame.
     * @param {object|null|undefined} [weather]
     * @returns {VisualState}
     */
    reset(weather) {
      const target = getVisualState(weather, { transitionProgress: 1 })
      current = cloneVisualState(target)
      return current
    },
  }
}
