import React, { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { connectScreenCloud, getScreenCloud } from '@screencloud/apps-sdk'
import { createVisualStateStore, getVisualState } from '../lib/weatherVisuals'

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

/** Map flagIntensity 0–1 → animation duration 8s (calm) to 0.8s (windy). */
function flagSwayDuration(intensity) {
  const t = Math.min(1, Math.max(0, intensity ?? 0))
  return `${8 - t * 7.2}s`
}

export default function Player() {
  const [weather, setWeather] = useState(null)
  const [error, setError] = useState(null)
  const [started, setStarted] = useState(false)
  const [clock, setClock] = useState(() => new Date())
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

        .scene-flag {
          position: absolute;
          bottom: 28%;
          left: 58%;
          z-index: 6;
          width: 28px;
          height: 36px;
          pointer-events: none;
          transform-origin: bottom center;
        }

        .scene-flag-pole {
          position: absolute;
          bottom: 0;
          left: 50%;
          width: 2px;
          height: 100%;
          margin-left: -1px;
          background: rgba(255, 255, 255, 0.85);
        }

        .scene-flag-cloth {
          position: absolute;
          top: 2px;
          left: 50%;
          width: 18px;
          height: 12px;
          background: #c41e3a;
          transform-origin: left center;
          animation: flag-sway ease-in-out infinite;
        }

        @keyframes flag-sway {
          0%, 100% { transform: skewY(0deg) scaleX(1); }
          50% { transform: skewY(5deg) scaleX(0.9); }
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
          animation: rain-fall linear infinite;
        }

        @keyframes rain-fall {
          0% {
            transform: translateY(-30px) rotate(var(--rain-angle, 12deg));
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(var(--rain-angle, 12deg));
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

      {/* Flag sway driven by wind */}
      <div
        className="scene-flag"
        aria-hidden="true"
      >
        <div className="scene-flag-pole" />
        <div
          className="scene-flag-cloth"
          style={{ animationDuration: flagSwayDuration(visual.flagIntensity) }}
        />
      </div>

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
