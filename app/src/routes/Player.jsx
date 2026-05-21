import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { connectScreenCloud, getScreenCloud } from '@screencloud/apps-sdk'

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

const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99])
const OVERCAST_CODES = new Set([3, 45, 48])

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

function isGoldenHour(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 12)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  const mins = hour * 60 + minute
  const morning = mins >= 360 && mins <= 450
  const evening = mins >= 1050 && mins <= 1170
  return morning || evening
}

function isRainWeather(code, precip) {
  return RAIN_CODES.has(code) || (precip != null && precip > 40)
}

function getSkyGradient(isDay, weatherCode, precip) {
  if (isRainWeather(weatherCode, precip)) {
    return 'linear-gradient(180deg, #4a4a4a 0%, #2d2d2d 100%)'
  }
  if (OVERCAST_CODES.has(weatherCode)) {
    return 'linear-gradient(180deg, #8b9aab 0%, #6b7a8d 100%)'
  }
  if (isDay === 0) {
    return 'linear-gradient(180deg, #0a1628 0%, #1a2744 100%)'
  }
  if (isGoldenHour(new Date())) {
    return 'linear-gradient(180deg, #f4a261 0%, #e76f51 50%, #d4a574 100%)'
  }
  return 'linear-gradient(180deg, #4a90d9 0%, #87ceeb 100%)'
}

function getHourET(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date)
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 12)
}

function getWeatherTintOverlay(isDay, weatherCode, precip, date) {
  if (isDay === 0) return 'rgba(5, 10, 30, 0.62)'
  if (weatherCode >= 95 && weatherCode <= 99) return 'rgba(10, 15, 25, 0.6)'
  if ((weatherCode >= 51 && weatherCode <= 82) || (precip != null && precip > 40)) {
    return 'rgba(20, 40, 60, 0.48)'
  }
  if (weatherCode >= 45 && weatherCode <= 48) return 'rgba(80, 90, 100, 0.38)'
  if (weatherCode === 3) return 'rgba(60, 70, 80, 0.25)'
  const hour = getHourET(date)
  if (hour >= 17 && hour <= 20) return 'rgba(160, 70, 10, 0.2)'
  if (weatherCode >= 0 && weatherCode <= 2) return 'rgba(0, 0, 0, 0.12)'
  return 'rgba(0, 0, 0, 0.12)'
}

const BACKGROUND_IMAGE_URL =
  'https://xntieyqrodsjelotcmnr.supabase.co/storage/v1/object/public/assets/img-olde-sycamore-1.webp'

function getCardinalLabel(deg) {
  if (deg == null) return '—'
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8
  return dirs[idx]
}

function formatHourLabel(isoOrTime) {
  if (!isoOrTime) return '—'
  const d = isoOrTime.includes('T') ? new Date(isoOrTime) : null
  if (d && !isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      timeZone: 'America/New_York',
    })
  }
  return String(isoOrTime).replace(/.*T(\d{2}):(\d{2}).*/, (_, h, m) => {
    const hr = parseInt(h, 10) % 12 || 12
    const ampm = parseInt(h, 10) >= 12 ? 'PM' : 'AM'
    return `${hr}${ampm}`
  })
}

