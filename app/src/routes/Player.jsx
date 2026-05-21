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
  precip_probability: 10,
  is_day: 1,
  hourly_forecast: {
    time: ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
    temperature: [72, 74, 76, 75, 73, 71],
    precip_probability: [10, 15, 20, 25, 30, 35],
    weather_code: [0, 1, 2, 2, 1, 0],
    wind_speed: [8, 9, 10, 11, 9, 8],
  },
}

const visualStore = createVisualStateStore()

function parseHourlyForecast(hf) {
  if (!hf) return DEFAULT_WEATHER.hourly_forecast
  if (typeof hf === 'string') {
    try {
      return JSON.parse(hf)
    } catch {
      return DEFAULT_WEATHER.hourly_forecast
    }
  }
  return hf
}

const BACKGROUND_IMAGE_URL =
  'https://xntieyqrodsjelotcmnr.supabase.co/storage/v1/object/public/assets/img-olde-sycamore-1.webp'

const LOGO_URL =
  'https://xntieyqrodsjelotcmnr.supabase.co/storage/v1/object/public/assets/olde%20sycamore%20golf%20club%20logo.png'

const MESSAGES = [
  'Tee times every 9 minutes · Book at oldesycamoregolf.com or call 704-573-1000',
  'Restaurant & bar open daily · Burgers, pizza, sandwiches & local craft beers',
  'Practice facilities: driving range, putting green, chipping green & bunker',
  'Membership available · No initiation fee · Call 704-573-1000 for details',
  'Dress code: proper golf attire required · No denim or athletic shorts',
  'Greens top-dressed Tuesdays & Wednesdays through summer · 9 holes each day',
]

function formatHourLabel(isoOrTime) {
  if (!isoOrTime) return '—'
  const s = String(isoOrTime)
  if (s.includes('T')) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true,
        timeZone: 'America/New_York',
      })
    }
  }
  const match = s.match(/^(\d{1,2}):(\d{2})/)
  if (match) {
    const h = parseInt(match[1], 10)
    const hour12 = h % 12 === 0 ? 12 : h % 12
    const period = h >= 12 ? 'PM' : 'AM'
    return `${hour12} ${period}`
  }
  return s
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
  if (uv == null) return 'rgba(255, 255, 255, 0.6)'
  if (uv <= 2) return 'rgba(255, 255, 255, 0.6)'
  if (uv <= 5) return '#fbbf24'
  if (uv <= 7) return '#f97316'
  if (uv <= 10) return '#ef4444'
  return '#a855f7'
}

