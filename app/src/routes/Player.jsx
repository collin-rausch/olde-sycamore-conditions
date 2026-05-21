import React, { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { connectScreenCloud, getScreenCloud } from '@screencloud/apps-sdk'
import {
  createVisualStateStore,
  getVisualState,
  getEasternHour,
  getWindCardinal,
} from '../lib/weatherVisuals'
import WeatherCanvas from '../components/canvas/WeatherCanvas'

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

const ANNOUNCEMENTS = [
  'Tee times every 9 minutes · Book at oldesycamoregolf.com · 704-573-1000',
  'Restaurant & bar open daily · Burgers, pizza, sandwiches & local craft beers',
  "Men's Invitational · May 24–26 · Live scoring available in the app",
  'Membership available · No initiation fee · Call 704-573-1000 for details',
  'Greens top-dressed Tue & Wed · Front 9 only · Back 9 open all day',
  'Practice facility open 7 AM–7 PM · Driving range, chipping green & putting green',
]

const TEE_TIMES = [
  { time: '9:40 AM', status: '2 SPOTS', tone: 'green' },
  { time: '10:20 AM', status: '4 SPOTS', tone: 'green' },
  { time: '11:00 AM', status: 'WAITLIST', tone: 'yellow' },
  { time: '1:40 PM', status: '2 SPOTS', tone: 'green' },
  { time: '3:10 PM', status: 'OPEN', tone: 'muted' },
]

const COURSE_STATS = [
  { label: 'Greens speed', value: '11.2 ft' },
  { label: 'Fairways', value: 'Firm' },
  { label: 'Bunkers', value: 'Groomed' },
  { label: 'Cart rule', value: '90° Rule' },
]

const TABLER_ICONS_URL =
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.47.0/dist/tabler-icons.min.css'

function toNum(val) {
  if (val == null || val === '') return null
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

/** Coerce Supabase row (NUMERIC fields may arrive as strings). */
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

function formatUpdatedAt(fetchedAt) {
  if (!fetchedAt) return 'Updated just now'
  const fetched = new Date(fetchedAt)
  if (Number.isNaN(fetched.getTime())) return 'Updated just now'
  const mins = Math.floor((Date.now() - fetched.getTime()) / 60000)
  if (mins < 2) return 'Updated just now'
  if (mins < 60) return `Updated ${mins} min ago`
  return `Updated ${fetched.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })}`
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
  const suffix = h >= 12 ? 'P' : 'A'
  return `${hour12}${suffix}`
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
  if (uv == null) return 'rgba(255, 255, 255, 0.65)'
  if (uv <= 2) return 'rgba(255, 255, 255, 0.65)'
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
      {
        icon: 'moon',
        text: openLine,
      },
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

export default function Player() {
  const [weather, setWeather] = useState(null)
  const [error, setError] = useState(null)
  const [started, setStarted] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [messageIndex, setMessageIndex] = useState(0)
  const [, setFrame] = useState(0)
  const hasResetVisuals = useRef(false)

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

  const clockStr = clock.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })

  const dateStr = clock.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  })

  const tempDisplay =
    weather?.temperature_f != null ? Math.round(weather.temperature_f) : '--'
  const feelsDisplay =
    weather?.feels_like_f != null ? Math.round(weather.feels_like_f) : '--'
  const updatedLabel = formatUpdatedAt(weather?.fetched_at)

  const forecastSlots = useMemo(() => {
    if (!hourly) return []
    return getForecastSlots(hourly, clock)
  }, [hourly, clock])

  const golferTips = useMemo(
    () =>
      getGolferTips(
        weather?.weather_code,
        windSpeed ?? 0,
        weather?.uv_index,
        precipProb ?? 0,
        weather?.is_day,
        easternHour,
        sunriseDisplay,
      ),
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

  const windLabel =
    windSpeed != null
      ? `${getWindCardinal(windDir ?? 0)} ${Math.round(windSpeed)} mph`
      : '—'

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
        }

        .player-ui {
          position: absolute;
          inset: 0;
          z-index: 10;
          display: flex;
          overflow: hidden;
          pointer-events: none;
        }

        .panel-left {
          position: relative;
          width: 68%;
          height: 100%;
          flex-shrink: 0;
          overflow: hidden;
        }

        .panel-left-fx {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .panel-left-tint {
          position: absolute;
          inset: 0;
          z-index: 1;
          transition: background-color 3s ease;
          pointer-events: none;
        }

        .panel-left-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 2;
          mix-blend-mode: screen;
          opacity: 0.4;
          overflow: hidden;
          pointer-events: none;
        }

        .panel-left-canvas .weather-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .panel-left-gradient {
          position: absolute;
          left: 0;
          right: 0;
          z-index: 3;
          pointer-events: none;
        }

        .panel-left-gradient-top {
          top: 0;
          height: 45%;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.65) 0%,
            transparent 35%
          );
        }

        .panel-left-gradient-bottom {
          bottom: 0;
          height: 50%;
          background: linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.75) 0%,
            transparent 40%
          );
        }

        .panel-left-content {
          position: relative;
          z-index: 4;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
          pointer-events: none;
        }

        .panel-left-top {
          padding: clamp(12px, 1.8vh, 20px) clamp(14px, 2vw, 22px);
          flex-shrink: 0;
        }

        .panel-logo {
          display: block;
          height: clamp(30px, 4.5vw, 52px);
          width: auto;
          object-fit: contain;
          object-position: left center;
          filter: brightness(10);
          opacity: 0.9;
        }

        .panel-logo-tagline {
          margin: clamp(4px, 0.5vh, 6px) 0 0;
          font-size: clamp(9px, 1vw, 12px);
          font-weight: 400;
          color: rgba(255, 255, 255, 0.52);
          letter-spacing: 0.3px;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .panel-left-hero {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 0 8% 0 clamp(14px, 2vw, 22px);
          min-height: 0;
          overflow: hidden;
        }

        .hero-eyebrow {
          margin: 0 0 clamp(6px, 0.8vh, 10px);
          font-size: clamp(10px, 1.1vw, 13px);
          font-weight: 300;
          color: rgba(255, 255, 255, 0.6);
          letter-spacing: clamp(3px, 0.5vw, 5px);
          text-transform: uppercase;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .hero-title {
          margin: 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(28px, 5vw, 56px);
          font-weight: 700;
          color: #ffffff;
          line-height: 1.05;
          text-shadow: 0 4px 30px rgba(0, 0, 0, 0.8);
        }

        .hero-tagline {
          margin: clamp(6px, 0.8vh, 10px) 0 0;
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: clamp(13px, 1.6vw, 19px);
          font-weight: 400;
          color: rgba(255, 255, 255, 0.72);
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .panel-left-bottom {
          padding: clamp(10px, 1.5vh, 16px) clamp(14px, 2vw, 22px);
          flex-shrink: 0;
        }

        .announce-label {
          margin: 0 0 clamp(4px, 0.6vh, 5px);
          font-size: clamp(8px, 0.9vw, 9px);
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          letter-spacing: clamp(1px, 0.2vw, 2px);
          text-transform: uppercase;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .announce-body {
          position: relative;
          min-height: 2.4em;
        }

        .announce-text {
          position: absolute;
          inset: 0;
          margin: 0;
          font-size: clamp(13px, 1.6vw, 18px);
          font-weight: 300;
          color: rgba(255, 255, 255, 0.94);
          line-height: 1.4;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.92);
          opacity: 0;
          transition: opacity 0.65s ease;
        }

        .announce-text.active {
          opacity: 1;
        }

        .announce-dots {
          display: flex;
          gap: clamp(4px, 0.5vw, 6px);
          margin-top: clamp(6px, 0.8vh, 8px);
        }

        .announce-dot {
          width: clamp(3px, 0.4vw, 4px);
          height: clamp(3px, 0.4vw, 4px);
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          transition: background 0.3s ease;
        }

        .announce-dot.active {
          background: rgba(255, 255, 255, 0.78);
        }

        .panel-right {
          width: 32%;
          height: 100%;
          flex-shrink: 0;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .panel-section {
          flex-shrink: 0;
          padding: clamp(8px, 1.2vh, 13px) clamp(10px, 1.4vw, 16px);
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.07);
          overflow: hidden;
        }

        .panel-section-tips {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.07);
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: clamp(6px, 0.8vw, 8px);
          margin-bottom: clamp(6px, 0.8vh, 8px);
        }

        .section-label {
          display: flex;
          align-items: center;
          gap: clamp(4px, 0.5vw, 6px);
          font-size: clamp(8px, 0.9vw, 9px);
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          letter-spacing: clamp(1px, 0.2vw, 2px);
          text-transform: uppercase;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .live-dot {
          width: clamp(4px, 0.5vw, 5px);
          height: clamp(4px, 0.5vw, 5px);
          border-radius: 50%;
          background: #4ade80;
          animation: live-pulse 2s ease-in-out infinite;
        }

        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        .section-meta {
          font-size: clamp(8px, 0.9vw, 9px);
          font-weight: 400;
          color: rgba(255, 255, 255, 0.5);
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .weather-hero-row {
          margin-bottom: clamp(6px, 0.8vh, 8px);
        }

        .weather-temp {
          margin: 0;
          font-size: clamp(32px, 4.5vw, 52px);
          font-weight: 200;
          line-height: 1;
          color: #ffffff;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .weather-condition {
          margin: clamp(2px, 0.3vh, 4px) 0 0;
          font-size: clamp(11px, 1.3vw, 15px);
          font-weight: 400;
          color: rgba(255, 255, 255, 0.88);
          text-transform: capitalize;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .weather-feels {
          margin: clamp(2px, 0.3vh, 3px) 0 0;
          font-size: clamp(10px, 1.1vw, 13px);
          font-weight: 400;
          color: rgba(255, 255, 255, 0.52);
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .detail-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: clamp(4px, 0.5vh, 5px) 0;
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.05);
        }

        .detail-row:last-of-type {
          border-bottom: none;
        }

        .detail-label {
          font-size: clamp(10px, 1.1vw, 12px);
          font-weight: 400;
          color: rgba(255, 255, 255, 0.5);
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .detail-value {
          font-size: clamp(11px, 1.2vw, 13px);
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
          text-align: right;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .forecast-block {
          border-top: 0.5px solid rgba(255, 255, 255, 0.07);
          padding-top: clamp(6px, 0.8vh, 7px);
          margin-top: clamp(6px, 0.8vh, 7px);
        }

        .forecast-strip {
          display: flex;
          align-items: stretch;
        }

        .forecast-slot {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: clamp(2px, 0.3vh, 3px);
          padding: 0 clamp(2px, 0.3vw, 4px);
          border-right: 0.5px solid rgba(255, 255, 255, 0.07);
          min-width: 0;
        }

        .forecast-slot:last-child {
          border-right: none;
        }

        .forecast-time {
          margin: 0;
          font-size: clamp(8px, 0.9vw, 9px);
          color: rgba(255, 255, 255, 0.5);
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .forecast-temp {
          margin: 0;
          font-size: clamp(11px, 1.3vw, 14px);
          font-weight: 500;
          color: #ffffff;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .forecast-rain {
          margin: 0;
          font-size: clamp(8px, 0.9vw, 9px);
          color: rgba(255, 255, 255, 0.5);
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .forecast-rain-high {
          color: rgba(147, 197, 253, 0.88);
        }

        .sun-row {
          display: flex;
          justify-content: space-between;
          gap: clamp(8px, 1vw, 12px);
        }

        .sun-item-label {
          margin: 0 0 clamp(2px, 0.3vh, 3px);
          font-size: clamp(8px, 0.9vw, 9px);
          color: rgba(255, 255, 255, 0.5);
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .sun-item-time {
          margin: 0;
          font-size: clamp(10px, 1.1vw, 13px);
          font-weight: 500;
          color: rgba(255, 255, 255, 0.8);
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: clamp(4px, 0.5vw, 5px);
          background: rgba(16, 68, 36, 0.8);
          border: 0.5px solid rgba(74, 222, 128, 0.3);
          border-radius: clamp(2px, 0.3vw, 3px);
          padding: clamp(1px, 0.2vh, 1px) clamp(5px, 0.7vw, 7px);
          font-size: clamp(8px, 0.9vw, 9px);
          font-weight: 700;
          color: #4ade80;
          letter-spacing: 0.8px;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .course-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(5px, 0.7vw, 7px);
        }

        .course-card {
          background: rgba(255, 255, 255, 0.04);
          border: 0.5px solid rgba(255, 255, 255, 0.08);
          border-radius: clamp(4px, 0.5vw, 6px);
          padding: clamp(5px, 0.8vh, 8px) clamp(7px, 0.9vw, 9px);
        }

        .course-card-label {
          margin: 0;
          font-size: clamp(8px, 0.9vw, 9px);
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .course-card-value {
          margin: clamp(2px, 0.3vh, 2px) 0 0;
          font-size: clamp(11px, 1.3vw, 14px);
          font-weight: 500;
          color: #ffffff;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .tee-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: clamp(4px, 0.6vh, 6px) 0;
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.05);
        }

        .tee-row:last-of-type {
          border-bottom: none;
        }

        .tee-time {
          font-size: clamp(11px, 1.2vw, 13px);
          color: rgba(255, 255, 255, 0.8);
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .tee-status {
          font-size: clamp(10px, 1.1vw, 12px);
          font-weight: 600;
          letter-spacing: 0.3px;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .tee-status-green { color: #4ade80; }
        .tee-status-yellow { color: #fbbf24; }
        .tee-status-muted { color: rgba(255, 255, 255, 0.5); }

        .tee-footer {
          margin: clamp(4px, 0.6vh, 5px) 0 0;
          font-size: clamp(8px, 0.9vw, 9px);
          color: rgba(255, 255, 255, 0.5);
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .tips-list {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .tip-row {
          display: flex;
          align-items: flex-start;
          gap: clamp(6px, 0.8vw, 8px);
          padding: clamp(4px, 0.6vh, 6px) 0;
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.05);
          flex-shrink: 0;
        }

        .tip-row:last-child {
          border-bottom: none;
        }

        .tip-icon {
          font-size: clamp(11px, 1.2vw, 13px);
          color: rgba(255, 255, 255, 0.5);
          flex-shrink: 0;
          margin-top: clamp(1px, 0.15vh, 1px);
          line-height: 1;
        }

        .tip-text {
          margin: 0;
          font-size: clamp(10px, 1.1vw, 12px);
          font-weight: 400;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.4;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .panel-clock {
          flex-shrink: 0;
          border-top: 0.5px solid rgba(255, 255, 255, 0.08);
          padding: clamp(8px, 1.2vh, 12px) clamp(10px, 1.4vw, 16px);
          text-align: center;
        }

        .clock-time {
          margin: 0;
          font-size: clamp(18px, 2.5vw, 32px);
          font-weight: 200;
          color: #ffffff;
          letter-spacing: clamp(0.5px, 0.1vw, 1px);
          font-variant-numeric: tabular-nums;
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }

        .clock-date {
          margin: clamp(2px, 0.3vh, 2px) 0 0;
          font-size: clamp(9px, 1vw, 12px);
          font-weight: 400;
          color: rgba(255, 255, 255, 0.5);
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
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
          text-shadow: 0 1px 8px rgba(0, 0, 0, 0.92);
        }
      `}</style>

      <img
        className="scene-photo"
        src={COURSE_PHOTO_URL}
        alt=""
        aria-hidden="true"
      />

      <div className="player-ui">
        {error && <p className="player-error">Error: {error}</p>}

        <div className="panel-left">
          <div className="panel-left-fx" aria-hidden="true">
            <div
              className="panel-left-tint"
              style={{
                backgroundColor: visual.skyTintColor,
                opacity: visual.skyTintOpacity,
              }}
            />
            <div className="panel-left-canvas">
              <WeatherCanvas visualState={visual} />
            </div>
            <div className="panel-left-gradient panel-left-gradient-top" />
            <div className="panel-left-gradient panel-left-gradient-bottom" />
          </div>

          <div className="panel-left-content">
            <div className="panel-left-top">
              <img
                className="panel-logo"
                src={LOGO_URL}
                alt="Olde Sycamore Golf Club"
              />
              <p className="panel-logo-tagline">18 holes · Est. 1997</p>
            </div>

            <div className="panel-left-hero">
              <p className="hero-eyebrow">Welcome to</p>
              <h1 className="hero-title">Olde Sycamore Golf Club</h1>
              <p className="hero-tagline">
                Experience. Tradition. Community.
              </p>
            </div>

            <div className="panel-left-bottom">
              <p className="announce-label">Club Announcements</p>
              <div className="announce-body">
                {ANNOUNCEMENTS.map((msg, i) => (
                  <p
                    key={i}
                    className={`announce-text${i === messageIndex ? ' active' : ''}`}
                  >
                    {msg}
                  </p>
                ))}
              </div>
              <div className="announce-dots">
                {ANNOUNCEMENTS.map((_, i) => (
                  <span
                    key={i}
                    className={`announce-dot${i === messageIndex ? ' active' : ''}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="panel-right">
          <section className="panel-section">
            <div className="section-header">
              <span className="section-label">
                <span className="live-dot" />
                Live Weather
              </span>
              <span className="section-meta">{updatedLabel}</span>
            </div>

            <div className="weather-hero-row">
              <p className="weather-temp">{tempDisplay}°</p>
              <p className="weather-condition">
                {weather?.condition_text || '—'}
              </p>
              <p className="weather-feels">Feels like {feelsDisplay}°</p>
            </div>

            <div className="detail-row">
              <span className="detail-label">Wind</span>
              <span className="detail-value">{windLabel}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Humidity</span>
              <span className="detail-value">
                {weather?.humidity != null
                  ? `${Math.round(weather.humidity)}%`
                  : '—'}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">UV Index</span>
              <span
                className="detail-value"
                style={{ color: getUvLabelColor(weather?.uv_index) }}
              >
                {weather?.uv_index != null ? weather.uv_index : '—'} ·{' '}
                {getUvLabel(weather?.uv_index)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Rain Chance</span>
              <span className="detail-value">
                {precipProb != null ? `${Math.round(precipProb)}%` : '—'}
              </span>
            </div>

            <div className="forecast-block">
              <div className="forecast-strip">
                {forecastSlots.length > 0 ? (
                  forecastSlots.map((slot, i) => {
                    const precipVal = toNum(slot.precip)
                    const rainHigh = precipVal != null && precipVal > 30
                    return (
                      <div key={i} className="forecast-slot">
                        <p className="forecast-time">
                          {formatHourCompact(slot.time)}
                        </p>
                        <p className="forecast-temp">
                          {slot.temp != null
                            ? `${Math.round(Number(slot.temp))}°`
                            : '—'}
                        </p>
                        <p
                          className={`forecast-rain${rainHigh ? ' forecast-rain-high' : ''}`}
                        >
                          {precipVal != null ? `${Math.round(precipVal)}%` : '—'}
                        </p>
                      </div>
                    )
                  })
                ) : (
                  <p className="section-meta" style={{ width: '100%', textAlign: 'center' }}>
                    Forecast unavailable
                  </p>
                )}
              </div>
            </div>

            <div className="forecast-block sun-row">
              <div>
                <p className="sun-item-label">Sunrise</p>
                <p className="sun-item-time">{sunriseDisplay}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="sun-item-label">Sunset</p>
                <p className="sun-item-time">{sunsetDisplay}</p>
              </div>
            </div>
          </section>

          <section className="panel-section">
            <div className="section-header">
              <span className="section-label">Course Status</span>
              <span className="status-badge">
                <span className="live-dot" />
                OPEN
              </span>
            </div>
            <div className="course-grid">
              {COURSE_STATS.map((card) => (
                <div key={card.label} className="course-card">
                  <p className="course-card-label">{card.label}</p>
                  <p className="course-card-value">{card.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel-section">
            <div className="section-header">
              <span className="section-label">Tee Time Availability</span>
              <span className="section-meta">18-Hole</span>
            </div>
            {TEE_TIMES.map((row) => (
              <div key={row.time} className="tee-row">
                <span className="tee-time">{row.time}</span>
                <span className={`tee-status tee-status-${row.tone}`}>
                  {row.status}
                </span>
              </div>
            ))}
            <p className="tee-footer">
              Book at oldesycamoregolf.com · 704-573-1000
            </p>
          </section>

          <section className="panel-section-tips">
            <span className="section-label">Golfer Tips</span>
            <div className="tips-list">
              {golferTips.map((tip, i) => (
                <div key={i} className="tip-row">
                  <TablerIcon name={tip.icon} />
                  <p className="tip-text">{tip.text}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="panel-clock">
            <p className="clock-time">{clockStr}</p>
            <p className="clock-date">{dateStr}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