function CloudShape({ x, y, scale, opacity }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`} opacity={opacity}>
      <ellipse cx="40" cy="30" rx="35" ry="22" fill="#f0f4f8" />
      <ellipse cx="70" cy="28" rx="28" ry="20" fill="#f0f4f8" />
      <ellipse cx="95" cy="32" rx="32" ry="18" fill="#f0f4f8" />
      <ellipse cx="55" cy="22" rx="25" ry="16" fill="#ffffff" />
    </g>
  )
}

export default function Player() {
  const [weather, setWeather] = useState(null)
  const [error, setError] = useState(null)
  const [started, setStarted] = useState(false)
  const [clock, setClock] = useState(() => new Date())

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

  const w = weather || DEFAULT_WEATHER
  const hourly = useMemo(() => parseHourlyForecast(w.hourly_forecast), [w.hourly_forecast])

  const isDay = w.is_day ?? 1
  const weatherCode = w.weather_code ?? 0
  const cloudCover = w.cloud_cover ?? 0
  const precipProb = w.precip_probability ?? 0
  const windSpeed = w.wind_speed_mph ?? 0
  const windDir = w.wind_direction ?? 0
  const showRain = precipProb > 40

  const weatherTint = getWeatherTintOverlay(isDay, weatherCode, precipProb, clock)
  const showRainLayer =
    showRain ||
    (weatherCode >= 51 && weatherCode <= 82) ||
    RAIN_CODES.has(weatherCode)

  const clockStr = clock.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })

  const tempDisplay =
    w.temperature_f != null ? Math.round(w.temperature_f) : '--'
  const feelsDisplay =
    w.feels_like_f != null ? Math.round(w.feels_like_f) : '--'

  return (
    <div className="player-scene">
      <style>{`
        .player-scene {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #ffffff;
        }

        .scene-background {
          position: absolute;
          inset: 0;
          z-index: 1;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 60%;
        }

        .weather-tint {
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          transition: background-color 2s ease;
        }

        .scene-rain {
          position: absolute;
          inset: 0;
          z-index: 3;
          pointer-events: none;
          overflow: hidden;
        }

        .rain-drop {
          position: absolute;
          width: 1px;
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(200, 215, 235, 0.15) 40%,
            rgba(200, 215, 235, 0.45) 100%
          );
          transform: rotate(12deg);
          animation: rain-fall linear infinite;
        }

        @keyframes rain-fall {
          0% {
            transform: translateY(-30px) rotate(12deg);
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(12deg);
            opacity: 0;
          }
        }

        .overlay-header {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 20;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 2rem 2.5rem;
          pointer-events: none;
        }

        .club-name {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(1.4rem, 3vw, 2.4rem);
          font-weight: 700;
          letter-spacing: 0.04em;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
          margin: 0;
        }

        .club-sub {
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(0.85rem, 1.8vw, 1.2rem);
          opacity: 0.9;
          margin: 0.35rem 0 0;
          font-weight: 400;
        }

        .live-clock {
          font-size: clamp(1.2rem, 2.5vw, 2rem);
          font-weight: 300;
          font-variant-numeric: tabular-nums;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        }

        .overlay-center {
          position: absolute;
          top: 42%;
          left: 0;
          right: 0;
          width: 100%;
          z-index: 20;
          text-align: center;
          pointer-events: none;
        }

        .temp-large {
          font-size: clamp(5rem, 14vw, 11rem);
          font-weight: 200;
          line-height: 1;
          text-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
          margin: 0;
        }

        .temp-unit {
          font-size: 0.45em;
          vertical-align: super;
          font-weight: 300;
        }

        .condition-text {
          font-size: clamp(1.2rem, 3vw, 2.2rem);
          font-weight: 500;
          margin: 0.25rem 0 0;
          text-transform: capitalize;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
        }

        .feels-like {
          font-size: clamp(1rem, 2vw, 1.5rem);
          opacity: 0.85;
          margin: 0.5rem 0 0;
        }

        .wind-compass-wrap {
          position: absolute;
          right: 2.5rem;
          top: 50%;
          transform: translateY(-50%);
          z-index: 20;
          text-align: center;
          pointer-events: none;
        }

        .wind-compass {
          width: clamp(80px, 12vw, 120px);
          height: clamp(80px, 12vw, 120px);
          border: 2px solid rgba(255, 255, 255, 0.5);
          border-radius: 50%;
          position: relative;
          background: rgba(0, 0, 0, 0.2);
          margin: 0 auto;
        }

        .wind-arrow {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 4px;
          height: 42%;
          margin-left: -2px;
          margin-top: -42%;
          background: #ffffff;
          transform-origin: bottom center;
          border-radius: 2px;
        }

        .wind-arrow::after {
          content: '';
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 10px solid #ffffff;
        }

        .wind-label-n, .wind-label-e, .wind-label-s, .wind-label-w {
          position: absolute;
          font-size: 0.65rem;
          opacity: 0.7;
        }
        .wind-label-n { top: 4px; left: 50%; transform: translateX(-50%); }
        .wind-label-s { bottom: 4px; left: 50%; transform: translateX(-50%); }
        .wind-label-e { right: 6px; top: 50%; transform: translateY(-50%); }
        .wind-label-w { left: 6px; top: 50%; transform: translateY(-50%); }

        .wind-speed-text {
          font-size: clamp(1rem, 2vw, 1.4rem);
          margin-top: 0.75rem;
          font-weight: 600;
        }

        .wind-cardinal {
          font-size: clamp(0.85rem, 1.5vw, 1.1rem);
          opacity: 0.8;
        }

        .bottom-strip {
          position: absolute;
          bottom: 2.8rem;
          left: 0;
          right: 0;
          z-index: 20;
          background: rgba(0, 0, 0, 0.55);
          padding: 0.85rem 1.5rem;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 1.5rem 2rem;
          font-size: clamp(0.75rem, 1.4vw, 1rem);
        }

        .strip-stat {
          white-space: nowrap;
        }

        .strip-stat strong {
          font-weight: 600;
          margin-right: 0.35rem;
        }

        .hourly-forecast {
          display: flex;
          gap: clamp(0.75rem, 2vw, 1.5rem);
          margin-left: auto;
          flex-wrap: wrap;
        }

        .hour-slot {
          text-align: center;
          min-width: 3.5rem;
        }

        .hour-slot .hour-time {
          opacity: 0.75;
          font-size: 0.85em;
        }

        .hour-slot .hour-temp {
          font-weight: 700;
          font-size: 1.1em;
        }

        .hour-slot .hour-precip {
          opacity: 0.7;
          font-size: 0.8em;
        }

        .message-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 25;
          background: #1a3d2e;
          height: 2.8rem;
          overflow: hidden;
          display: flex;
          align-items: center;
        }

        .message-scroll {
          white-space: nowrap;
          animation: scroll-msg 28s linear infinite;
          font-size: clamp(0.85rem, 1.6vw, 1.1rem);
          padding-left: 100%;
        }

        @keyframes scroll-msg {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }

        .player-error-badge {
          position: absolute;
          top: 5.5rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 30;
          background: rgba(196, 30, 58, 0.85);
          padding: 0.35rem 1rem;
          border-radius: 4px;
          font-size: 0.85rem;
        }
      `}</style>

      {/* 1. Background photo */}
      <img
        className="scene-background"
        src={BACKGROUND_IMAGE_URL}
        alt="Olde Sycamore Golf Club"
      />

      {/* 2. Weather tint overlay */}
      <div
        className="weather-tint"
        style={{ backgroundColor: weatherTint }}
      />

      {/* 3. Rain animation layer */}
      {showRainLayer && (
        <div className="scene-rain">
          {Array.from({ length: 60 }, (_, i) => (
            <div
              key={i}
              className="rain-drop"
              style={{
                left: `${(i * 13.7 + (i % 5) * 3) % 100}%`,
                height: `${10 + (i % 6) * 3}px`,
                opacity: 0.2 + (i % 5) * 0.08,
                animationDuration: `${0.55 + (i % 8) * 0.12}s`,
                animationDelay: `${(i % 18) * 0.06}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Data overlays */}
      <header className="overlay-header">
        <div>
          <h1 className="club-name">Olde Sycamore Golf Club</h1>
          <p className="club-sub">Charlotte, NC · 18 holes · Est. 1997</p>
          </div>
        <div className="live-clock">{clockStr}</div>
      </header>

      {error && <div className="player-error-badge">Error: {error}</div>}

      <div className="overlay-center">
        <p className="temp-large">
          {tempDisplay}
          <span className="temp-unit">°F</span>
        </p>
        <p className="condition-text">{w.condition_text || '—'}</p>
        <p className="feels-like">Feels like {feelsDisplay}°</p>
      </div>

      <div className="wind-compass-wrap">
        <div className="wind-compass">
          <span className="wind-label-n">N</span>
          <span className="wind-label-s">S</span>
          <span className="wind-label-e">E</span>
          <span className="wind-label-w">W</span>
          <div
            className="wind-arrow"
            style={{ transform: `rotate(${windDir}deg)` }}
          />
        </div>
        <p className="wind-speed-text">
          {windSpeed != null ? `${Math.round(windSpeed)} mph` : '—'}
        </p>
        <p className="wind-cardinal">{getCardinalLabel(windDir)}</p>
      </div>

      <div className="bottom-strip">
        <span className="strip-stat">
          <strong>Humidity</strong>
          {w.humidity != null ? `${Math.round(w.humidity)}%` : '—'}
        </span>
        <span className="strip-stat">
          <strong>UV</strong>
          {w.uv_index != null ? w.uv_index : '—'}
        </span>
        <span className="strip-stat">
          <strong>Precip</strong>
          {precipProb != null ? `${Math.round(precipProb)}%` : '—'}
        </span>
        <span className="strip-stat">
          <strong>Feels</strong>
          {feelsDisplay}°
        </span>
        <div className="hourly-forecast">
          {(hourly?.time || []).slice(0, 6).map((t, i) => (
            <div key={i} className="hour-slot">
              <div className="hour-time">{formatHourLabel(t)}</div>
              <div className="hour-temp">
                {hourly.temperature?.[i] != null
                  ? `${Math.round(hourly.temperature[i])}°`
                  : '—'}
              </div>
              <div className="hour-precip">
                {hourly.precip_probability?.[i] != null
                  ? `${Math.round(hourly.precip_probability[i])}%`
                  : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="message-bar">
        <div className="message-scroll">
          Happy hour on the patio 4–7 PM · Twilight rates from $45 · Olde Sycamore Golf Club · Charlotte, NC
        </div>
      </div>
    </div>
  )
}
