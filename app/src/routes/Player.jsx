import React, { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { connectScreenCloud, getScreenCloud } from '@screencloud/apps-sdk'
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

const RAIN_DROPS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  left: `${((i * 17 + (i % 7) * 11) % 100).toFixed(1)}%`,
  delay: `${((i * 0.13) % 2).toFixed(2)}s`,
  duration: `${(0.6 + (i % 5) * 0.15).toFixed(2)}s`,
}))

const SLOT_COUNT = 5

const SLOT_META = [
  { label: 'Club tournament', dotColor: '#4ade80' },
  { label: 'Member spotlight', dotColor: '#fbbf24' },
  { label: 'PGA Tour · live', dotColor: '#60a5fa' },
  { label: "Today's forecast", dotColor: null },
  { label: 'Course tips', dotColor: null },
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

const DEMO_ACHIEVEMENT = {
  type: 'HOLE IN ONE',
  name: 'Robert Chen',
  detail: 'Hole 7 · 162 yards · 7-iron',
  date: 'May 21, 2026',
}

const DEMO_PRO_LEADERBOARD = {
  title: 'Charles Schwab Challenge · R3',
  rows: [
    { position: 1, flag: '🇺🇸', name: 'S. Scheffler', score: -18 },
    { position: 2, flag: '🇨🇦', name: 'C. Conners', score: -15 },
    { position: 3, flag: '🇺🇸', name: 'X. Schauffele', score: -14 },
    { position: 4, flag: '🇺🇸', name: 'P. Cantlay', score: -13 },
    { position: 5, flag: '🇯🇵', name: 'H. Matsuyama', score: -12 },
  ],
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

function formatCartRule(rule) {
  if (!rule) return '—'
  const s = rule.toLowerCase()
  if (s.includes('path')) return 'Paths Only'
  if (s.includes('90')) return '90° Rule'
  if (s.includes('fairway')) return 'Fairways Open'
  return rule
}

function normalizeCourseStatusKey(status) {
  const s = (status || 'open').toLowerCase().replace(/-/g, ' ').trim()
  if (s === 'closed') return 'closed'
  if (s.includes('frost')) return 'frost'
  return 'open'
}

function getStatusBadgeLabel(status) {
  const key = normalizeCourseStatusKey(status)
  if (key === 'closed') return 'CLOSED'
  if (key === 'frost') return 'FROST DELAY'
  return 'OPEN'
}

function getStatusBadgeStyle(status) {
  const key = normalizeCourseStatusKey(status)
  if (key === 'closed') {
    return {
      background: 'rgba(127,29,29,0.75)',
      border: '0.5px solid rgba(248,113,113,0.50)',
      color: '#f87171',
    }
  }
  if (key === 'frost') {
    return {
      background: 'rgba(29,78,216,0.60)',
      border: '0.5px solid rgba(147,197,253,0.50)',
      color: '#93c5fd',
    }
  }
  return {
    background: 'rgba(16,68,36,0.75)',
    border: '0.5px solid rgba(74,222,128,0.50)',
    color: '#4ade80',
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

function formatHourLabel(isoOrTime) {
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

function getForecastSlots(hourly, referenceDate) {
  const times = hourly?.time || []
  if (times.length === 0) return []

  const currentHour = getEasternHour(referenceDate)
  let start = 0
  for (let i = 0; i < times.length; i++) {
    if (parseSlotHour(times[i]) >= currentHour) {
      start = i
      break
    }
  }

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

function getUvLabelColor(uv) {
  if (uv == null) return 'rgba(255, 255, 255, 0.70)'
  if (uv <= 2) return 'rgba(255, 255, 255, 0.70)'
  if (uv <= 5) return '#fbbf24'
  if (uv <= 7) return '#f97316'
  if (uv <= 10) return '#ef4444'
  return '#a855f7'
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
    return 'brightness(0.35) saturate(0.50) contrast(1.10)'
  }
  if (code >= 95) {
    return 'brightness(0.70) saturate(0.60) contrast(1.05)'
  }
  if (precip > 40 || (code >= 51 && code <= 82)) {
    return 'brightness(0.80) saturate(0.70) contrast(0.94)'
  }
  if (easternHour >= 17 && easternHour <= 20) {
    return 'brightness(1.02) saturate(1.18) contrast(0.98) sepia(0.15)'
  }
  if ((code >= 45 && code <= 48) || cloud > 70) {
    return 'brightness(0.88) saturate(0.78) contrast(0.96)'
  }
  if (code === 3) {
    return 'brightness(0.96) saturate(0.92) contrast(1.0)'
  }
  if (code >= 0 && code <= 2) {
    return 'brightness(1.05) saturate(1.08) contrast(1.02)'
  }
  return 'brightness(1.05) saturate(1.08) contrast(1.02)'
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
      <p className="slot-subtitle">{title}</p>
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

function renderMemberAchievement(
  achievement = DEMO_ACHIEVEMENT,
) {
  return (
    <div className="slot-achievement">
      <p className="slot-achievement-type">{achievement.type}</p>
      <p className="slot-achievement-name">{achievement.name}</p>
      <p className="slot-achievement-detail">{achievement.detail}</p>
      <p className="slot-achievement-date">{achievement.date}</p>
    </div>
  )
}

function renderProLeaderboard({ title, rows } = DEMO_PRO_LEADERBOARD) {
  return (
    <div className="slot-leaderboard slot-pro">
      <p className="slot-subtitle">{title}</p>
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

function renderForecast(slots) {
  if (!slots || slots.length === 0) {
    return (
      <p className="slot-empty">Forecast unavailable</p>
    )
  }

  return (
    <div className="slot-forecast">
      {slots.map((slot, i) => {
        const precipVal = slot.precip ?? 0
        const rainHigh = precipVal >= 30
        return (
          <div
            key={`${slot.time}-${i}`}
            className={`forecast-col${i < slots.length - 1 ? ' forecast-col-divider' : ''}`}
          >
            <p className="forecast-time">{formatHourLabel(slot.time)}</p>
            <p className="forecast-temp">
              {slot.temp != null ? `${Math.round(slot.temp)}°` : '—'}
            </p>
            <p
              className={`forecast-rain${rainHigh ? ' forecast-rain-high' : ''}`}
            >
              {slot.precip != null ? `${Math.round(precipVal)}%` : '—'}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function renderGolferTips(tips) {
  return (
    <div className="slot-tips">
      {tips.map((tip, i) => (
        <div key={i} className="tip-row">
          {tip.isNote ? (
            <span className="tip-note-label">NOTE</span>
          ) : (
            <TablerIcon name={tip.icon} />
          )}
          <p className="tip-text">{tip.text}</p>
        </div>
      ))}
    </div>
  )
}

function renderCardSlot(slotIndex, { forecastSlots, tipsForCard }) {
  switch (slotIndex) {
    case 0:
      return renderClubTournament(DEMO_CLUB_LEADERBOARD)
    case 1:
      return renderMemberAchievement(DEMO_ACHIEVEMENT)
    case 2:
      return renderProLeaderboard(DEMO_PRO_LEADERBOARD)
    case 3:
      return renderForecast(forecastSlots)
    case 4:
      return renderGolferTips(tipsForCard)
    default:
      return null
  }
}

export default function Player() {
  const [weather, setWeather] = useState(null)
  const [courseStatus, setCourseStatus] = useState(null)
  const [error, setError] = useState(null)
  const [started, setStarted] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [messageIndex, setMessageIndex] = useState(0)
  const [, setFrame] = useState(0)
  const [cardSlot, setCardSlot] = useState(0)
  const [cardFade, setCardFade] = useState(1)
  const hasResetVisuals = useRef(false)
  const fadeTimeoutRef = useRef(null)

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

    async function loadCourseStatus() {
      const { data } = await supabase
        .from('course_status')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) setCourseStatus(data)
    }

    loadCourseStatus()

    subscription = supabase
      .channel('player-course-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'course_status' },
        (payload) => {
          if (payload.new) setCourseStatus(payload.new)
        },
      )
      .subscribe()

    return () => {
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

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCardFade(0)
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
      fadeTimeoutRef.current = setTimeout(() => {
        setCardSlot((s) => (s + 1) % SLOT_COUNT)
        setCardFade(1)
      }, 400)
    }, 10000)

    return () => {
      clearInterval(intervalId)
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current)
    }
  }, [])

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

  const showRain = (precipProb ?? 0) > 40

  const tempDisplay =
    weather?.temperature_f != null ? Math.round(weather.temperature_f) : '--'
  const feelsDisplay =
    weather?.feels_like_f != null ? Math.round(weather.feels_like_f) : '--'

  const windLabel =
    windSpeed != null
      ? `${getWindCardinal(windDir ?? 0)} ${Math.round(windSpeed)} mph`
      : '—'

  const uvValue = weather?.uv_index
  const uvLabelText =
    uvValue != null ? `UV ${uvValue} · ${getUvLabel(uvValue)}` : 'UV —'
  const uvColor = getUvLabelColor(uvValue)
  const rainLabelText =
    precipProb != null ? `${Math.round(precipProb)}% rain` : '— rain'

  const sunRowText = `Sunrise ${sunriseDisplay}  ·  Sunset ${sunsetDisplay}`

  const forecastSlots = useMemo(() => {
    if (!hourly) return []
    return getForecastSlots(hourly, clock)
  }, [hourly, clock])

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
  const statusKey = normalizeCourseStatusKey(courseStatus?.course_status)
  const dailyNote = courseStatus?.daily_note?.trim() || ''

  const tipsForCard = useMemo(() => {
    const tips = getGolferTips(
      weather?.weather_code,
      windSpeed ?? 0,
      weather?.uv_index,
      precipProb ?? 0,
      weather?.is_day,
      easternHour,
      sunriseDisplay,
    )
    const result = []
    if (dailyNote) {
      result.push({ icon: 'clipboard', text: dailyNote, isNote: true })
    }
    for (const tip of tips) {
      if (result.length >= 3) break
      result.push(tip)
    }
    return result.slice(0, 3)
  }, [
    weather?.weather_code,
    weather?.uv_index,
    weather?.is_day,
    windSpeed,
    precipProb,
    easternHour,
    sunriseDisplay,
    dailyNote,
  ])

  void messageIndex

  const slotMeta = SLOT_META[cardSlot]

  return (
    <div className="player-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700&display=swap');

        .player-root {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #ffffff;
        }

        .scene-photo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 40%;
          z-index: 0;
          pointer-events: none;
          transition: filter 3s ease;
        }

        .rain-layer {
          position: absolute;
          inset: -10% -5%;
          z-index: 2;
          pointer-events: none;
          overflow: hidden;
          transform: rotate(8deg);
        }

        .rain-drop {
          position: absolute;
          top: -8%;
          width: 1px;
          height: clamp(14px, 2.2vh, 28px);
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(200, 220, 240, 0.35) 100%
          );
          animation: rain-fall linear infinite;
        }

        @keyframes rain-fall {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 0.35; }
          90% { opacity: 0.35; }
          100% { transform: translateY(115vh); opacity: 0; }
        }

        .gradient-top {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 40%;
          z-index: 3;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.60) 0%,
            transparent 35%
          );
          pointer-events: none;
        }

        .gradient-bottom {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 50%;
          z-index: 3;
          background: linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.72) 0%,
            transparent 45%
          );
          pointer-events: none;
        }

        .overlay-ui {
          position: absolute;
          inset: 0;
          z-index: 20;
          pointer-events: none;
        }

        .overlay-ui * {
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.95);
        }

        .overlay-top-left {
          position: absolute;
          top: clamp(16px, 2.5vh, 28px);
          left: clamp(16px, 2.5vw, 28px);
        }

        .overlay-logo {
          display: block;
          height: clamp(48px, 6.5vw, 72px);
          width: auto;
          object-fit: contain;
          filter: brightness(10);
          opacity: 0.92;
        }

        .overlay-tagline {
          margin: clamp(4px, 0.5vh, 6px) 0 0;
          font-size: clamp(10px, 1.1vw, 13px);
          font-weight: 400;
          color: rgba(255, 255, 255, 0.55);
        }

        .overlay-weather {
          position: absolute;
          top: clamp(16px, 2.5vh, 28px);
          right: clamp(16px, 2.5vw, 28px);
          text-align: right;
        }

        .overlay-temp {
          margin: 0;
          font-size: clamp(52px, 8vw, 88px);
          font-weight: 200;
          color: #fff;
          line-height: 1;
          text-shadow: 0 2px 16px rgba(0, 0, 0, 0.9);
        }

        .overlay-condition {
          margin: 4px 0 0;
          font-size: clamp(14px, 1.8vw, 20px);
          font-weight: 300;
          color: rgba(255, 255, 255, 0.85);
          text-shadow: 0 2px 16px rgba(0, 0, 0, 0.9);
        }

        .overlay-feels {
          margin: 2px 0 0;
          font-size: clamp(12px, 1.4vw, 16px);
          font-weight: 300;
          color: rgba(255, 255, 255, 0.55);
          text-shadow: 0 2px 16px rgba(0, 0, 0, 0.9);
        }

        .center-card {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: clamp(320px, 42vw, 520px);
          background: rgba(0, 0, 0, 0.48);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 0.5px solid rgba(255, 255, 255, 0.13);
          border-radius: 16px;
          padding: clamp(16px, 2.5vh, 28px) clamp(18px, 2.5vw, 28px);
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: clamp(10px, 1.5vh, 14px);
        }

        .card-header-left {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .card-label {
          margin: 0;
          font-size: 9px;
          color: rgba(255, 255, 255, 0.38);
          letter-spacing: 2px;
          text-transform: uppercase;
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

        .card-slot-indicator {
          margin: 0;
          font-size: 9px;
          color: rgba(255, 255, 255, 0.25);
        }

        .card-content {
          transition: opacity 0.8s ease;
        }

        .slot-subtitle {
          margin: 0 0 clamp(8px, 1vh, 10px);
          font-size: clamp(11px, 1.2vw, 13px);
          font-weight: 500;
          color: rgba(255, 255, 255, 0.75);
        }

        .slot-empty {
          margin: 0;
          font-size: clamp(11px, 1.2vw, 13px);
          color: rgba(255, 255, 255, 0.45);
          text-align: center;
        }

        .lb-row {
          display: grid;
          grid-template-columns: 22px 1fr auto auto;
          align-items: center;
          gap: 8px;
          padding: clamp(5px, 0.7vh, 7px) 0;
        }

        .slot-pro .lb-row {
          grid-template-columns: 22px 24px 1fr auto;
        }

        .lb-row-border {
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.06);
        }

        .lb-pos {
          font-size: clamp(10px, 1.1vw, 12px);
          color: rgba(255, 255, 255, 0.38);
        }

        .lb-flag {
          font-size: clamp(12px, 1.3vw, 14px);
        }

        .lb-name {
          font-size: clamp(11px, 1.3vw, 14px);
          color: #fff;
          font-weight: 400;
        }

        .lb-score {
          font-size: clamp(11px, 1.3vw, 14px);
          font-weight: 600;
          text-align: right;
        }

        .lb-score-under { color: #4ade80; }
        .lb-score-over { color: #f87171; }
        .lb-score-even { color: rgba(255, 255, 255, 0.45); }

        .lb-thru {
          font-size: clamp(10px, 1.1vw, 12px);
          color: rgba(255, 255, 255, 0.38);
          text-align: right;
          min-width: 32px;
        }

        .slot-powered {
          margin: clamp(8px, 1vh, 10px) 0 0;
          font-size: 9px;
          color: rgba(255, 255, 255, 0.20);
          text-align: right;
        }

        .slot-achievement {
          text-align: center;
          padding: clamp(4px, 0.6vh, 8px) 0;
        }

        .slot-achievement-type {
          margin: 0;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.40);
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .slot-achievement-name {
          margin: clamp(8px, 1vh, 12px) 0 0;
          font-size: clamp(20px, 3vw, 28px);
          font-weight: 200;
          color: #fff;
        }

        .slot-achievement-detail {
          margin: clamp(4px, 0.6vh, 6px) 0 0;
          font-size: clamp(12px, 1.5vw, 16px);
          color: rgba(255, 255, 255, 0.65);
        }

        .slot-achievement-date {
          margin: clamp(4px, 0.6vh, 6px) 0 0;
          font-size: clamp(10px, 1.1vw, 13px);
          color: rgba(255, 255, 255, 0.38);
        }

        .slot-forecast {
          display: flex;
          align-items: stretch;
        }

        .forecast-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: clamp(3px, 0.4vh, 5px);
          padding: 0 clamp(4px, 0.6vw, 6px);
          min-width: 0;
        }

        .forecast-col-divider {
          border-right: 0.5px solid rgba(255, 255, 255, 0.08);
        }

        .forecast-time {
          margin: 0;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.45);
        }

        .forecast-temp {
          margin: 0;
          font-size: clamp(16px, 2.2vw, 22px);
          font-weight: 300;
          color: #fff;
        }

        .forecast-rain {
          margin: 0;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.40);
        }

        .forecast-rain-high {
          color: rgba(147, 197, 253, 0.90);
        }

        .slot-tips {
          display: flex;
          flex-direction: column;
          gap: clamp(8px, 1vh, 10px);
        }

        .tip-row {
          display: flex;
          align-items: flex-start;
          gap: clamp(8px, 1vw, 10px);
        }

        .tip-row .ti {
          font-size: 15px;
          color: rgba(255, 255, 255, 0.35);
          flex-shrink: 0;
          margin-top: 2px;
          text-shadow: none;
        }

        .tip-note-label {
          font-size: 9px;
          letter-spacing: 1px;
          color: rgba(251, 191, 36, 0.70);
          flex-shrink: 0;
          margin-top: 3px;
          text-shadow: none;
        }

        .tip-text {
          margin: 0;
          font-size: clamp(11px, 1.3vw, 14px);
          color: rgba(255, 255, 255, 0.75);
          line-height: 1.5;
        }

        .overlay-bottom-left {
          position: absolute;
          bottom: clamp(20px, 3.5vh, 40px);
          left: clamp(16px, 2.5vw, 28px);
          display: flex;
          flex-direction: column;
          gap: clamp(8px, 1.2vh, 14px);
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: clamp(11px, 1.3vw, 14px);
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          width: fit-content;
        }

        .status-live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4ade80;
          flex-shrink: 0;
          animation: live-pulse 2s ease-in-out infinite;
        }

        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        .conditions-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .condition-card {
          background: rgba(0, 0, 0, 0.42);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 0.5px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          padding: clamp(7px, 1vh, 11px) clamp(10px, 1.4vw, 14px);
        }

        .condition-label {
          margin: 0;
          font-size: 9px;
          color: rgba(255, 255, 255, 0.40);
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .condition-value {
          margin: 2px 0 0;
          font-size: clamp(12px, 1.5vw, 16px);
          font-weight: 500;
          color: #fff;
        }

        .daily-note {
          border-left: 2px solid rgba(251, 191, 36, 0.55);
          padding: 7px 11px;
          background: rgba(0, 0, 0, 0.40);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-radius: 0 8px 8px 0;
          max-width: clamp(260px, 38vw, 460px);
          font-size: clamp(11px, 1.3vw, 14px);
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.4;
          margin: 0;
        }

        .overlay-bottom-right {
          position: absolute;
          bottom: clamp(20px, 3.5vh, 40px);
          right: clamp(16px, 2.5vw, 28px);
          text-align: right;
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: flex-end;
        }

        .overlay-wind {
          margin: 0;
          font-size: clamp(20px, 3vw, 32px);
          font-weight: 200;
          color: #fff;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
        }

        .overlay-stat {
          margin: 0;
          font-size: clamp(12px, 1.4vw, 15px);
        }

        .overlay-sun {
          margin: 2px 0 0;
          font-size: clamp(10px, 1.1vw, 13px);
          color: rgba(255, 255, 255, 0.42);
        }

        .player-error {
          position: absolute;
          top: clamp(8px, 1vh, 12px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 30;
          margin: 0;
          padding: clamp(4px, 0.6vh, 6px) clamp(8px, 1vw, 12px);
          font-size: clamp(10px, 1.1vw, 12px);
          background: rgba(0, 0, 0, 0.6);
          border-radius: clamp(4px, 0.5vw, 6px);
        }
      `}</style>

      <img
        className="scene-photo"
        src={COURSE_PHOTO_URL}
        alt=""
        aria-hidden="true"
        style={{ filter: photoFilter }}
      />

      {showRain && (
        <div className="rain-layer" aria-hidden="true">
          {RAIN_DROPS.map((drop) => (
            <span
              key={drop.id}
              className="rain-drop"
              style={{
                left: drop.left,
                animationDelay: drop.delay,
                animationDuration: drop.duration,
              }}
            />
          ))}
        </div>
      )}

      <div className="gradient-top" aria-hidden="true" />
      <div className="gradient-bottom" aria-hidden="true" />

      <div className="overlay-ui">
        {error && <p className="player-error">Error: {error}</p>}

        <div className="overlay-top-left">
          <img
            className="overlay-logo"
            src={LOGO_URL}
            alt="Olde Sycamore Golf Club"
          />
          <p className="overlay-tagline">18 holes · Est. 1997</p>
        </div>

        <div className="overlay-weather">
          <p className="overlay-temp">{tempDisplay}°</p>
          <p className="overlay-condition">
            {weather?.condition_text || '—'}
          </p>
          <p className="overlay-feels">Feels like {feelsDisplay}°</p>
        </div>

        <div className="center-card">
          <div className="card-header">
            <div className="card-header-left">
              {slotMeta.dotColor && (
                <span
                  className="card-dot"
                  style={{ background: slotMeta.dotColor }}
                />
              )}
              <p className="card-label">{slotMeta.label}</p>
            </div>
            <p className="card-slot-indicator">
              {cardSlot + 1} / {SLOT_COUNT}
            </p>
          </div>
          <div className="card-content" style={{ opacity: cardFade }}>
            {renderCardSlot(cardSlot, { forecastSlots, tipsForCard })}
          </div>
        </div>

        <div className="overlay-bottom-left">
          <span
            className="status-badge"
            style={{
              background: statusBadgeStyle.background,
              border: statusBadgeStyle.border,
              color: statusBadgeStyle.color,
            }}
          >
            {statusKey === 'open' && <span className="status-live-dot" />}
            {statusBadgeLabel}
          </span>

          <div className="conditions-row">
            {conditionItems.map((item) => (
              <div key={item.label} className="condition-card">
                <p className="condition-label">{item.label}</p>
                <p className="condition-value">{item.value}</p>
              </div>
            ))}
          </div>

          {dailyNote ? <p className="daily-note">{dailyNote}</p> : null}
        </div>

        <div className="overlay-bottom-right">
          <p className="overlay-wind">{windLabel}</p>
          <p className="overlay-stat" style={{ color: uvColor }}>
            {uvLabelText}
          </p>
          <p
            className="overlay-stat"
            style={{ color: 'rgba(255, 255, 255, 0.55)' }}
          >
            {rainLabelText}
          </p>
          <p className="overlay-sun">{sunRowText}</p>
        </div>
      </div>
    </div>
  )
}