function getTimeGreeting(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning for golf'
  if (hour >= 12 && hour < 17) return 'Good afternoon for golf'
  return 'Evening round'
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
    let subscribed = true

    async function init() {
      try {
        // Connect to ScreenCloud player lifecycle
        await connectScreenCloud()
        const sc = getScreenCloud()
        await sc.onAppStarted()
        if (subscribed) setStarted(true)
      } catch (e) {
        console.log('Not running inside ScreenCloud player (or dev mode)', e)
        // In local dev, just proceed without ScreenCloud
        if (subscribed) setStarted(true)
      }
    }

    init()
    return () => { subscribed = false }
  }, [])

  useEffect(() => {
    if (!started) return

    let subscription

    async function loadWeather() {
      const { data, error } = await supabase
        .from('weather_cache')
        .select('*')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        setError(error.message)
      } else {
        setWeather(data)
      }
    }

    loadWeather()

    // Realtime subscription to weather_cache changes
    subscription = supabase
      .channel('weather-cache-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weather_cache' },
        (payload) => {
          setWeather(payload.new)
        }
      )
      .subscribe()

    // Also poll every 60 seconds as fallback
    const interval = setInterval(loadWeather, 60000)

    return () => {
      subscription?.unsubscribe()
      clearInterval(interval)
    }
  }, [started])

  useEffect(() => {
    const tick = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const rotate = setInterval(
      () => setMessageIndex((i) => (i + 1) % MESSAGES.length),
      8000,
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

  const w = weather || DEFAULT_WEATHER
  const hourly = useMemo(() => parseHourlyForecast(w.hourly_forecast), [w.hourly_forecast])

  const precipProb = w.precip_probability ?? 0
  const windSpeed = w.wind_speed_mph ?? 0
  const windDir = w.wind_direction ?? 0

  const visual = visualStore.current ?? getVisualState(w)

  const clockStr = clock.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })

  const tempDisplay =
    w.temperature_f != null ? Math.round(w.temperature_f) : '--'
  const feelsDisplay =
    w.feels_like_f != null ? Math.round(w.feels_like_f) : '--'

  const easternHour = getEasternHour(clock)
  const gustMph = Math.round(
    windSpeed * (0.9 + (visual.windGustFactor ?? 0) * 0.35),
  )
  const dateStr = clock.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
  const showUvAdvisory = (w.uv_index ?? 0) > 7

  const sceneStyle = {
    '--sky-tint-color': visual.skyTintColor,
    '--sky-tint-opacity': visual.skyTintOpacity,
    '--ambient-tint': visual.ambientTintColor,
    '--vignette-opacity': visual.vignetteOpacity,
    '--scene-filter': `brightness(${visual.sceneExposure}) contrast(${visual.sceneContrast}) saturate(${visual.sceneSaturation})`,
  }

  return (
    <div className="player-scene" style={sceneStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;400;500;600&display=swap');

        .player-scene {
          --sp-1: 8px;
          --sp-2: 16px;
          --sp-3: 24px;
          --sp-4: 32px;
          --sp-6: 48px;
          --text-display: 200 clamp(64px, 10vw, 88px) / 1 'Inter', sans-serif;
          --text-clock: 600 clamp(32px, 5vw, 52px) / 1 'Inter', sans-serif;
          --text-heading: 600 clamp(15px, 2vw, 20px) / 1.2 'Inter', sans-serif;
          --text-body: 400 clamp(13px, 1.6vw, 16px) / 1.4 'Inter', sans-serif;
          --text-caption: 400 clamp(11px, 1.1vw, 12px) / 1.35 'Inter', sans-serif;
          --text-primary: #ffffff;
          --text-secondary: rgba(255, 255, 255, 0.82);
          --text-tertiary: rgba(255, 255, 255, 0.62);
          --brand-green: #1a3d2e;
          --card-bg: rgba(0, 0, 0, 0.38);
          --card-border: rgba(255, 255, 255, 0.14);
          --uv-advisory: #f97316;
          --rain-highlight: rgba(147, 197, 253, 0.9);
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: var(--text-primary);
        }

        .player-scene .readable {
          text-shadow: 0 1px 6px rgba(0, 0, 0, 0.85);
        }

        .type-display {
          font: var(--text-display);
          color: var(--text-primary);
        }

        .type-clock {
          font: var(--text-clock);
          color: var(--text-primary);
        }

        .type-heading {
          font: var(--text-heading);
        }

        .type-body {
          font: var(--text-body);
        }

        .type-caption {
          font: var(--text-caption);
        }

        .type-primary { color: var(--text-primary); }
        .type-secondary { color: var(--text-secondary); }
        .type-tertiary { color: var(--text-tertiary); }

        .scene-background {
          position: absolute;
          inset: 0;
          z-index: 1;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 60%;
          filter: var(--scene-filter);
          transition: filter 2.5s ease;
        }

        .weather-tint,
        .ambient-tint,
        .scene-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          transition: background-color 2.5s ease, opacity 2.5s ease;
        }

        .weather-tint {
          z-index: 2;
          background-color: var(--sky-tint-color);
          opacity: var(--sky-tint-opacity);
        }

        .ambient-tint {
          z-index: 3;
          background-color: var(--ambient-tint);
        }

        .scene-vignette {
          z-index: 4;
          background: radial-gradient(
            ellipse at center,
            transparent 42%,
            rgba(0, 0, 0, var(--vignette-opacity)) 100%
          );
        }

        .scene-rain {
          position: absolute;
          inset: 0;
          z-index: 6;
          pointer-events: none;
          overflow: hidden;
        }

        .rain-drop {
          position: absolute;
          width: 1px;
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(255, 255, 255, 0.12) 40%,
            rgba(255, 255, 255, 0.35) 100%
          );
          animation: rain-fall linear infinite;
        }

        @keyframes rain-fall {
          0% {
            transform: translateY(-30px) rotate(var(--rain-angle, 12deg));
            opacity: 0;
          }
          8% { opacity: 1; }
          100% {
            transform: translateY(105vh) rotate(var(--rain-angle, 12deg));
            opacity: 0;
          }
        }

        /* ZONE 1 — TOP BAR */
        .zone-top {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 80px;
          z-index: 20;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          align-items: center;
          padding: 0 var(--sp-4);
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.52) 0%, transparent 100%);
          pointer-events: none;
        }

        .top-brand {
          display: flex;
          flex-direction: column;
          gap: var(--sp-1);
        }

        .top-logo {
          height: 40px;
          width: auto;
          filter: brightness(10);
        }

        .top-tagline {
          font: var(--text-caption);
          color: var(--text-tertiary);
          margin: 0;
        }

        .top-clock {
          text-align: right;
        }

        .top-clock-time {
          font: var(--text-clock);
          color: var(--text-primary);
          margin: 0;
          font-variant-numeric: tabular-nums;
        }

        .top-clock-date {
          font: var(--text-caption);
          color: var(--text-tertiary);
          margin: var(--sp-1) 0 0;
        }

        /* ZONE 2 — MAIN */
        .zone-main {
          position: absolute;
          top: 80px;
          left: 0;
          right: 0;
          bottom: 220px;
          z-index: 20;
          display: grid;
          grid-template-columns: 1fr 2fr 1fr;
          align-items: center;
          pointer-events: none;
        }

        .col-left {
          display: flex;
          flex-direction: column;
          gap: var(--sp-2);
          padding-left: var(--sp-4);
          align-self: center;
        }

        .col-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: var(--sp-2);
        }

        .temp-hero {
          margin: 0;
          line-height: 1;
        }

        .temp-degree {
          font-size: 0.42em;
          font-weight: 200;
          vertical-align: super;
        }

        .wind-hand {
          display: block;
          margin: var(--sp-1) 0;
        }

        .condition-label {
          font: var(--text-heading);
          color: var(--text-secondary);
          margin: 0;
          text-transform: capitalize;
        }

        .feels-label {
          font: var(--text-body);
          color: var(--text-tertiary);
          margin: 0;
        }

        .uv-advisory-line {
          font: var(--text-caption);
          color: var(--uv-advisory);
          margin: 0;
        }

        .col-right {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-right: var(--sp-4);
          align-self: center;
        }

        .compass-bezel {
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 50%;
        }

        .compass-needle {
          transition: transform 1.5s ease;
        }

        .compass-meta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--sp-1);
          margin-top: var(--sp-2);
          min-height: 44px;
        }

        .compass-speed {
          font: var(--text-heading);
          color: var(--text-primary);
          margin: 0;
        }

        .compass-cardinal,
        .compass-gusts {
          font: var(--text-caption);
          color: var(--text-tertiary);
          margin: 0;
        }

        /* ZONE 3 — BOTTOM PANEL */
        .zone-bottom {
          position: absolute;
          bottom: 36px;
          left: 0;
          right: 0;
          z-index: 20;
          padding: 0 var(--sp-4);
          display: flex;
          flex-direction: column;
          gap: var(--sp-2);
          pointer-events: none;
        }

        .card-row {
          display: flex;
          gap: var(--sp-2);
          align-items: stretch;
        }

        .data-card {
          flex: 1;
          background: var(--card-bg);
          border: 0.5px solid var(--card-border);
          border-radius: 10px;
          padding: var(--sp-2) var(--sp-3);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          min-height: 44px;
        }

        .card-label {
          font: var(--text-caption);
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin: 0;
        }

        .card-value {
          font: var(--text-heading);
          color: var(--text-primary);
          margin: 4px 0 0;
        }

        .card-sub {
          font: var(--text-caption);
          margin: 4px 0 0;
        }

        .forecast-card {
          text-align: center;
        }

        .forecast-rain-high {
          color: var(--rain-highlight);
        }

        /* ZONE 4 — MESSAGE BAR */
        .zone-message {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 36px;
          z-index: 25;
          background: var(--brand-green);
          border-top: 0.5px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--sp-3);
          padding: 0 var(--sp-4);
          pointer-events: none;
        }

        .msg-logo {
          height: 18px;
          width: auto;
          filter: brightness(10);
          opacity: 0.5;
          flex-shrink: 0;
        }

        .msg-logo-mirror {
          transform: scaleX(-1);
        }

        .msg-body {
          flex: 1;
          position: relative;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
        }

        .msg-text {
          position: absolute;
          font: var(--text-caption);
          color: var(--text-secondary);
          text-align: center;
          margin: 0;
          padding: 0 var(--sp-2);
          opacity: 0;
          transition: opacity 1.2s ease;
          max-width: 100%;
        }

        .msg-text.active {
          opacity: 1;
        }

        .player-error-badge {
          position: absolute;
          top: 88px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 30;
          font: var(--text-caption);
          color: var(--text-primary);
          background: var(--card-bg);
          border: 0.5px solid var(--card-border);
          padding: var(--sp-1) var(--sp-2);
          border-radius: 6px;
          min-height: 44px;
          display: flex;
          align-items: center;
        }
      `}</style>

      {/* Scene layers */}
      <img
        className="scene-background"
        src={BACKGROUND_IMAGE_URL}
        alt="Olde Sycamore Golf Club"
      />
      <div className="weather-tint" />
      <div className="ambient-tint" />
      <div className="scene-vignette" />

      {visual.showRain && (
        <div className="scene-rain">
          {Array.from(
            { length: Math.round(18 + visual.rainDensity * 42) },
            (_, i) => (
              <div
                key={i}
                className="rain-drop"
                style={{
                  left: `${(i * 13.7 + (i % 5) * 3) % 100}%`,
                  height: `${8 + visual.rainDensity * 14 + (i % 4) * 2}px`,
                  opacity:
                    visual.rainOpacity *
                    (0.35 + visual.rainDensity * 0.4) *
                    (0.85 + (i % 3) * 0.05),
                  animationDuration: `${(1.1 - visual.rainDensity * 0.5) + (i % 8) * 0.1}s`,
                  animationDelay: `${(i % 18) * 0.06}s`,
                  '--rain-angle': `${12 + visual.rainAngle * 0.4}deg`,
                }}
              />
            ),
          )}
        </div>
      )}

      {/* ZONE 1 — TOP BAR */}
      <header className="zone-top">
        <div className="top-brand readable">
          <img className="top-logo" src={LOGO_URL} alt="Olde Sycamore Golf Club" />
          <p className="top-tagline readable">18 holes · Est. 1997</p>
        </div>
        <div />
        <div className="top-clock readable">
          <p className="top-clock-time">{clockStr}</p>
          <p className="top-clock-date">{dateStr}</p>
        </div>
      </header>

      {error && (
        <div className="player-error-badge readable">Error: {error}</div>
      )}

      {/* ZONE 2 — MAIN CONTENT */}
      <div className="zone-main">
        <div className="col-left readable">
          <p className="type-body type-secondary">{getTimeGreeting(easternHour)}</p>
          <p className="type-caption type-tertiary">Sunrise 6:08 AM</p>
          <p className="type-caption type-tertiary">Sunset 8:14 PM</p>
          {showUvAdvisory && (
            <p className="uv-advisory-line">High UV · Sun protection advised</p>
          )}
        </div>

        <div className="col-center readable">
          <p className="temp-hero type-display type-primary">
            {tempDisplay}
            <span className="temp-degree">°F</span>
          </p>
          <svg
            className="wind-hand"
            width="48"
            height="48"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <line
              x1="24"
              y1="24"
              x2="24"
              y2="8"
              stroke="rgba(255, 255, 255, 0.5)"
              strokeWidth="1.5"
              strokeLinecap="round"
              transform={`rotate(${windDir} 24 24)`}
            />
          </svg>
          <p className="condition-label">
            {w.condition_text || '—'}
          </p>
          <p className="feels-label">Feels like {feelsDisplay}°</p>
        </div>

        <div className="col-right readable">
          <div className="compass-bezel">
            <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="rgba(0, 0, 0, 0.28)"
                stroke="rgba(255, 255, 255, 0.25)"
                strokeWidth="1"
              />
              <line x1="60" y1="6" x2="60" y2="10" stroke="#ffffff" strokeWidth="1.5" />
              <line x1="60" y1="110" x2="60" y2="114" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.5" />
              <line x1="110" y1="60" x2="114" y2="60" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.5" />
              <line x1="6" y1="60" x2="10" y2="60" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="1.5" />
              <text x="60" y="20" textAnchor="middle" fontSize="9" fontWeight="500" fill="#ffffff">N</text>
              <text x="100" y="64" textAnchor="middle" fontSize="9" fontWeight="500" fill="rgba(255, 255, 255, 0.45)">E</text>
              <text x="60" y="108" textAnchor="middle" fontSize="9" fontWeight="500" fill="rgba(255, 255, 255, 0.45)">S</text>
              <text x="20" y="64" textAnchor="middle" fontSize="9" fontWeight="500" fill="rgba(255, 255, 255, 0.45)">W</text>
              <g
                className="compass-needle"
                transform={`rotate(${windDir} 60 60)`}
              >
                <line x1="60" y1="60" x2="60" y2="14" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="60" y1="60" x2="60" y2="106" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="60" cy="60" r="3" fill="#ffffff" />
              </g>
            </svg>
          </div>
          <div className="compass-meta">
            <p className="compass-speed readable">
              {windSpeed != null ? `${Math.round(windSpeed)} mph` : '—'}
            </p>
            <p className="compass-cardinal readable">{getWindCardinal(windDir)}</p>
            <p className="compass-gusts readable">Gusts {gustMph} mph</p>
          </div>
        </div>
      </div>

      {/* ZONE 3 — BOTTOM PANEL */}
      <div className="zone-bottom readable">
        <div className="card-row">
          <div className="data-card">
            <p className="card-label">Humidity</p>
            <p className="card-value">
              {w.humidity != null ? `${Math.round(w.humidity)}%` : '—'}
            </p>
          </div>
          <div className="data-card">
            <p className="card-label">UV Index</p>
            <p className="card-value">
              {w.uv_index != null ? w.uv_index : '—'}
            </p>
            <p className="card-sub" style={{ color: getUvLabelColor(w.uv_index) }}>
              {getUvLabel(w.uv_index)}
            </p>
          </div>
          <div className="data-card">
            <p className="card-label">Rain Chance</p>
            <p className="card-value">
              {precipProb != null ? `${Math.round(precipProb)}%` : '—'}
            </p>
          </div>
          <div className="data-card">
            <p className="card-label">Wind Gusts</p>
            <p className="card-value">{gustMph} mph</p>
          </div>
          <div className="data-card">
            <p className="card-label">Sunset</p>
            <p className="card-value">8:14 PM</p>
          </div>
        </div>
        <div className="card-row">
          {(hourly?.time || []).slice(0, 4).map((t, i) => {
            const precip = hourly.precip_probability?.[i]
            const rainHigh = precip != null && precip > 30
            return (
              <div key={i} className="data-card forecast-card">
                <p className="card-label">{formatHourLabel(t)}</p>
                <p className="card-value">
                  {hourly.temperature?.[i] != null
                    ? `${Math.round(hourly.temperature[i])}°`
                    : '—'}
                </p>
                <p
                  className={`card-sub type-tertiary${rainHigh ? ' forecast-rain-high' : ''}`}
                >
                  {precip != null ? `${Math.round(precip)}%` : '—'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ZONE 4 — MESSAGE BAR */}
      <footer className="zone-message readable">
        <img className="msg-logo" src={LOGO_URL} alt="" aria-hidden="true" />
        <div className="msg-body">
          {MESSAGES.map((msg, i) => (
            <p
              key={i}
              className={`msg-text readable${i === messageIndex ? ' active' : ''}`}
            >
              {msg}
            </p>
          ))}
        </div>
        <img
          className="msg-logo msg-logo-mirror"
          src={LOGO_URL}
          alt=""
          aria-hidden="true"
        />
      </footer>
    </div>
  )
}
