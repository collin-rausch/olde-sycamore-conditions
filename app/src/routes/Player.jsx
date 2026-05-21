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

const MESSAGE_BAR_BG = '#1a3d2e'

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
  const d = isoOrTime.includes('T') ? new Date(isoOrTime) : null
  if (d && !isNaN(d.getTime())) {
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    })
  }
  return String(isoOrTime)
}

function getUvLabel(uv) {
  if (uv == null) return '—'
  if (uv <= 2) return 'Low'
  if (uv <= 5) return 'Moderate'
  if (uv <= 7) return 'High'
  if (uv <= 10) return 'Very High'
  return 'Extreme'
}

function getTimeGreeting(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning for golf'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
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
  const tempGlowColor = visual.skyTintColor

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

        .player-scene .overlay-text {
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
        }

        .scene-background {
          position: absolute;
          inset: 0;
          z-index: 1;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 60%;
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

        .weather-tint { z-index: 2; }
        .ambient-tint { z-index: 3; }
        .scene-vignette { z-index: 4; }

        .scene-rain {
          position: absolute;
          inset: 0;
          z-index: 5;
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

        .glass-card {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 14px;
          padding: 0.75rem 1rem;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
        }

        .glass-card-label {
          font-size: clamp(0.65rem, 1.1vw, 0.8rem);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          opacity: 0.75;
          margin: 0 0 0.25rem;
        }

        .glass-card-value {
          font-size: clamp(1rem, 1.8vw, 1.25rem);
          font-weight: 600;
          margin: 0;
          line-height: 1.2;
        }

        .glass-card-sub {
          font-size: clamp(0.7rem, 1.2vw, 0.85rem);
          opacity: 0.7;
          margin: 0.2rem 0 0;
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
          padding: 1.75rem 2.5rem 1rem;
          pointer-events: none;
        }

        .header-brand {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .club-logo {
          height: clamp(52px, 8vw, 72px);
          width: auto;
          filter: brightness(0) invert(1) drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
        }

        .club-tagline {
          font-size: clamp(0.8rem, 1.5vw, 1rem);
          opacity: 0.88;
          margin: 0;
          letter-spacing: 0.02em;
        }

        .header-clock {
          text-align: right;
        }

        .live-clock {
          font-size: clamp(2.8rem, 7vw, 5.5rem);
          font-weight: 700;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }

        .live-date {
          font-size: clamp(0.95rem, 1.8vw, 1.2rem);
          opacity: 0.65;
          margin: 0.35rem 0 0;
          font-weight: 400;
        }

        .info-rail {
          position: absolute;
          top: clamp(7.5rem, 14vh, 10rem);
          left: 2.5rem;
          z-index: 20;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          pointer-events: none;
        }

        .info-rail-item {
          font-size: clamp(0.85rem, 1.5vw, 1.05rem);
          opacity: 0.9;
          margin: 0;
        }

        .info-rail-greeting {
          font-size: clamp(1rem, 1.8vw, 1.2rem);
          font-weight: 500;
          opacity: 0.95;
        }

        .uv-advisory {
          font-size: clamp(0.8rem, 1.4vw, 0.95rem);
          padding: 0.35rem 0.65rem;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.15);
          display: inline-block;
        }

        .overlay-center {
          position: absolute;
          top: 38%;
          left: 0;
          right: 0;
          width: 100%;
          z-index: 20;
          text-align: center;
          pointer-events: none;
        }

        .temp-block {
          position: relative;
          display: inline-block;
        }

        .temp-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: clamp(220px, 42vw, 480px);
          height: clamp(160px, 28vw, 340px);
          border-radius: 50%;
          filter: blur(48px);
          opacity: 0.55;
          pointer-events: none;
          transition: background-color 2.5s ease, opacity 2.5s ease;
        }

        .temp-row {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.25rem;
        }

        .temp-wind-arrow {
          font-size: clamp(1.5rem, 3vw, 2.5rem);
          opacity: 0.55;
          line-height: 1;
          display: inline-block;
        }

        .temp-large {
          font-size: clamp(5.5rem, 15vw, 12rem);
          font-weight: 200;
          line-height: 1;
          margin: 0;
          letter-spacing: -0.03em;
        }

        .temp-unit {
          font-size: 0.38em;
          vertical-align: super;
          font-weight: 300;
          opacity: 0.85;
        }

        .condition-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        .condition-icon {
          font-size: clamp(1.4rem, 3vw, 2rem);
          line-height: 1;
        }

        .condition-text {
          font-size: clamp(1.15rem, 2.8vw, 2rem);
          font-weight: 500;
          margin: 0;
          text-transform: capitalize;
        }

        .feels-like {
          font-size: clamp(1rem, 2vw, 1.45rem);
          opacity: 0.8;
          margin: 0.4rem 0 0;
        }

        .wind-compass-wrap {
          position: absolute;
          right: 2.5rem;
          top: 42%;
          transform: translateY(-50%);
          z-index: 20;
          text-align: center;
          pointer-events: none;
        }

        .wind-compass {
          width: clamp(140px, 18vw, 200px);
          height: clamp(140px, 18vw, 200px);
          border: 3px solid rgba(255, 255, 255, 0.45);
          border-radius: 50%;
          position: relative;
          background: rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(8px);
          margin: 0 auto;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
        }

        .wind-compass-inner {
          position: absolute;
          inset: 8%;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .wind-label {
          position: absolute;
          font-size: clamp(0.75rem, 1.4vw, 0.95rem);
          font-weight: 600;
          opacity: 0.55;
        }

        .wind-label-n {
          top: 6%;
          left: 50%;
          transform: translateX(-50%);
          opacity: 1;
          font-size: clamp(0.9rem, 1.6vw, 1.1rem);
          color: var(--accent-n, #ffffff);
          filter: brightness(1.4);
        }

        .wind-label-s { bottom: 6%; left: 50%; transform: translateX(-50%); }
        .wind-label-e { right: 6%; top: 50%; transform: translateY(-50%); }
        .wind-label-w { left: 6%; top: 50%; transform: translateY(-50%); }

        .wind-needle {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 5px;
          height: 44%;
          margin-left: -2.5px;
          margin-top: -44%;
          background: #ffffff;
          transform-origin: bottom center;
          border-radius: 3px;
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.4);
        }

        .wind-needle::after {
          content: '';
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-bottom: 14px solid #ffffff;
        }

        .wind-speed-text {
          font-size: clamp(1.6rem, 3.5vw, 2.4rem);
          margin-top: 1rem;
          font-weight: 700;
          line-height: 1;
        }

        .wind-cardinal {
          font-size: clamp(1rem, 2vw, 1.35rem);
          opacity: 0.85;
          margin: 0.35rem 0 0;
          font-weight: 500;
        }

        .wind-gusts {
          font-size: clamp(0.8rem, 1.4vw, 1rem);
          opacity: 0.6;
          margin: 0.25rem 0 0;
        }

        .bottom-dashboard {
          position: absolute;
          bottom: 4.5rem;
          left: 2rem;
          right: 2rem;
          z-index: 20;
          display: flex;
          align-items: stretch;
          justify-content: space-between;
          gap: 1rem;
          pointer-events: none;
        }

        .stat-cards {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
          flex: 1;
          align-items: stretch;
        }

        .stat-cards .glass-card {
          min-width: clamp(90px, 11vw, 130px);
          flex: 1 1 auto;
        }

        .forecast-cards {
          display: flex;
          gap: 0.65rem;
          flex-shrink: 0;
        }

        .forecast-slot {
          min-width: clamp(72px, 9vw, 100px);
          text-align: center;
        }

        .forecast-slot .hour-temp {
          font-size: clamp(1.1rem, 2vw, 1.35rem);
          font-weight: 700;
          margin: 0.15rem 0;
        }

        .forecast-precip {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.2rem;
          font-size: clamp(0.75rem, 1.2vw, 0.9rem);
          opacity: 0.8;
          margin: 0;
        }

        .message-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 25;
          height: clamp(3.2rem, 6vh, 4rem);
          display: flex;
          align-items: center;
          padding: 0 1.5rem;
          gap: 1.25rem;
        }

        .message-body {
          flex: 1;
          position: relative;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .message-text {
          position: absolute;
          font-size: clamp(0.85rem, 1.6vw, 1.1rem);
          text-align: center;
          padding: 0 1rem;
          opacity: 0;
          transition: opacity 1.2s ease;
          max-width: 100%;
        }

        .message-text.active {
          opacity: 1;
        }

        .message-dots {
          display: flex;
          gap: 0.4rem;
          flex-shrink: 0;
        }

        .message-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.25);
          transition: background 0.4s ease, transform 0.4s ease;
        }

        .message-dot.active {
          background: rgba(255, 255, 255, 0.9);
          transform: scale(1.15);
        }

        .player-error-badge {
          position: absolute;
          top: 5.5rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 30;
          background: rgba(0, 0, 0, 0.65);
          padding: 0.35rem 1rem;
          border-radius: 4px;
          font-size: 0.85rem;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
        }
      `}</style>

      {/* 1. Background photo */}
      <img
        className="scene-background"
        src={BACKGROUND_IMAGE_URL}
        alt="Olde Sycamore Golf Club"
        style={{
          filter: `brightness(${visual.sceneExposure}) contrast(${visual.sceneContrast}) saturate(${visual.sceneSaturation})`,
        }}
      />

      {/* 2. Sky tint overlay */}
      <div
        className="weather-tint"
        style={{
          backgroundColor: visual.skyTintColor,
          opacity: visual.skyTintOpacity,
        }}
      />

      {/* 3. Ambient color temperature */}
      <div
        className="ambient-tint"
        style={{ backgroundColor: visual.ambientTintColor }}
      />

      {/* 4. Vignette */}
      <div
        className="scene-vignette"
        style={{
          background: `radial-gradient(ellipse at center, transparent 42%, rgba(0, 0, 0, ${visual.vignetteOpacity}) 100%)`,
        }}
      />

      {/* 5. Rain animation layer */}
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

      {/* ── Data overlays ── */}
      <header className="overlay-header">
        <div className="header-brand">
          <img
            className="club-logo overlay-text"
            src={LOGO_URL}
            alt="Olde Sycamore Golf Club"
          />
          <p className="club-tagline overlay-text">
            18 holes · Est. 1997 · Tom Jackson design
          </p>
        </div>
        <div className="header-clock overlay-text">
          <div className="live-clock">{clockStr}</div>
          <p className="live-date">{dateStr}</p>
        </div>
      </header>

      {error && (
        <div className="player-error-badge overlay-text">Error: {error}</div>
      )}

      <div className="info-rail overlay-text">
        <p className="info-rail-item">Sunrise 6:08 AM</p>
        <p className="info-rail-greeting">{getTimeGreeting(easternHour)}</p>
        {showUvAdvisory && (
          <span className="uv-advisory">
            High UV · Sun protection advised
          </span>
        )}
      </div>

      <div className="overlay-center">
        <div className="temp-block">
          <div
            className="temp-glow"
            style={{ backgroundColor: tempGlowColor }}
          />
          <div className="temp-row">
            <span
              className="temp-wind-arrow overlay-text"
              style={{ transform: `rotate(${windDir}deg)` }}
              aria-hidden="true"
            >
              ↑
            </span>
            <p className="temp-large overlay-text">
              {tempDisplay}
              <span className="temp-unit">°F</span>
            </p>
          </div>
          <div className="condition-row overlay-text">
            {w.icon && (
              <span className="condition-icon" aria-hidden="true">
                {w.icon}
              </span>
            )}
            <p className="condition-text">{w.condition_text || '—'}</p>
          </div>
          <p className="feels-like overlay-text">Feels like {feelsDisplay}°</p>
        </div>
      </div>

      <div className="wind-compass-wrap overlay-text">
        <div
          className="wind-compass"
          style={{ '--accent-n': visual.skyTintColor }}
        >
          <div className="wind-compass-inner" />
          <span className="wind-label wind-label-n">N</span>
          <span className="wind-label wind-label-s">S</span>
          <span className="wind-label wind-label-e">E</span>
          <span className="wind-label wind-label-w">W</span>
          <div
            className="wind-needle"
            style={{ transform: `rotate(${windDir}deg)` }}
          />
        </div>
        <p className="wind-speed-text">
          {windSpeed != null ? `${Math.round(windSpeed)}` : '—'}
          <span style={{ fontSize: '0.55em', fontWeight: 500 }}> mph</span>
        </p>
        <p className="wind-cardinal">{getWindCardinal(windDir)}</p>
        <p className="wind-gusts">Gusts {gustMph} mph</p>
      </div>

      <div className="bottom-dashboard">
        <div className="stat-cards">
          <div className="glass-card">
            <p className="glass-card-label">Humidity</p>
            <p className="glass-card-value">
              {w.humidity != null ? `${Math.round(w.humidity)}%` : '—'}
            </p>
          </div>
          <div className="glass-card">
            <p className="glass-card-label">UV Index</p>
            <p className="glass-card-value">
              {w.uv_index != null ? w.uv_index : '—'}
            </p>
            <p className="glass-card-sub">{getUvLabel(w.uv_index)}</p>
          </div>
          <div className="glass-card">
            <p className="glass-card-label">Rain Chance</p>
            <p className="glass-card-value">
              {precipProb != null ? `${Math.round(precipProb)}%` : '—'}
            </p>
          </div>
          <div className="glass-card">
            <p className="glass-card-label">Sunset</p>
            <p className="glass-card-value">8:14 PM</p>
          </div>
          <div className="glass-card">
            <p className="glass-card-label">Wind Gusts</p>
            <p className="glass-card-value">{gustMph} mph</p>
          </div>
        </div>

        <div className="forecast-cards">
          {(hourly?.time || []).slice(0, 4).map((t, i) => {
            const precip = hourly.precip_probability?.[i]
            return (
              <div key={i} className="glass-card forecast-slot">
                <p className="glass-card-label">{formatHourLabel(t)}</p>
                <p className="hour-temp overlay-text">
                  {hourly.temperature?.[i] != null
                    ? `${Math.round(hourly.temperature[i])}°`
                    : '—'}
                </p>
                <p className="forecast-precip overlay-text">
                  {precip != null && precip > 0 && (
                    <span aria-hidden="true">💧</span>
                  )}
                  {precip != null ? `${Math.round(precip)}%` : '—'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <div
        className="message-bar"
        style={{ backgroundColor: MESSAGE_BAR_BG }}
      >
        <div className="message-body">
          {MESSAGES.map((msg, i) => (
            <p
              key={i}
              className={`message-text overlay-text${i === messageIndex ? ' active' : ''}`}
            >
              {msg}
            </p>
          ))}
        </div>
        <div className="message-dots" aria-hidden="true">
          {MESSAGES.map((_, i) => (
            <span
              key={i}
              className={`message-dot${i === messageIndex ? ' active' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
