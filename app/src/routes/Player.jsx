import React, { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { connectScreenCloud, getScreenCloud } from '@screencloud/apps-sdk'
import {
  buildCommunitySections,
  COMMUNITY_ROTATE_MS,
} from '../lib/communityDisplay'
import {
  createVisualStateStore,
  getVisualState,
  getEasternHour,
  getWindCardinal,
} from '../lib/weatherVisuals'

const DEFAULT_WEATHER = {
  temperature_f: 72,
  feels_like_f: 70,
  humidity: 55,
  wind_speed_mph: 8,
  wind_direction: 180,
  weather_code: 0,
  condition_text: 'Clear sky',
  cloud_cover: 15,
  uv_index: 6,
  precip_probability: null,
  is_day: 1,
}

const visualStore = createVisualStateStore()

const LOGO_URL =
  'https://xntieyqrodsjelotcmnr.supabase.co/storage/v1/object/public/assets/olde%20sycamore%20golf%20club%20logo.png'

const COURSE_PHOTO_URL =
  'https://xntieyqrodsjelotcmnr.supabase.co/storage/v1/object/public/assets/img-olde-sycamore-1.webp'

const TABLER_ICONS_URL =
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.47.0/dist/tabler-icons.min.css'

const ANNOUNCEMENTS = [
  'Tee times every 9 minutes · Book at oldesycamoregolf.com · 704-573-1000',
  'Restaurant & bar open daily · Burgers, pizza, sandwiches & local craft beers',
  "Men's Invitational · May 24–26 · Live scoring available in the app",
  'Membership available · No initiation fee · Call 704-573-1000 for details',
  'Greens top-dressed Tue & Wed · Front 9 only · Back 9 open all day',
  'Practice facility open 7 AM–7 PM · Driving range, chipping green & putting green',
]

const DEFAULT_COURSE_STATS = [
  { label: 'Greens', value: '11.2 ft' },
  { label: 'Fairways', value: 'Firm' },
  { label: 'Bunkers', value: 'Groomed' },
  { label: 'Cart', value: '90° Rule' },
]

const NOW_CONTEXT_LOCK_MS = 15 * 60 * 1000
const RAIN_FRAME_MS = 1000 / 45

const SLOT_IDS = {
  TOURNAMENT: 'tournament',
  PRO: 'pro',
  NOTICE: 'notice',
  TIPS: 'tips',
}

const ALL_SLOT_DEFS = [
  {
    id: SLOT_IDS.TOURNAMENT,
    label: 'Club tournament',
    dotColor: 'var(--os-green-badge)',
  },
  { id: SLOT_IDS.PRO, label: 'PGA Tour · live', dotColor: 'var(--os-blue)' },
  {
    id: SLOT_IDS.NOTICE,
    label: 'Course notice',
    dotColor: 'var(--os-amber)',
    requiresNotice: true,
  },
  { id: SLOT_IDS.TIPS, label: 'Course tips', dotColor: null },
]

const PRO_SHOP_ROWS = [
  { label: 'Pro shop', value: '7 AM – 6 PM' },
  { label: 'Bar & grill', value: '11 AM – 9 PM' },
  { label: 'Happy hour', value: '4–7 PM · $5 drafts', highlight: true },
  { label: "Today's special", value: 'Prime Rib Night' },
  { label: 'Cart rental', value: '$20 · Paths only today' },
  { label: 'Early bird', value: '7–9 AM · from $45' },
]

const DEMO_CLUB_LEADERBOARD = {
  title: "Men's Invitational · Round 2",
  rows: [
    { position: 1, name: 'J. Williams', score: -5, thru: 'F' },
    { position: 2, name: 'M. Thompson', score: -3, thru: 14 },
    { position: 3, name: 'R. Chen', score: -2, thru: 'F' },
    { position: 4, name: 'D. Martinez', score: 1, thru: 12 },
    { position: 5, name: 'T. Johnson', score: 2, thru: 'F' },
  ],
}

const DEMO_PRO_LEADERBOARD = {
  title: 'Charles Schwab Challenge',
  round: 'R3',
  rows: [
    { position: 1, flag: '🇺🇸', name: 'S. Scheffler', score: -18 },
    { position: 2, flag: '🇨🇦', name: 'C. Conners', score: -15 },
    { position: 3, flag: '🇺🇸', name: 'X. Schauffele', score: -14 },
    { position: 4, flag: '🇺🇸', name: 'P. Cantlay', score: -13 },
    { position: 5, flag: '🇯🇵', name: 'H. Matsuyama', score: -12 },
  ],
}

const SLOT_TOGGLE_KEYS = {
  [SLOT_IDS.TOURNAMENT]: 'tournament',
  [SLOT_IDS.PRO]: 'pgaTour',
  [SLOT_IDS.NOTICE]: 'courseNotice',
  [SLOT_IDS.TIPS]: 'courseTips',
}

function parseJsonField(val, fallback) {
  if (val == null) return fallback
  if (typeof val === 'object') return val
  try {
    return JSON.parse(val)
  } catch {
    return fallback
  }
}

function parseShowTagline(value) {
  if (value === true || value === false) return value
  if (value === 'true') return true
  if (value === 'false') return false
  return true
}

function normalizeClubSettingsRow(row) {
  if (!row) return null
  return {
    club_tagline: row.club_tagline,
    show_tagline: parseShowTagline(row.show_tagline),
    logo_url: row.logo_url,
    bg_photo_url: row.bg_photo_url,
    accent_color: row.accent_color,
    panel_bg: row.panel_bg,
    panel_bg_custom: row.panel_bg_custom,
    pro_shop_title: row.pro_shop_title,
    pro_shop_rows: parseJsonField(row.pro_shop_rows, []),
    community_items: parseJsonField(row.community_items, {}),
    tournament_data: parseJsonField(row.tournament_data, null),
    display_slots: parseJsonField(row.display_slots, null),
  }
}

function parseTournamentScore(score) {
  const s = String(score ?? '').trim()
  if (s === 'E' || s === 'e') return 0
  if (s.startsWith('-')) return parseInt(s, 10) || 0
  if (s.startsWith('+')) return parseInt(s.slice(1), 10) || 0
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : 0
}

function buildTournamentLeaderboard(td) {
  if (!td?.rows?.length) return DEMO_CLUB_LEADERBOARD
  const rows = td.rows
    .filter((r) => r.enabled !== false)
    .map((r) => ({
      position: r.position,
      name: r.name,
      score: parseTournamentScore(r.score),
      thru: r.thru,
    }))
  if (!rows.length) return DEMO_CLUB_LEADERBOARD
  return {
    title: `${td.name || 'Tournament'} · ${td.round || 'Round 2'}`,
    rows,
  }
}

function formatGreensSpeed(val) {
  const n = Number(val)
  if (!Number.isFinite(n)) return '—'
  const rounded = Math.round(n * 10) / 10
  return `${rounded} ft`
}

function capitalizeFirst(str) {
  if (!str) return '—'
  const s = String(str).trim()
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function formatProShopLabel(label) {
  const s = String(label || '').trim()
  if (!s) return '—'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatCartRule(rule) {
  if (!rule) return '—'
  const s = rule.toLowerCase()
  if (s.includes('path')) return 'Paths Only'
  if (s.includes('90')) return '90° Rule'
  if (s.includes('fairway')) return 'Fairways Open'
  return rule
}

function normalizeCourseStatusKey(status) {
  const s = (status || 'open')
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (s === 'closed' || s.includes('closed')) return 'closed'
  if (s.includes('frost')) return 'frost-delay'
  if (s.includes('rain')) return 'rain-delay'
  if (s.includes('maintenance')) return 'maintenance'
  if (s.includes('back') && s.includes('9')) return 'back-9-only'
  if (s.includes('front') && s.includes('9')) return 'front-9-only'
  return 'open'
}

const STATUS_BADGE_LABELS = {
  open: 'OPEN',
  'frost-delay': 'FROST DELAY',
  'rain-delay': 'RAIN DELAY',
  maintenance: 'MAINTENANCE',
  'back-9-only': 'BACK 9 ONLY',
  'front-9-only': 'FRONT 9 ONLY',
  closed: 'CLOSED',
}

function getStatusBadgeLabel(status) {
  const key = normalizeCourseStatusKey(status)
  return STATUS_BADGE_LABELS[key] || 'OPEN'
}

function getStatusBadgeStyle(status) {
  const key = normalizeCourseStatusKey(status)
  if (key === 'closed') {
    return {
      background: 'rgba(127,29,29,0.82)',
      border: '0.5px solid rgba(248,113,113,0.55)',
      color: 'var(--os-red)',
    }
  }
  if (key === 'frost-delay' || key === 'rain-delay') {
    return {
      background: 'rgba(29,78,216,0.72)',
      border: '0.5px solid rgba(96,165,250,0.55)',
      color: '#93c5fd',
    }
  }
  if (key === 'maintenance' || key === 'back-9-only' || key === 'front-9-only') {
    return {
      background: 'rgba(120,53,15,0.72)',
      border: '0.5px solid rgba(251,191,36,0.55)',
      color: '#fbbf24',
    }
  }
  return {
    background: 'rgba(16,68,36,0.82)',
    border: '0.5px solid rgba(74,222,128,0.55)',
    color: '#ecfdf5',
  }
}

function toNum(val) {
  if (val == null || val === '') return null
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

function normalizeWeatherRow(row) {
  if (!row) return null
  return {
    ...row,
    temperature_f: toNum(row.temperature_f),
    feels_like_f: toNum(row.feels_like_f),
    humidity: toNum(row.humidity),
    wind_speed_mph: toNum(row.wind_speed_mph),
    wind_direction: toNum(row.wind_direction),
    weather_code: toNum(row.weather_code),
    cloud_cover: toNum(row.cloud_cover),
    uv_index: toNum(row.uv_index),
    precip_probability: toNum(row.precip_probability),
    is_day: toNum(row.is_day),
    sunrise_at: row.sunrise_at ?? null,
    sunset_at: row.sunset_at ?? null,
    fetched_at: row.fetched_at ?? row.updated_at ?? null,
  }
}

function formatSunTime(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function parseHourlyForecast(hf) {
  if (!hf) return null
  if (typeof hf === 'string') {
    try {
      return JSON.parse(hf)
    } catch {
      return null
    }
  }
  return hf
}

function parseSlotHour(isoOrTime) {
  const s = String(isoOrTime)
  if (s.includes('T')) {
    return getEasternHour(new Date(s))
  }
  const match = s.match(/^(\d{1,2}):/)
  return match ? parseInt(match[1], 10) : 0
}

function formatHourCompact(isoOrTime) {
  if (!isoOrTime) return '—'
  const s = String(isoOrTime)
  let h = 0
  if (s.includes('T')) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      h = parseInt(
        d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          hour12: false,
          timeZone: 'America/New_York',
        }),
        10,
      )
    }
  } else {
    const match = s.match(/^(\d{1,2}):/)
    if (match) h = parseInt(match[1], 10)
    else return s
  }
  const hour12 = h % 12 === 0 ? 12 : h % 12
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${hour12} ${suffix}`
}

function getCurrentHourlyIndex(hourly, referenceDate) {
  const epochs = hourly?.time_epoch
  if (Array.isArray(epochs) && epochs.length > 0) {
    const nowSec = Math.floor(referenceDate.getTime() / 1000)
    for (let i = 0; i < epochs.length; i++) {
      if (Number(epochs[i]) >= nowSec - 1800) return i
    }
    return epochs.length - 1
  }

  const times = hourly?.time || []
  if (times.length === 0) return -1

  const currentHour = getEasternHour(referenceDate)
  for (let i = 0; i < times.length; i++) {
    if (parseSlotHour(times[i]) >= currentHour) return i
  }
  return times.length - 1
}

function getDisplayTemperature(weather, hourly, referenceDate) {
  if (hourly?.temperature) {
    const idx = getCurrentHourlyIndex(hourly, referenceDate)
    if (idx >= 0) {
      const hourlyTemp = toNum(hourly.temperature[idx])
      if (hourlyTemp != null) return hourlyTemp
    }
  }
  return toNum(weather?.temperature_f)
}

function getForecastSlots(hourly, referenceDate) {
  const times = hourly?.time || []
  if (times.length === 0) return []

  const start = Math.max(0, getCurrentHourlyIndex(hourly, referenceDate))

  const slots = []
  for (let j = 0; j < 6; j++) {
    const i = start + j
    if (i >= times.length) break
    slots.push({
      time: times[i],
      temp: toNum(hourly.temperature?.[i]),
      precip: toNum(hourly.precip_probability?.[i]),
    })
  }
  return slots
}

function getUvLabel(uv) {
  if (uv == null) return '—'
  if (uv <= 2) return 'Low'
  if (uv <= 5) return 'Moderate'
  if (uv <= 7) return 'High'
  if (uv <= 10) return 'Very High'
  return 'Extreme'
}

function getUvRowText(uv) {
  if (uv == null) return '—'
  return `${uv} · ${getUvLabel(uv)}`
}

function isRainStormCode(code) {
  if (code == null) return false
  if (code >= 95) return true
  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)
}

function getPhotoFilter(weather, easternHour) {
  const code = weather?.weather_code ?? 0
  const cloud = weather?.cloud_cover ?? 0
  const precip = weather?.precip_probability ?? 0
  const isDay = weather?.is_day === 1 || weather?.is_day === true

  if (!isDay) {
    return 'brightness(0.30) saturate(0.45) contrast(1.12)'
  }
  if (code >= 95) {
    return 'brightness(0.70) saturate(0.55) contrast(1.06)'
  }
  if (precip > 40 || isRainStormCode(code)) {
    return 'brightness(0.80) saturate(0.68) contrast(0.94)'
  }
  if (easternHour >= 17 && easternHour <= 20) {
    return 'brightness(1.02) saturate(1.20) contrast(0.98) sepia(0.12)'
  }
  if ((code >= 45 && code <= 48) || cloud > 70) {
    return 'brightness(0.88) saturate(0.78) contrast(0.96)'
  }
  if (code === 3) {
    return 'brightness(0.98) saturate(0.95)'
  }
  if (code >= 0 && code <= 2) {
    return 'brightness(1.05) saturate(1.10) contrast(1.02)'
  }
  return 'brightness(1.05) saturate(1.10) contrast(1.02)'
}

function formatDurationShort(totalMinutes) {
  const mins = Math.max(0, Math.round(totalMinutes))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}hr ${m}min`
  if (h > 0) return `${h}hr`
  return `${m}min`
}

function findRainArrivalMinutes(hourly, referenceDate) {
  const epochs = hourly?.time_epoch
  const precips = hourly?.precip_probability
  if (!Array.isArray(epochs) || !Array.isArray(precips)) return null

  const nowSec = Math.floor(referenceDate.getTime() / 1000)
  for (let i = 0; i < epochs.length; i++) {
    const p = toNum(precips[i])
    if (p != null && p > 50) {
      const diffMin = Math.round((Number(epochs[i]) - nowSec) / 60)
      if (diffMin > 0 && diffMin <= 120) return diffMin
    }
  }
  return null
}

function minutesUntilSunset(sunsetAt, referenceDate) {
  if (!sunsetAt) return null
  const sunset = new Date(sunsetAt)
  if (isNaN(sunset.getTime())) return null
  const diffMin = Math.round((sunset.getTime() - referenceDate.getTime()) / 60000)
  if (diffMin <= 0 || diffMin > 120) return null
  return diffMin
}

function getNowContext(weather, sunriseAt, sunsetAt, hourly, referenceDate) {
  const precip = weather?.precip_probability ?? 0
  const code = weather?.weather_code ?? 0
  const wind = weather?.wind_speed_mph ?? 0
  const uv = weather?.uv_index ?? 0
  const temp = weather?.temperature_f ?? 0
  const isDay = weather?.is_day === 1 || weather?.is_day === true
  const hour = getEasternHour(referenceDate)

  if (precip >= 80) {
    return { message: 'Heavy rain expected — check with pro shop', severe: true }
  }
  if (precip >= 50) {
    const arrivalMin = findRainArrivalMinutes(hourly, referenceDate)
    if (arrivalMin != null) {
      return { message: `Rain arriving in ~${formatDurationShort(arrivalMin)}`, severe: false }
    }
    return { message: 'Rain likely this afternoon', severe: false }
  }
  if (code >= 95) {
    return { message: 'Thunderstorm activity — course may close', severe: true }
  }
  if (isDay && sunsetAt) {
    const untilSunset = minutesUntilSunset(sunsetAt, referenceDate)
    if (untilSunset != null) {
      return { message: `Sunset in ${formatDurationShort(untilSunset)}`, severe: false }
    }
  }
  if (wind >= 15) {
    return { message: 'Strong winds today — club up on approach shots', severe: false }
  }
  if (uv >= 8) {
    return { message: 'Very high UV — sunscreen essential today', severe: false }
  }
  if (temp >= 95) {
    return { message: 'Heat advisory — stay hydrated on course', severe: false }
  }
  if (hour >= 16 && isDay) {
    return { message: 'Twilight rates available — check pro shop', severe: false }
  }

  return null
}

function getRainParticleCount(precipProb) {
  const p = precipProb ?? 0
  if (p <= 40) return 0
  if (p > 60) return 150
  return 82
}

function getRainLayerTargetOpacity(precipProb, reducedMotion) {
  if (reducedMotion) return 0
  const p = precipProb ?? 0
  if (p <= 40) return 0
  if (p >= 58) return 0.72
  return ((p - 40) / 18) * 0.72
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return reduced
}

function RainCanvas({ active, particleCount }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const particlesRef = useRef([])
  const lastFrameRef = useRef(0)

  useEffect(() => {
    if (!active || particleCount <= 0) return undefined

    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const angleRad = (11 * Math.PI) / 180
    const driftX = Math.sin(angleRad)
    const driftY = Math.cos(angleRad)

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const w = parent.clientWidth
      const h = parent.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const spawnParticle = (w, h, fromTop = false) => {
      const edgeBias = Math.random() < 0.62
      let x
      let y
      if (edgeBias) {
        const band = Math.random()
        if (band < 0.28) x = Math.random() * w * 0.22
        else if (band < 0.56) x = w * 0.78 + Math.random() * w * 0.22
        else x = Math.random() * w
        y = fromTop
          ? -Math.random() * h * 0.35 - 16
          : Math.random() * h * 0.55
      } else {
        x = Math.random() * (w + 80) - 40
        y = fromTop ? -Math.random() * h * 0.4 - 20 : Math.random() * (h + 40)
      }
      return {
        x,
        y,
        speed: 11 + Math.random() * 9,
        length: 16 + Math.random() * 18,
        opacity: 0.12 + Math.random() * 0.14,
        width: Math.random() < 0.2 ? 1.5 : 1,
      }
    }

    const initParticles = () => {
      const w = canvas.clientWidth || 800
      const h = canvas.clientHeight || 600
      particlesRef.current = Array.from({ length: particleCount }, () =>
        spawnParticle(w, h, false),
      )
    }

    resize()
    initParticles()
    window.addEventListener('resize', resize)

    const draw = (timestamp) => {
      rafRef.current = requestAnimationFrame(draw)
      if (timestamp - lastFrameRef.current < RAIN_FRAME_MS) return
      lastFrameRef.current = timestamp

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w <= 0 || h <= 0) return

      ctx.clearRect(0, 0, w, h)
      ctx.lineCap = 'round'

      const cx = w * 0.42
      const cy = h * 0.4
      const falloffScale = Math.max(w, h) * 0.52

      for (const p of particlesRef.current) {
        const step = p.speed
        const tailX = p.x - driftX * p.length
        const tailY = p.y - driftY * p.length
        const dist = Math.hypot(p.x - cx, p.y - cy) / falloffScale
        const centerFactor = 0.5 + 0.5 * Math.min(1, dist)
        const alpha = p.opacity * centerFactor

        ctx.strokeStyle = `rgba(185, 202, 218, ${alpha})`
        ctx.lineWidth = p.width
        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()

        p.x += driftX * step
        p.y += driftY * step

        if (p.y > h + p.length + 20 || p.x < -60 || p.x > w + 60) {
          Object.assign(p, spawnParticle(w, h, true))
        }
      }
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [active, particleCount])

  if (!active || particleCount <= 0) return null

  return <canvas ref={canvasRef} className="rain-canvas" aria-hidden="true" />
}

function getGolferTips(
  weatherCode,
  windSpeed,
  uvIndex,
  precipProb,
  isDay,
  hour,
  sunriseLabel,
) {
  const code = weatherCode ?? 0
  const wind = windSpeed ?? 0
  const uv = uvIndex ?? 0
  const precip = precipProb ?? 0
  const day = isDay === 1 || isDay === true
  const h = hour ?? 12

  const defaultTips = [
    {
      icon: 'flag',
      text: 'Course in excellent condition. Greens running 11.2 ft today.',
    },
    {
      icon: 'droplet',
      text: 'Cart paths only until 10 AM after overnight moisture.',
    },
    {
      icon: 'users',
      text: 'Peak hours 8–11 AM. Book ahead to guarantee your preferred time.',
    },
  ]

  if (code >= 95) {
    return [
      {
        icon: 'alert-triangle',
        text: 'Course closed — thunderstorm. Return to clubhouse immediately.',
      },
      {
        icon: 'clock',
        text: 'Check with pro shop for updated tee times once storm clears.',
      },
      {
        icon: 'building',
        text: '19th Hole Grill open. Happy hour pricing active during weather delay.',
      },
    ]
  }

  if (precip > 60 || isRainStormCode(code)) {
    return [
      {
        icon: 'umbrella',
        text: 'Rain advisory in effect. Course open — bring waterproof gear.',
      },
      {
        icon: 'alert-triangle',
        text: 'Lightning protocol: course horn sounds if lightning within 8 miles. Seek shelter.',
      },
      {
        icon: 'droplet',
        text: 'Soft conditions expected. Low irons check up quickly on greens.',
      },
    ]
  }

  if (!day) {
    const openLine =
      sunriseLabel && sunriseLabel !== '—'
        ? `Course closed. Opens at sunrise, ${sunriseLabel} tomorrow.`
        : 'Course closed. Opens at sunrise tomorrow.'
    return [
      { icon: 'moon', text: openLine },
      {
        icon: 'phone',
        text: "Book tomorrow's tee time at oldesycamoregolf.com.",
      },
      {
        icon: 'star',
        text: 'Practice facility lights available until 10 PM.',
      },
    ]
  }

  if (uv >= 8) {
    return [
      {
        icon: 'sun',
        text: `UV index ${uv} (Very High). Apply SPF 50+ before your round.`,
      },
      defaultTips[1],
      defaultTips[2],
    ]
  }

  if (uv >= 6) {
    return [
      {
        icon: 'sun',
        text: `UV index ${uv} (High). Sunscreen recommended.`,
      },
      defaultTips[0],
      defaultTips[2],
    ]
  }

  if (wind >= 15) {
    return [
      {
        icon: 'wind',
        text: `Strong ${Math.round(wind)} mph wind. Club up 1-2 on approach shots.`,
      },
      defaultTips[0],
      defaultTips[2],
    ]
  }

  if (wind >= 8) {
    return [
      {
        icon: 'wind',
        text: `${Math.round(wind)} mph wind. Factor into club selection on par 3s.`,
      },
      defaultTips[0],
      defaultTips[1],
    ]
  }

  if (h >= 17 && day) {
    return [
      {
        icon: 'clock',
        text: 'Twilight rates start at 5 PM — $45 walking, $60 cart.',
      },
      {
        icon: 'sun',
        text: 'Approx. 2 hrs of daylight remaining for a full round.',
      },
      defaultTips[2],
    ]
  }

  return defaultTips
}

function TablerIcon({ name }) {
  return <i className={`ti ti-${name}`} aria-hidden="true" />
}

function getTipAccent(icon) {
  const accents = {
    sun: { color: '#f0d080', bg: 'rgba(251, 191, 36, 0.18)', label: 'Sun & UV' },
    wind: { color: '#8ec8f0', bg: 'rgba(96, 165, 250, 0.16)', label: 'Wind' },
    droplet: { color: '#7eb8f5', bg: 'rgba(96, 165, 250, 0.14)', label: 'Course' },
    umbrella: { color: '#7eb8f5', bg: 'rgba(96, 165, 250, 0.18)', label: 'Rain' },
    'alert-triangle': { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.18)', label: 'Alert' },
    flag: { color: '#9ecf7a', bg: 'rgba(122, 182, 72, 0.18)', label: 'Conditions' },
    users: { color: '#d4b896', bg: 'rgba(212, 184, 150, 0.16)', label: 'Tee times' },
    clock: { color: '#e8d4a8', bg: 'rgba(232, 212, 168, 0.16)', label: 'Hours' },
    moon: { color: '#c4b5fd', bg: 'rgba(196, 181, 253, 0.14)', label: 'After hours' },
    phone: { color: '#9ec8e8', bg: 'rgba(158, 200, 232, 0.14)', label: 'Book online' },
    star: { color: '#f0d080', bg: 'rgba(251, 191, 36, 0.14)', label: 'Practice' },
    building: { color: '#e8d4a8', bg: 'rgba(232, 212, 168, 0.16)', label: 'Dining' },
  }
  return accents[icon] || { color: '#9ecf7a', bg: 'rgba(122, 182, 72, 0.16)', label: 'Tip' }
}

function formatClubScore(score) {
  if (score === 0) return { text: 'E', tone: 'even' }
  if (score < 0) return { text: String(score), tone: 'under' }
  return { text: `+${score}`, tone: 'over' }
}

function formatThruDisplay(thru) {
  if (thru === 'F' || thru === 'f') return 'F'
  return `${thru} ♦`
}

function renderClubTournament({ title, rows } = DEMO_CLUB_LEADERBOARD) {
  return (
    <div className="slot-leaderboard">
      <div className="slot-subheader">
        <p className="slot-title slot-title-tournament">{title}</p>
        <p className="slot-live">● Live</p>
      </div>
      {rows.map((row, i) => {
        const score = formatClubScore(row.score)
        return (
          <div
            key={row.position}
            className={`lb-row${i < rows.length - 1 ? ' lb-row-border' : ''}`}
          >
            <span className="lb-pos">{row.position}</span>
            <span className="lb-name">{row.name}</span>
            <span className={`lb-score lb-score-${score.tone}`}>
              {score.text}
            </span>
            <span className="lb-thru">{formatThruDisplay(row.thru)}</span>
          </div>
        )
      })}
    </div>
  )
}

function renderProLeaderboard({
  title,
  round,
  rows,
} = DEMO_PRO_LEADERBOARD) {
  return (
    <div className="slot-leaderboard slot-pro">
      <div className="slot-subheader slot-subheader-pro">
        <p className="slot-title">{title}</p>
        <p className="slot-round">{round}</p>
      </div>
      {rows.map((row, i) => (
        <div
          key={row.position}
          className={`lb-row${i < rows.length - 1 ? ' lb-row-border' : ''}`}
        >
          <span className="lb-pos">{row.position}</span>
          <span className="lb-flag">{row.flag}</span>
          <span className="lb-name">{row.name}</span>
          <span className="lb-score lb-score-under">{row.score}</span>
        </div>
      ))}
      <p className="slot-powered">Powered by Sportradar</p>
    </div>
  )
}

function formatTempAria(display) {
  if (display == null || display === '--') return 'Temperature unavailable'
  return `${display} degrees Fahrenheit`
}

function formatFeelsAria(display) {
  if (display == null || display === '--') return 'Feels like temperature unavailable'
  return `Feels like ${display} degrees Fahrenheit`
}

function renderPanelForecast(slots) {
  if (!slots || slots.length === 0) {
    return <p className="panel-forecast-empty">Forecast unavailable</p>
  }

  return (
    <div className="panel-forecast" role="list" aria-label="Hourly forecast">
      {slots.map((slot, i) => {
        const precipVal = slot.precip ?? 0
        const rainHigh = precipVal >= 30
        const timeLabel = formatHourCompact(slot.time)
        const tempLabel =
          slot.temp != null ? `${Math.round(slot.temp)} degrees` : 'temperature unavailable'
        const rainLabel =
          slot.precip != null
            ? `${Math.round(precipVal)} percent chance of rain`
            : 'rain chance unavailable'
        return (
          <div
            key={`${slot.time}-${i}`}
            role="listitem"
            className={`panel-forecast-col${i < slots.length - 1 ? ' panel-forecast-col-divider' : ''}`}
            aria-label={`${timeLabel}, ${tempLabel}, ${rainLabel}`}
          >
            <p className="panel-forecast-time" aria-hidden="true">
              {timeLabel}
            </p>
            <p className="panel-forecast-temp" aria-hidden="true">
              {slot.temp != null ? (
                <>
                  {Math.round(slot.temp)}
                  <sup className="panel-temp-degree">°</sup>
                </>
              ) : (
                '—'
              )}
            </p>
            <p
              className={`panel-forecast-rain${rainHigh ? ' panel-forecast-rain-high' : ''}`}
              aria-hidden="true"
            >
              {slot.precip != null ? `${Math.round(precipVal)}%` : '—'}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function renderCourseNotice(notice) {
  return (
    <div className="slot-notice">
      <p className="slot-notice-text">{notice}</p>
      <div className="slot-notice-divider" aria-hidden="true" />
      <p className="slot-notice-byline">Posted by Olde Sycamore Golf Club</p>
    </div>
  )
}

function renderGolferTips(tips) {
  return (
    <div className="slot-tips">
      {tips.map((tip, i) => {
        const accent = getTipAccent(tip.icon)
        return (
          <div
            key={i}
            className="tip-card"
            style={{
              borderLeftColor: accent.color,
              background: `linear-gradient(90deg, ${accent.bg} 0%, transparent 72%)`,
            }}
          >
            <div
              className="tip-icon-wrap"
              style={{ background: accent.bg, color: accent.color }}
            >
              <TablerIcon name={tip.icon} />
            </div>
            <div className="tip-body">
              <p className="tip-label" style={{ color: accent.color }}>
                {accent.label}
              </p>
              <p className="tip-text">{tip.text}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function renderCardSlot(slotId, { tipsForCard, courseNotice, tournamentLeaderboard }) {
  switch (slotId) {
    case SLOT_IDS.TOURNAMENT:
      return renderClubTournament(tournamentLeaderboard)
    case SLOT_IDS.PRO:
      return renderProLeaderboard(DEMO_PRO_LEADERBOARD)
    case SLOT_IDS.NOTICE:
      return renderCourseNotice(courseNotice)
    case SLOT_IDS.TIPS:
      return renderGolferTips(tipsForCard)
    default:
      return null
  }
}

export default function Player() {
  const [weather, setWeather] = useState(null)
  const [courseStatus, setCourseStatus] = useState(null)
  const [clubSettings, setClubSettings] = useState(null)
  const [error, setError] = useState(null)
  const [started, setStarted] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [messageIndex, setMessageIndex] = useState(0)
  const [, setFrame] = useState(0)
  const [activeSlotIndex, setActiveSlotIndex] = useState(0)
  const [cardFade, setCardFade] = useState(1)
  const [communityIndex, setCommunityIndex] = useState(0)
  const [communityFade, setCommunityFade] = useState(1)
  const hasResetVisuals = useRef(false)
  const fadeTimeoutRef = useRef(null)
  const communityFadeTimeoutRef = useRef(null)
  const nowContextLockRef = useRef({ message: null, lockUntil: 0 })
  const prefersReducedMotion = usePrefersReducedMotion()
  const [nowContextLine, setNowContextLine] = useState(null)

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = TABLER_ICONS_URL
    document.head.appendChild(link)
    return () => {
      if (link.parentNode) link.parentNode.removeChild(link)
    }
  }, [])

  useEffect(() => {
    let subscribed = true

    async function init() {
      try {
        await connectScreenCloud()
        const sc = getScreenCloud()
        await sc.onAppStarted()
        if (subscribed) setStarted(true)
      } catch (e) {
        console.log('Not running inside ScreenCloud player (or dev mode)', e)
        if (subscribed) setStarted(true)
      }
    }

    init()
    return () => {
      subscribed = false
    }
  }, [])

  useEffect(() => {
    let subscription
    let cancelled = false

    async function loadWeather() {
      const { data, error: fetchError } = await supabase
        .from('weather_cache')
        .select('*')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      if (fetchError) {
        setError(fetchError.message)
        setWeather(null)
        return
      }

      const row = normalizeWeatherRow(data)
      if (!row) {
        setError('No weather in cache — run the fetch-weather edge function.')
        setWeather(null)
        return
      }

      setError(null)
      setWeather(row)
    }

    loadWeather()

    subscription = supabase
      .channel('weather-cache-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weather_cache' },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          const row = normalizeWeatherRow(payload.new)
          if (row) {
            setError(null)
            setWeather(row)
          }
        },
      )
      .subscribe()

    const interval = setInterval(loadWeather, 60000)

    return () => {
      cancelled = true
      subscription?.unsubscribe()
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let subscription
    let cancelled = false

    async function loadCourseStatus() {
      const { data, error: fetchError } = await supabase
        .from('course_status')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return
      if (fetchError) {
        console.warn('[Player] course_status load failed:', fetchError.message)
        return
      }
      if (data) setCourseStatus(data)
    }

    loadCourseStatus()

    subscription = supabase
      .channel('player-course-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'course_status' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            loadCourseStatus()
            return
          }
          if (payload.new && typeof payload.new === 'object') {
            setCourseStatus(payload.new)
            return
          }
          loadCourseStatus()
        },
      )
      .subscribe()

    const pollId = setInterval(loadCourseStatus, 60000)

    return () => {
      cancelled = true
      clearInterval(pollId)
      subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let subscription
    let cancelled = false

    async function loadClubSettings() {
      const { data, error: fetchError } = await supabase
        .from('club_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return
      if (fetchError) {
        console.warn('[Player] club_settings load failed:', fetchError.message)
        return
      }
      setClubSettings(normalizeClubSettingsRow(data))
    }

    loadClubSettings()

    subscription = supabase
      .channel('player-club-settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'club_settings' },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          setClubSettings(normalizeClubSettingsRow(payload.new))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const tick = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const rotate = setInterval(
      () => setMessageIndex((i) => (i + 1) % ANNOUNCEMENTS.length),
      6500,
    )
    return () => clearInterval(rotate)
  }, [])

  const courseNotice = courseStatus?.daily_note?.trim() || ''

  const accentColor = clubSettings?.accent_color || '#7ab648'
  const logoUrl = clubSettings?.logo_url || LOGO_URL
  const coursePhotoUrl = clubSettings?.bg_photo_url || COURSE_PHOTO_URL
  const showTagline = clubSettings?.show_tagline === true
  const clubTagline = clubSettings?.club_tagline || '18 holes · Est. 1997'

  const tournamentLeaderboard = useMemo(
    () => buildTournamentLeaderboard(clubSettings?.tournament_data),
    [clubSettings?.tournament_data],
  )

  const proShopRows = useMemo(() => {
    const rows = clubSettings?.pro_shop_rows
    if (!rows?.length) return PRO_SHOP_ROWS
    const enabled = rows.filter((r) => r.enabled !== false)
    if (!enabled.length) return PRO_SHOP_ROWS
    return enabled.map((r) => ({
      label: formatProShopLabel(r.label),
      value: r.value,
      highlight: r.highlight,
    }))
  }, [clubSettings?.pro_shop_rows])

  const proShopTitle = clubSettings?.pro_shop_title || 'Pro Shop & Dining'

  const communitySections = useMemo(
    () => buildCommunitySections(clubSettings?.community_items),
    [clubSettings?.community_items],
  )

  const communityAchievements = communitySections.achievements
  const communityEvents = communitySections.events

  const activeAchievement =
    communityAchievements[communityIndex % communityAchievements.length] ??
    communityAchievements[0]

  const showPanelWeather = clubSettings?.display_slots?.panel?.weather !== false
  const showPanelProShop = clubSettings?.display_slots?.panel?.proShop !== false
  const showPanelCommunity = clubSettings?.display_slots?.panel?.community !== false

  const activeSlots = useMemo(() => {
    const center = clubSettings?.display_slots?.center
    return ALL_SLOT_DEFS.filter((s) => {
      const toggleKey = SLOT_TOGGLE_KEYS[s.id]
      if (toggleKey && center && center[toggleKey] === false) return false
      if (s.requiresNotice && !courseNotice) return false
      return true
    })
  }, [clubSettings?.display_slots, courseNotice])

  useEffect(() => {
    setActiveSlotIndex(0)
    setCardFade(1)
  }, [activeSlots.length, courseNotice])

  useEffect(() => {
    if (activeSlots.length === 0 || prefersReducedMotion) return

    const intervalId = setInterval(() => {
      setCardFade(0)
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
      fadeTimeoutRef.current = setTimeout(() => {
        setActiveSlotIndex((i) => (i + 1) % activeSlots.length)
        setCardFade(1)
      }, 300)
    }, 10000)

    return () => {
      clearInterval(intervalId)
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
    }
  }, [activeSlots.length, prefersReducedMotion])

  useEffect(() => {
    setCommunityIndex(0)
    setCommunityFade(1)
  }, [communityAchievements])

  useEffect(() => {
    if (communityAchievements.length <= 1) {
      setCommunityFade(1)
      return undefined
    }

    const advance = () => {
      setCommunityIndex((i) => (i + 1) % communityAchievements.length)
    }

    if (prefersReducedMotion) {
      setCommunityFade(1)
      const intervalId = setInterval(advance, COMMUNITY_ROTATE_MS)
      return () => clearInterval(intervalId)
    }

    const intervalId = setInterval(() => {
      setCommunityFade(0)
      if (communityFadeTimeoutRef.current) clearTimeout(communityFadeTimeoutRef.current)
      communityFadeTimeoutRef.current = setTimeout(() => {
        advance()
        setCommunityFade(1)
      }, 300)
    }, COMMUNITY_ROTATE_MS)

    return () => {
      clearInterval(intervalId)
      if (communityFadeTimeoutRef.current) clearTimeout(communityFadeTimeoutRef.current)
      setCommunityFade(1)
    }
  }, [communityAchievements.length, prefersReducedMotion])

  useEffect(() => {
    if (!started) return

    let rafId

    const tick = () => {
      const data = weather ?? DEFAULT_WEATHER
      if (!hasResetVisuals.current) {
        visualStore.reset(data)
        hasResetVisuals.current = true
      } else {
        visualStore.update(data)
      }
      setFrame((n) => n + 1)
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [started, weather])

  const visualWeather = weather ?? DEFAULT_WEATHER
  const hourly = useMemo(
    () => parseHourlyForecast(weather?.hourly_forecast),
    [weather?.hourly_forecast],
  )
  const precipProb = weather?.precip_probability ?? null
  const windSpeed = weather?.wind_speed_mph ?? null
  const windDir = weather?.wind_direction ?? null
  const sunriseDisplay = formatSunTime(weather?.sunrise_at)
  const sunsetDisplay = formatSunTime(weather?.sunset_at)
  const easternHour = getEasternHour(clock)

  const visual = visualStore.current ?? getVisualState(visualWeather)
  void visual

  const photoFilter = useMemo(
    () => getPhotoFilter(visualWeather, easternHour),
    [visualWeather, easternHour],
  )

  const rainParticleCount = getRainParticleCount(precipProb)
  const rainTargetOpacity = getRainLayerTargetOpacity(precipProb, prefersReducedMotion)

  const sceneGradientOpacity = useMemo(() => {
    const code = visualWeather?.weather_code ?? 0
    const precip = precipProb ?? 0
    const isDay = visualWeather?.is_day === 1 || visualWeather?.is_day === true
    if (!isDay) return 1.12
    if (code >= 95 || precip > 55) return 1.1
    if (precip > 40 || isRainStormCode(code)) return 1.05
    if (easternHour >= 17 && easternHour <= 20) return 0.92
    return 1
  }, [visualWeather?.weather_code, visualWeather?.is_day, precipProb, easternHour])

  const displayTemp = useMemo(
    () => getDisplayTemperature(weather, hourly, clock),
    [weather, hourly, clock],
  )
  const tempDisplay = displayTemp != null ? Math.round(displayTemp) : '--'
  const feelsDisplay =
    weather?.feels_like_f != null ? Math.round(weather.feels_like_f) : '--'

  const windLabel =
    windSpeed != null
      ? `${getWindCardinal(windDir ?? 0)} ${Math.round(windSpeed)} mph`
      : '—'

  const uvValue = weather?.uv_index
  const uvRowText = getUvRowText(uvValue)

  const forecastSlots = useMemo(() => {
    if (!hourly) return []
    return getForecastSlots(hourly, clock)
  }, [hourly, clock])

  useEffect(() => {
    const raw = getNowContext(
      visualWeather,
      visualWeather?.sunrise_at,
      visualWeather?.sunset_at,
      hourly,
      clock,
    )
    const now = Date.now()
    const lock = nowContextLockRef.current

    if (!raw) {
      nowContextLockRef.current = { message: null, lockUntil: 0 }
      setNowContextLine(null)
      return
    }

    if (raw.severe) {
      nowContextLockRef.current = {
        message: raw.message,
        lockUntil: now + NOW_CONTEXT_LOCK_MS,
      }
      setNowContextLine(raw.message)
      return
    }

    if (lock.message && now < lock.lockUntil) {
      return
    }

    nowContextLockRef.current = {
      message: raw.message,
      lockUntil: now + NOW_CONTEXT_LOCK_MS,
    }
    setNowContextLine(raw.message)
  }, [
    visualWeather,
    visualWeather?.precip_probability,
    visualWeather?.weather_code,
    visualWeather?.wind_speed_mph,
    visualWeather?.uv_index,
    visualWeather?.temperature_f,
    visualWeather?.is_day,
    visualWeather?.sunrise_at,
    visualWeather?.sunset_at,
    hourly,
    clock,
  ])

  const conditionItems = useMemo(() => {
    if (!courseStatus) return DEFAULT_COURSE_STATS
    return [
      { label: 'Greens', value: formatGreensSpeed(courseStatus.greens_speed) },
      {
        label: 'Fairways',
        value: capitalizeFirst(courseStatus.fairway_condition),
      },
      {
        label: 'Bunkers',
        value: capitalizeFirst(courseStatus.bunker_condition),
      },
      { label: 'Cart', value: formatCartRule(courseStatus.cart_rule) },
    ]
  }, [courseStatus])

  const statusBadgeLabel = getStatusBadgeLabel(courseStatus?.course_status)
  const statusBadgeStyle = getStatusBadgeStyle(courseStatus?.course_status)

  const tipsForCard = useMemo(
    () =>
      getGolferTips(
        weather?.weather_code,
        windSpeed ?? 0,
        weather?.uv_index,
        precipProb ?? 0,
        weather?.is_day,
        easternHour,
        sunriseDisplay,
      ).slice(0, 3),
    [
      weather?.weather_code,
      weather?.uv_index,
      weather?.is_day,
      windSpeed,
      precipProb,
      easternHour,
      sunriseDisplay,
    ],
  )

  void messageIndex

  const currentSlot =
    activeSlots[activeSlotIndex % activeSlots.length] ?? activeSlots[0]


  const playerRootStyle = {
    '--os-accent-green': accentColor,
  }

  return (
    <div
      className="player-root"
      style={playerRootStyle}
      role="main"
      aria-label="Olde Sycamore Golf Club conditions display"
    >
      <style>{`
        .player-root {
          --os-accent-green: #7ab648;
          --os-white: #ffffff;
          --os-white-80: rgba(255, 255, 255, 0.88);
          --os-white-55: rgba(255, 255, 255, 0.78);
          --os-white-40: rgba(255, 255, 255, 0.72);
          /* WCAG AA targets on panel surface ~#0c1510 */
          --os-label: rgba(255, 255, 255, 0.88);
          --os-section-header: rgba(255, 255, 255, 0.85);
          --os-body-muted: rgba(255, 255, 255, 0.92);
          --os-text-on-photo: rgba(255, 255, 255, 0.88);
          --os-panel-accent: #e8f0dc;
          --os-panel-heading-weather: #e2f2fa;
          --os-panel-heading-proshop: #f2ead4;
          --os-panel-heading-community: #eddcc4;
          --os-panel-accent-weather: rgba(142, 200, 248, 0.55);
          --os-panel-accent-proshop: rgba(230, 210, 160, 0.5);
          --os-panel-accent-community: rgba(237, 220, 196, 0.5);
          --os-panel-glass-green: rgba(122, 182, 72, 0.11);
          --os-panel-glass-green-deep: rgba(12, 34, 20, 0.34);
          --os-panel-glass-green-fade: rgba(10, 28, 17, 0.26);
          --os-panel-glass-border: rgba(122, 182, 72, 0.2);
          --os-panel-surface-weather: rgba(122, 182, 72, 0.1);
          --os-panel-surface-proshop: rgba(122, 182, 72, 0.11);
          --os-panel-surface-community: rgba(122, 182, 72, 0.1);
          --os-panel-surface-events: rgba(10, 30, 18, 0.28);
          --panel-gap: clamp(8px, 1.1vh, 12px);
          --panel-section-gap: clamp(10px, 1.8vh, 22px);
          --panel-block-gap: clamp(6px, 0.8vh, 9px);
          --os-context-info: #8ec8f8;
          --os-divider: rgba(255, 255, 255, 0.12);
          --os-card: rgba(0, 0, 0, 0.22);
          --os-card-border: rgba(255, 255, 255, 0.10);
          --os-green-badge: #86efac;
          --os-blue: #93c5fd;
          --os-amber: #fcd34d;
          --os-red: #fca5a5;
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: #000000;
          font-family: 'Plus Jakarta Sans', sans-serif;
          color: var(--os-white);
        }

        .scene-backdrop {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .player-root * {
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.95);
        }

        .left-zone {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 72%;
          overflow: hidden;
          z-index: 0;
        }

        .scene-photo-wrap {
          position: absolute;
          inset: 0;
          overflow: hidden;
          z-index: 0;
        }

        .scene-photo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 40%;
          pointer-events: none;
          transform-origin: center center;
          will-change: transform;
          transition: filter 6s ease-in-out;
          animation: kenBurns 90s ease-in-out infinite;
        }

        @keyframes kenBurns {
          0% { transform: scale(1) translate(0, 0); }
          25% { transform: scale(1.04) translate(-8px, -4px); }
          50% { transform: scale(1.06) translate(-4px, -8px); }
          75% { transform: scale(1.04) translate(4px, -6px); }
          100% { transform: scale(1) translate(0, 0); }
        }

        .rain-canvas-layer {
          position: absolute;
          inset: 0;
          z-index: 4;
          width: 100%;
          height: 100%;
          pointer-events: none;
          opacity: 0;
          transition: opacity 5s ease-in-out;
        }

        .rain-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .scene-photo {
            animation: none;
            will-change: auto;
          }

          .status-live-dot,
          .card-dot {
            animation: none;
            opacity: 1;
          }

          .card-content,
          .community-rotate-slot {
            transition: none;
          }

          .rain-canvas-layer {
            transition: none;
          }
        }

        .gradient-top, .gradient-bottom, .gradient-left {
          position: absolute;
          z-index: 3;
          pointer-events: none;
          transition: opacity 6s ease-in-out;
        }

        .gradient-top {
          top: 0; left: 0; right: 0;
          height: 42%;
          background: linear-gradient(180deg, rgba(0,0,0,0.62) 0%, transparent 40%);
        }

        .gradient-bottom {
          bottom: 0; left: 0; right: 0;
          height: 52%;
          background: linear-gradient(0deg, rgba(0,0,0,0.68) 0%, transparent 48%);
        }

        .gradient-left {
          top: 0; bottom: 0; left: 0;
          width: 32%;
          background: linear-gradient(90deg, rgba(0,0,0,0.50) 0%, transparent 22%);
        }

        .left-ui {
          position: absolute;
          inset: 0;
          z-index: 10;
          pointer-events: none;
        }

        .overlay-top-left {
          position: absolute;
          top: clamp(14px, 2vh, 20px);
          left: clamp(14px, 2vw, 20px);
        }

        .overlay-logo {
          display: block;
          height: clamp(52px, 7.5vw, 76px);
          width: auto;
          object-fit: contain;
          filter: brightness(10);
          opacity: 0.92;
        }

        .overlay-tagline {
          margin: clamp(4px, 0.5vh, 6px) 0 0;
          font-size: clamp(10px, 1.05vw, 13px);
          color: var(--os-white);
          letter-spacing: 0.4px;
        }

        .overlay-status-top {
          position: absolute;
          top: clamp(14px, 2vh, 20px);
          left: 62%;
          transform: translateX(-50%);
          white-space: nowrap;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: clamp(6px, 1vh, 10px) clamp(16px, 2.2vw, 22px);
          border-radius: 24px;
          font-size: clamp(12px, 1.4vw, 15px);
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .status-live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          flex-shrink: 0;
          animation: live-pulse 2s ease-in-out infinite;
        }

        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        .overlay-conditions-left {
          position: absolute;
          left: clamp(14px, 2vw, 20px);
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          gap: clamp(14px, 2vh, 24px);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
        }

        .condition-stack-item {
          margin: 0;
          padding: 0;
          border: none;
          background: none;
          border-radius: 0;
        }

        .display-title {
          margin: 0;
          font-family: 'Playfair Display', serif;
          font-weight: 700;
          font-size: clamp(13px, 1.45vw, 17px);
          letter-spacing: 1.3px;
          text-transform: uppercase;
          line-height: 1.15;
        }

        .condition-stack-label {
          margin: 0;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(13px, 1.25vw, 15px);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.65);
          line-height: 1.2;
          text-shadow: 0 1px 10px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.85);
        }

        .condition-stack-value {
          margin: 4px 0 0;
          font-size: clamp(18px, 2.2vw, 26px);
          font-weight: 700;
          color: #ffffff;
          font-family: 'Plus Jakarta Sans', sans-serif;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.9);
        }

        .center-card {
          position: absolute;
          top: 50%;
          left: 62%;
          transform: translate(-50%, -50%);
          width: clamp(300px, 38vw, 480px);
          background: rgba(0, 0, 0, 0.22);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          border: 0.5px solid rgba(255, 255, 255, 0.10);
          border-radius: 18px;
          padding: clamp(16px, 2.2vh, 24px) clamp(18px, 2.2vw, 24px);
        }

        .card-slot-label {
          display: flex;
          align-items: center;
          gap: 5px;
          margin: 0 0 clamp(10px, 1.4vh, 16px);
          font-size: clamp(10px, 1vw, 11px);
          color: var(--os-section-header);
          letter-spacing: 2px;
          text-transform: uppercase;
          font-weight: 500;
        }

        .card-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
          animation: card-dot-pulse 2s ease-in-out infinite;
        }

        @keyframes card-dot-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .card-content { transition: opacity 0.85s ease-in-out; }

        .slot-subheader {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: clamp(8px, 1.2vh, 12px);
        }

        .slot-title {
          margin: 0;
          font-size: clamp(16px, 2vw, 22px);
          font-weight: 400;
          color: var(--os-white);
        }

        .slot-title-tournament {
          font-family: 'Playfair Display', serif;
          font-size: clamp(14px, 1.8vw, 19px);
          font-weight: 400;
          color: #fff;
        }

        .slot-member-name {
          margin: 0;
          font-family: 'Playfair Display', serif;
          font-size: clamp(22px, 3.2vw, 36px);
          font-weight: 700;
          color: #fff;
          line-height: 1.15;
        }

        .slot-live { margin: 0; font-size: 11px; color: var(--os-green-badge); }
        .slot-round { margin: 0; font-size: clamp(11px, 1.2vw, 13px); color: var(--os-label); }

        .lb-row {
          display: grid;
          grid-template-columns: 18px 1fr auto auto;
          align-items: center;
          gap: 8px;
          padding: clamp(6px, 1vh, 9px) 0;
        }

        .slot-pro .lb-row { grid-template-columns: 18px 24px 1fr auto; }
        .lb-row-border { border-bottom: 0.5px solid rgba(255, 255, 255, 0.06); }
        .lb-pos { font-size: clamp(10px, 1.2vw, 13px); color: var(--os-label); }
        .lb-flag { font-size: clamp(12px, 1.3vw, 14px); }
        .lb-name { font-size: clamp(13px, 1.6vw, 16px); color: var(--os-white); font-weight: 500; }
        .lb-score { font-size: clamp(13px, 1.6vw, 16px); font-weight: 600; text-align: right; }
        .lb-score-under { color: var(--os-green-badge); }
        .lb-score-over { color: var(--os-red); }
        .lb-score-even { color: var(--os-white-80); }
        .lb-thru { font-size: clamp(10px, 1.1vw, 12px); color: var(--os-label); text-align: right; min-width: 36px; }
        .slot-powered { margin: 8px 0 0; font-size: clamp(10px, 1vw, 11px); color: var(--os-section-header); text-align: right; letter-spacing: 0.5px; }

        .slot-notice { text-align: center; padding: clamp(12px, 2vh, 20px) 0; }
        .slot-notice-text { margin: 0; font-size: clamp(14px, 1.8vw, 20px); font-weight: 400; color: var(--os-white); line-height: 1.6; }
        .slot-notice-divider { width: 48px; height: 0.5px; background: var(--os-divider); margin: clamp(14px, 2vh, 18px) auto 0; }
        .slot-notice-byline { margin: 12px 0 0; font-size: clamp(10px, 1.05vw, 12px); color: var(--os-section-header); }

        .slot-tips {
          display: flex;
          flex-direction: column;
          gap: clamp(8px, 1.1vh, 12px);
        }

        .tip-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: clamp(10px, 1.3vh, 14px) clamp(12px, 1.4vw, 16px);
          border-radius: 10px;
          border-left: 2px solid #9ecf7a;
          background: rgba(122, 182, 72, 0.08);
        }

        .tip-icon-wrap {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .tip-icon-wrap .ti {
          font-size: 18px;
          text-shadow: none;
        }

        .tip-body {
          flex: 1;
          min-width: 0;
        }

        .tip-label {
          margin: 0 0 4px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.4px;
          text-transform: uppercase;
        }

        .tip-text {
          margin: 0;
          font-size: clamp(13px, 1.45vw, 16px);
          font-weight: 500;
          color: var(--os-body-muted);
          line-height: 1.45;
        }

        .panel-right {
          position: absolute;
          top: 0;
          right: 0;
          width: 28%;
          height: 100vh;
          background: transparent;
          display: flex;
          flex-direction: column;
          justify-content: space-evenly;
          gap: var(--panel-section-gap);
          padding-block: var(--panel-gap);
          overflow: hidden;
          z-index: 20;
        }

        .panel-section {
          flex: 0 0 auto;
          flex-shrink: 1;
          min-height: 0;
          max-height: 100%;
          display: flex;
          flex-direction: column;
          padding: 0 clamp(10px, 1.3vw, 14px);
          border-bottom: none;
          overflow: hidden;
        }

        .panel-section-weather {
          flex-shrink: 1;
          max-height: min(56vh, 100%);
        }

        .panel-section-community {
          flex-shrink: 1;
          max-height: min(42vh, 100%);
        }

        .panel-section-inner {
          flex: 0 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: stretch;
          gap: var(--panel-gap);
          overflow: hidden;
          padding: clamp(8px, 1vh, 12px) clamp(9px, 1.1vw, 12px);
          border-radius: clamp(6px, 0.65vw, 10px);
          border: 0.5px solid var(--os-panel-glass-border);
          background: linear-gradient(
            165deg,
            var(--os-panel-glass-green) 0%,
            var(--os-panel-glass-green-deep) 52%,
            var(--os-panel-glass-green-fade) 100%
          );
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.06),
            0 1px 8px rgba(0, 0, 0, 0.14);
        }

        .panel-section-weather .panel-section-inner {
          background: linear-gradient(
            165deg,
            rgba(142, 200, 248, 0.08) 0%,
            var(--os-panel-surface-weather) 14%,
            var(--os-panel-glass-green-deep) 54%,
            var(--os-panel-glass-green-fade) 100%
          );
          border-color: rgba(122, 182, 72, 0.22);
          box-shadow:
            inset 3px 0 0 var(--os-panel-accent-weather),
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 1px 8px rgba(0, 0, 0, 0.14);
        }

        .panel-section-proshop .panel-section-inner {
          background: linear-gradient(
            165deg,
            rgba(230, 210, 160, 0.07) 0%,
            var(--os-panel-surface-proshop) 14%,
            var(--os-panel-glass-green-deep) 54%,
            var(--os-panel-glass-green-fade) 100%
          );
          border-color: rgba(122, 182, 72, 0.22);
          box-shadow:
            inset 3px 0 0 var(--os-panel-accent-proshop),
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 1px 8px rgba(0, 0, 0, 0.14);
        }

        .panel-section-community .panel-section-inner {
          background: linear-gradient(
            165deg,
            rgba(237, 220, 196, 0.06) 0%,
            var(--os-panel-surface-community) 14%,
            var(--os-panel-glass-green-deep) 54%,
            var(--os-panel-glass-green-fade) 100%
          );
          border-color: rgba(122, 182, 72, 0.22);
          box-shadow:
            inset 3px 0 0 var(--os-panel-accent-community),
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 1px 8px rgba(0, 0, 0, 0.14);
        }

        .panel-subsection-events {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: var(--panel-block-gap);
          margin-top: calc(var(--panel-gap) * 0.35);
          padding: clamp(7px, 0.9vh, 10px) clamp(8px, 1vw, 10px);
          border-radius: clamp(5px, 0.55vw, 8px);
          background: linear-gradient(
            165deg,
            var(--os-panel-glass-green) 0%,
            var(--os-panel-surface-events) 100%
          );
          border: 0.5px solid rgba(122, 182, 72, 0.18);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: inset 2px 0 0 rgba(237, 220, 196, 0.28);
        }

        .panel-subsection-events .panel-section-header {
          font-size: clamp(12px, 1.3vw, 15px);
          opacity: 0.95;
        }

        .panel-block {
          flex: 0 0 auto;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: var(--panel-block-gap);
          padding-bottom: var(--panel-gap);
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.10);
        }

        .panel-section-inner > .panel-block:last-child,
        .panel-section-inner > :last-child.panel-block {
          border-bottom: none;
          padding-bottom: 0;
        }

        .panel-section-inner > .panel-section-header + .panel-section-header {
          margin-top: calc(var(--panel-gap) * 0.5);
        }

        .panel-section-header {
          margin: 0;
          flex-shrink: 0;
          font-family: 'Playfair Display', serif;
          font-weight: 700;
          font-size: clamp(13px, 1.45vw, 17px);
          letter-spacing: 1.3px;
          text-transform: uppercase;
          line-height: 1.2;
        }

        .panel-section-header.display-title-weather { color: var(--os-panel-heading-weather); }
        .panel-section-header.display-title-proshop { color: var(--os-panel-heading-proshop); }
        .panel-section-header.display-title-community { color: var(--os-panel-heading-community); }

        .community-rotate-slot {
          flex-shrink: 0;
          transition: opacity 0.5s ease-in-out;
        }

        .community-events-stack {
          display: flex;
          flex-direction: column;
          gap: var(--panel-block-gap);
        }

        .community-event-row {
          padding-bottom: var(--panel-block-gap);
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.06);
        }

        .community-event-row:last-child {
          padding-bottom: 0;
          border-bottom: none;
        }

        .panel-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding: clamp(5px, 0.55vh, 7px) 0;
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.05);
          flex-shrink: 0;
        }

        .panel-row:last-child { border-bottom: none; }

        .panel-row-label {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(12px, 1.2vw, 14px);
          font-weight: 600;
          letter-spacing: 0.2px;
          color: var(--os-panel-accent);
          flex-shrink: 0;
        }

        .panel-row-value {
          font-size: clamp(13px, 1.25vw, 15px);
          font-weight: 600;
          color: #ffffff;
          text-align: right;
          line-height: 1.25;
        }

        .panel-row-value-highlight { color: var(--os-green-badge); }

        .weather-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
          flex-shrink: 0;
        }

        .panel-section-weather .panel-temp {
          font-size: clamp(28px, 3.5vw, 44px);
        }

        .panel-temp {
          margin: 0;
          font-family: 'Playfair Display', serif;
          font-size: clamp(32px, 4.2vw, 52px);
          font-weight: 700;
          color: #fff;
          line-height: 1.05;
        }

        .scene-photo-static {
          animation: none !important;
          will-change: auto;
        }

        .panel-temp-degree {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 0.6em;
          font-weight: 700;
          line-height: 1;
          margin: 0;
          padding: 0;
          vertical-align: super;
          color: #ffffff;
          -webkit-font-smoothing: antialiased;
        }

        .panel-temp .panel-temp-degree {
          font-size: 0.62em;
        }

        .weather-meta { text-align: right; min-width: 0; }
        .weather-condition {
          margin: 0;
          font-size: clamp(13px, 1.3vw, 16px);
          font-weight: 500;
          color: var(--os-body-muted);
          line-height: 1.2;
        }
        .weather-feels {
          margin: 3px 0 0;
          font-size: clamp(12px, 1.15vw, 14px);
          font-weight: 500;
          color: var(--os-body-muted);
        }

        .weather-feels .panel-temp-degree {
          font-size: 0.8em;
          font-weight: 600;
        }

        .panel-forecast-temp .panel-temp-degree {
          font-size: 0.55em;
        }

        .weather-rows {
          display: flex;
          flex-direction: column;
          width: 100%;
          flex-shrink: 0;
          margin: 0;
        }

        .weather-row {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          padding: clamp(5px, 0.65vh, 7px) 0;
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.06);
        }

        .weather-row:last-child {
          border-bottom: none;
        }

        .weather-row-label,
        .weather-row dt {
          margin: 0;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(12px, 1.2vw, 14px);
          font-weight: 600;
          color: rgba(255, 255, 255, 0.88);
          flex-shrink: 0;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.85);
        }

        .weather-row-value,
        .weather-row dd {
          margin: 0;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(13px, 1.25vw, 15px);
          font-weight: 600;
          color: #ffffff;
          text-align: right;
          line-height: 1.25;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.85);
        }

        .now-context-line {
          margin: 0;
          padding: 0;
          border: none;
          font-size: clamp(12px, 1.2vw, 14px);
          color: var(--os-context-info);
          font-weight: 400;
          line-height: 1.35;
          flex-shrink: 0;
        }

        .panel-forecast-wrap {
          padding: 0 0 clamp(2px, 0.35vh, 4px);
          border: none;
          flex-shrink: 0;
          overflow: visible;
        }

        .panel-forecast {
          display: flex;
          align-items: flex-end;
          overflow: visible;
        }

        .panel-forecast-col {
          flex: 1 1 0;
          text-align: center;
          padding: 0 3px clamp(4px, 0.5vh, 6px);
          min-width: 0;
          overflow: visible;
        }

        .panel-forecast-col-divider { border-right: 0.5px solid rgba(255, 255, 255, 0.10); }
        .panel-forecast-time {
          margin: 0;
          font-size: clamp(12px, 1.1vw, 13px);
          color: var(--os-label);
          font-weight: 600;
          line-height: 1.3;
        }
        .panel-forecast-temp {
          margin: 2px 0 0;
          font-size: clamp(13px, 1.25vw, 16px);
          font-weight: 600;
          color: #ffffff;
          line-height: 1.25;
        }
        .panel-forecast-rain {
          margin: 3px 0 0;
          font-size: clamp(12px, 1.1vw, 13px);
          color: var(--os-label);
          font-weight: 600;
          line-height: 1.35;
          white-space: nowrap;
        }
        .panel-forecast-rain-high { color: #b8dcff; font-weight: 700; }
        .panel-forecast-empty {
          margin: 0;
          font-size: clamp(12px, 1.15vw, 14px);
          color: var(--os-label);
          text-align: center;
        }

        .community-item {
          flex-shrink: 0;
          padding: 0;
          border-bottom: none;
        }

        .community-type {
          margin: 0;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: clamp(12px, 1.15vw, 14px);
          font-weight: 600;
          letter-spacing: 0.2px;
          color: var(--os-panel-accent);
          line-height: 1.25;
        }
        .community-name {
          margin: 0;
          font-size: clamp(13px, 1.3vw, 16px);
          font-weight: 600;
          color: #fff;
          font-family: 'Plus Jakarta Sans', sans-serif;
          line-height: 1.35;
        }

        .community-event-row .community-detail {
          margin-top: 2px;
        }
        .community-detail {
          margin: 2px 0 0;
          font-size: clamp(12px, 1.15vw, 14px);
          font-weight: 500;
          color: var(--os-body-muted);
          line-height: 1.4;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .player-error {
          position: fixed;
          top: clamp(8px, 1vh, 12px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 50;
          margin: 0;
          padding: 8px 14px;
          font-size: clamp(12px, 1.2vw, 14px);
          font-weight: 600;
          color: #ffffff;
          background: rgba(80, 10, 10, 0.92);
          border: 0.5px solid #fca5a5;
          border-radius: 6px;
        }
      `}</style>

      {error && <p className="player-error">Error: {error}</p>}

      <div className="scene-backdrop" aria-hidden="true">
        <div className="scene-photo-wrap">
          <img
            className={`scene-photo${prefersReducedMotion ? ' scene-photo-static' : ''}`}
            src={coursePhotoUrl}
            alt=""
            aria-hidden="true"
            style={{ filter: photoFilter }}
          />
        </div>
        <div
          className="rain-canvas-layer"
          style={{ opacity: rainTargetOpacity }}
        >
          <RainCanvas
            active={rainParticleCount > 0 && rainTargetOpacity > 0.02}
            particleCount={rainParticleCount}
          />
        </div>
        <div
          className="gradient-top"
          style={{ opacity: sceneGradientOpacity }}
        />
        <div
          className="gradient-bottom"
          style={{ opacity: sceneGradientOpacity }}
        />
        <div
          className="gradient-left"
          style={{ opacity: sceneGradientOpacity }}
        />
      </div>

      <div className="left-zone">
        <div className="left-ui">
          <div className="overlay-top-left">
            <img className="overlay-logo" src={logoUrl} alt="Olde Sycamore Golf Club" />
            {showTagline ? <p className="overlay-tagline">{clubTagline}</p> : null}
          </div>

          <div className="overlay-status-top">
            <span
              className="status-badge"
              role="status"
              aria-label={`Course status: ${statusBadgeLabel}`}
              style={{
                background: statusBadgeStyle.background,
                border: statusBadgeStyle.border,
                color: statusBadgeStyle.color,
              }}
            >
              <span className="status-live-dot" aria-hidden="true" />
              {statusBadgeLabel}
            </span>
          </div>

          <div className="overlay-conditions-left" role="region" aria-label="Course conditions">
            {conditionItems.map((item) => (
              <div key={item.label} className="condition-stack-item">
                <p className="condition-stack-label">{item.label}</p>
                <p className="condition-stack-value" aria-label={`${item.label}: ${item.value}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {currentSlot && (
            <div className="center-card">
              <div className="card-slot-label">
                {currentSlot.dotColor && (
                  <span className="card-dot" style={{ background: currentSlot.dotColor }} />
                )}
                <span>{currentSlot.label}</span>
              </div>
              <div className="card-content" style={{ opacity: cardFade }}>
                {renderCardSlot(currentSlot.id, {
                  tipsForCard,
                  courseNotice,
                  tournamentLeaderboard,
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      <aside className="panel-right" aria-label="Information panel">
        {showPanelWeather ? (
        <section className="panel-section panel-section-weather" aria-label="Weather">
          <div className="panel-section-inner">
            <div className="panel-block">
              <div className="weather-hero">
                <p className="panel-temp" aria-label={formatTempAria(tempDisplay)}>
                  <span aria-hidden="true">
                    {tempDisplay}
                    {tempDisplay !== '--' ? <span className="panel-temp-degree">°</span> : null}
                  </span>
                </p>
                <div className="weather-meta">
                  <p className="weather-condition">{weather?.condition_text || '—'}</p>
                  <p className="weather-feels" aria-label={formatFeelsAria(feelsDisplay)}>
                    <span aria-hidden="true">
                      Feels like {feelsDisplay}
                      {feelsDisplay !== '--' ? <span className="panel-temp-degree">°</span> : null}
                    </span>
                  </p>
                </div>
              </div>
              <dl className="weather-rows">
                <div className="weather-row">
                  <dt className="weather-row-label">Wind</dt>
                  <dd className="weather-row-value">{windLabel}</dd>
                </div>
                <div className="weather-row">
                  <dt className="weather-row-label">Humidity</dt>
                  <dd className="weather-row-value">
                    {weather?.humidity != null ? `${Math.round(weather.humidity)}%` : '—'}
                  </dd>
                </div>
                <div className="weather-row">
                  <dt className="weather-row-label">UV Index</dt>
                  <dd className="weather-row-value">{uvRowText}</dd>
                </div>
                <div className="weather-row">
                  <dt className="weather-row-label">Sunset</dt>
                  <dd className="weather-row-value">{sunsetDisplay}</dd>
                </div>
              </dl>
            </div>
            {nowContextLine ? (
              <div className="panel-block">
                <p className="now-context-line" role="status" aria-live="polite">
                  {nowContextLine}
                </p>
              </div>
            ) : null}
            <div className="panel-block">
              <div className="panel-forecast-wrap" aria-label="Hourly forecast">
                {renderPanelForecast(forecastSlots)}
              </div>
            </div>
          </div>
        </section>
        ) : null}

        {showPanelProShop ? (
        <section className="panel-section panel-section-proshop" aria-labelledby="panel-proshop-heading">
          <div className="panel-section-inner">
            <h2 id="panel-proshop-heading" className="display-title panel-section-header display-title-proshop">
              {proShopTitle}
            </h2>
            <div className="panel-block">
              {proShopRows.map((row) => (
                <div key={row.label} className="panel-row">
                  <span className="panel-row-label">{row.label}</span>
                  <span
                    className={`panel-row-value${row.highlight ? ' panel-row-value-highlight' : ''}`}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
        ) : null}

        {showPanelCommunity ? (
        <section className="panel-section panel-section-community" aria-labelledby="panel-community-heading">
          <div className="panel-section-inner">
            <h2 id="panel-community-heading" className="display-title panel-section-header display-title-community">
              Community
            </h2>
            {activeAchievement ? (
              <div
                className="panel-block"
                aria-live="polite"
                aria-atomic="true"
                aria-label={`Community highlight: ${activeAchievement.type}, ${activeAchievement.name}`}
              >
                <div
                  className="community-item community-rotate-slot"
                  style={{ opacity: communityFade }}
                >
                  <p className="community-type">{activeAchievement.type}</p>
                  <p className="community-name">{activeAchievement.name}</p>
                  {activeAchievement.detail ? (
                    <p className="community-detail">{activeAchievement.detail}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {communityEvents.length > 0 ? (
              <div className="panel-subsection-events" aria-labelledby="panel-events-heading">
                <h2 id="panel-events-heading" className="display-title panel-section-header display-title-community">
                  Events
                </h2>
                <div className="community-events-stack">
                  {communityEvents.map((item) => (
                    <article key={item.key} className="community-event-row">
                      <h3 className="community-name">{item.name}</h3>
                      {item.detail ? (
                        <p className="community-detail">{item.detail}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
        ) : null}
      </aside>
    </div>
  )
}
