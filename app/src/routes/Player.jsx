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
]

const COMMUNITY_ITEMS = [
  {
    type: 'HOLE IN ONE',
    name: 'Robert Chen',
    detail: 'Hole 7 · 162 yds · 7-iron · May 21',
  },
  {
    type: 'LOW ROUND',
    name: 'J. Williams',
    detail: '68 · May 20 · -4 under par',
  },
  {
    type: 'UPCOMING',
    name: "Men's Invitational",
    detail: 'May 24–26 · Registration open',
  },
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

const PANEL_BG_PRESETS = {
  dark_green: 'rgba(6,14,8,0.82)',
  dark_navy: 'rgba(6,12,24,0.82)',
  dark_charcoal: 'rgba(18,18,18,0.82)',
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

function resolvePanelBackground(panelBg, panelBgCustom) {
  if (panelBg === 'custom') return panelBgCustom || '#0a1a0a'
  return PANEL_BG_PRESETS[panelBg] || PANEL_BG_PRESETS.dark_green
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

function buildCommunityDisplay(communityItems) {
  const items = []
  const achievements = (communityItems?.achievements || []).filter((a) => a.enabled !== false)
  achievements.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  for (const a of achievements.slice(0, 5)) {
    items.push({
      key: a.id,
      type: String(a.type || 'ACHIEVEMENT').toUpperCase(),
      name: a.name,
      detail: a.detail,
    })
  }
  const events = (communityItems?.events || []).filter((e) => e.enabled !== false)
  for (const e of events.slice(0, 3)) {
    items.push({
      key: e.id,
      type: 'UPCOMING',
      name: e.name,
      detail: e.detail,
    })
  }
  return items.length ? items : COMMUNITY_ITEMS.map((item, i) => ({ ...item, key: `default-${i}` }))
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
    color: 'var(--os-green-badge)',
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

function getUvLabelColor(uv) {
  if (uv == null) return 'var(--os-white-80)'
  if (uv <= 2) return 'var(--os-white-80)'
  if (uv <= 5) return '#fbbf24'
  if (uv <= 7) return '#f97316'
  if (uv <= 10) return '#ef4444'
  return '#a855f7'
}

function getUvRowText(uv) {
  if (uv == null) return '—'
  return `${uv} · ${getUvLabel(uv)}`
}

function getRainSummary(precip) {
  if (precip == null || precip <= 20) return null
  if (precip > 60) return 'Heavy rain likely today'
  if (precip >= 40) return 'Rain likely this afternoon'
  return 'Chance of showers later'
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
      <div className="slot-subheader">
        <p className="slot-title">{title}</p>
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

function renderPanelForecast(slots) {
  if (!slots || slots.length === 0) {
    return <p className="panel-forecast-empty">Forecast unavailable</p>
  }

  return (
    <div className="panel-forecast">
      {slots.map((slot, i) => {
        const precipVal = slot.precip ?? 0
        const rainHigh = precipVal >= 30
        return (
          <div
            key={`${slot.time}-${i}`}
            className={`panel-forecast-col${i < slots.length - 1 ? ' panel-forecast-col-divider' : ''}`}
          >
            <p className="panel-forecast-time">{formatHourCompact(slot.time)}</p>
            <p className="panel-forecast-temp">
              {slot.temp != null ? `${Math.round(slot.temp)}°` : '—'}
            </p>
            <p
              className={`panel-forecast-rain${rainHigh ? ' panel-forecast-rain-high' : ''}`}
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
      {tips.map((tip, i) => (
        <div
          key={i}
          className={`tip-row${i < tips.length - 1 ? ' tip-row-border' : ''}`}
        >
          <TablerIcon name={tip.icon} />
          <p className="tip-text">{tip.text}</p>
        </div>
      ))}
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
  const panelBgColor = resolvePanelBackground(
    clubSettings?.panel_bg,
    clubSettings?.panel_bg_custom,
  )
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
      label: r.label,
      value: r.value,
      highlight: r.highlight,
    }))
  }, [clubSettings?.pro_shop_rows])

  const proShopTitle = clubSettings?.pro_shop_title || 'Pro Shop & Dining'

  const communityItems = useMemo(
    () => buildCommunityDisplay(clubSettings?.community_items).slice(0, 3),
    [clubSettings?.community_items],
  )

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
    if (activeSlots.length === 0) return

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
  }, [activeSlots.length])

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

  const showRain = (precipProb ?? 0) > 40

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
  const uvColor = getUvLabelColor(uvValue)
  const uvRowText = getUvRowText(uvValue)
  const rainLabelText =
    precipProb != null ? `${Math.round(precipProb)}%` : '—'
  const rainSummary = getRainSummary(precipProb)

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
    '--os-green-label': accentColor,
  }

  return (
    <div className="player-root" style={playerRootStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700&display=swap');

        .player-root {
          --os-green-label: #7ab648;
          --os-white: #ffffff;
          --os-white-80: rgba(255, 255, 255, 0.82);
          --os-white-55: rgba(255, 255, 255, 0.55);
          --os-white-40: rgba(255, 255, 255, 0.40);
          --os-divider: rgba(255, 255, 255, 0.07);
          --os-card: rgba(0, 0, 0, 0.22);
          --os-card-border: rgba(255, 255, 255, 0.10);
          --os-green-badge: #4ade80;
          --os-blue: #60a5fa;
          --os-amber: #fbbf24;
          --os-red: #ef4444;
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: var(--os-white);
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
          background: linear-gradient(180deg, transparent 0%, rgba(200, 220, 240, 0.35) 100%);
          animation: rain-fall linear infinite;
        }

        @keyframes rain-fall {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 0.35; }
          90% { opacity: 0.35; }
          100% { transform: translateY(115vh); opacity: 0; }
        }

        .gradient-top, .gradient-bottom, .gradient-left {
          position: absolute;
          z-index: 3;
          pointer-events: none;
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
          gap: clamp(10px, 1.4vh, 16px);
        }

        .condition-stack-label {
          margin: 0;
          font-size: clamp(8px, 0.85vw, 10px);
          color: #7ab648;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          font-weight: 500;
        }

        .condition-stack-value {
          margin: 2px 0 0;
          font-size: clamp(13px, 1.5vw, 17px);
          font-weight: 400;
          color: #fff;
        }

        .condition-stack-divider {
          width: 22px;
          height: 0.5px;
          background: rgba(122, 182, 72, 0.28);
          margin-top: 3px;
        }

        .center-card {
          position: absolute;
          top: 50%;
          left: 62%;
          transform: translate(-50%, -50%);
          width: clamp(300px, 38vw, 480px);
          background: rgba(0, 0, 0, 0.22);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          border: 0.5px solid rgba(255, 255, 255, 0.10);
          border-radius: 18px;
          padding: clamp(16px, 2.2vh, 24px) clamp(18px, 2.2vw, 24px);
        }

        .card-slot-label {
          display: flex;
          align-items: center;
          gap: 5px;
          margin: 0 0 clamp(10px, 1.4vh, 16px);
          font-size: clamp(10px, 1.1vw, 12px);
          color: var(--os-green-label);
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

        .card-content { transition: opacity 0.6s ease; }

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
          font-weight: 300;
          color: var(--os-white);
        }

        .slot-live { margin: 0; font-size: 11px; color: var(--os-green-badge); }
        .slot-round { margin: 0; font-size: clamp(11px, 1.2vw, 13px); color: var(--os-green-label); }

        .lb-row {
          display: grid;
          grid-template-columns: 18px 1fr auto auto;
          align-items: center;
          gap: 8px;
          padding: clamp(6px, 1vh, 9px) 0;
        }

        .slot-pro .lb-row { grid-template-columns: 18px 24px 1fr auto; }
        .lb-row-border { border-bottom: 0.5px solid rgba(255, 255, 255, 0.06); }
        .lb-pos { font-size: clamp(10px, 1.2vw, 13px); color: var(--os-green-label); }
        .lb-flag { font-size: clamp(12px, 1.3vw, 14px); }
        .lb-name { font-size: clamp(13px, 1.6vw, 16px); color: var(--os-white); font-weight: 400; }
        .lb-score { font-size: clamp(13px, 1.6vw, 16px); font-weight: 600; text-align: right; }
        .lb-score-under { color: var(--os-green-badge); }
        .lb-score-over { color: var(--os-red); }
        .lb-score-even { color: var(--os-white-80); }
        .lb-thru { font-size: clamp(10px, 1.1vw, 12px); color: var(--os-green-label); text-align: right; min-width: 36px; }
        .slot-powered { margin: 8px 0 0; font-size: 9px; color: var(--os-green-label); text-align: right; letter-spacing: 0.5px; }

        .slot-notice { text-align: center; padding: clamp(12px, 2vh, 20px) 0; }
        .slot-notice-text { margin: 0; font-size: clamp(14px, 1.8vw, 20px); font-weight: 300; color: var(--os-white); line-height: 1.6; }
        .slot-notice-divider { width: 48px; height: 0.5px; background: var(--os-divider); margin: clamp(14px, 2vh, 18px) auto 0; }
        .slot-notice-byline { margin: 12px 0 0; font-size: 10px; color: var(--os-green-label); }

        .tip-row { display: flex; align-items: flex-start; gap: 10px; padding: clamp(6px, 1vh, 9px) 0; }
        .tip-row-border { border-bottom: 0.5px solid rgba(255, 255, 255, 0.06); }
        .tip-row .ti { font-size: 15px; color: var(--os-green-label); flex-shrink: 0; margin-top: 1px; text-shadow: none; }
        .tip-text { margin: 0; font-size: clamp(12px, 1.4vw, 15px); color: var(--os-white-80); line-height: 1.5; }

        .panel-right {
          position: absolute;
          top: 0;
          right: 0;
          width: 28%;
          height: 100vh;
          background: rgba(6, 14, 8, 0.82);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-left: 0.5px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 20;
        }

        .panel-section {
          flex: 1 1 0;
          flex-shrink: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          padding: clamp(6px, 1vh, 10px) clamp(10px, 1.3vw, 14px);
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.07);
          overflow: hidden;
        }

        .panel-section-community {
          overflow: hidden;
        }

        .panel-section-inner {
          flex: 1 1 0;
          flex-shrink: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-evenly;
          gap: 0;
          overflow: hidden;
        }

        .panel-section-header {
          margin: 0;
          font-size: clamp(11px, 1.25vw, 14px);
          color: var(--os-green-label);
          letter-spacing: 1.8px;
          text-transform: uppercase;
          font-weight: 500;
          flex-shrink: 0;
        }

        .panel-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding: clamp(3px, 0.49vh, 4.5px) 0;
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.05);
        }

        .panel-row:last-child { border-bottom: none; }

        .panel-row-label {
          font-size: clamp(11px, 1.2vw, 13px);
          color: var(--os-green-label);
          flex-shrink: 0;
        }

        .panel-row-value {
          font-size: clamp(11px, 1.2vw, 13px);
          font-weight: 500;
          color: var(--os-white);
          text-align: right;
          line-height: 1.25;
        }

        .panel-row-value-highlight { color: var(--os-green-badge); }

        .weather-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }

        .panel-temp {
          margin: 0;
          font-size: clamp(32px, 4.2vw, 48px);
          font-weight: 200;
          color: var(--os-white);
          line-height: 1;
        }

        .weather-meta { text-align: right; min-width: 0; }
        .weather-condition {
          margin: 0;
          font-size: clamp(12px, 1.3vw, 15px);
          color: var(--os-white-80);
          line-height: 1.2;
        }
        .weather-feels {
          margin: 3px 0 0;
          font-size: clamp(10px, 1.1vw, 12px);
          color: var(--os-white-80);
        }

        .weather-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(4px, 0.6vh, 6px) clamp(8px, 1vw, 12px);
        }

        .weather-stat-label {
          margin: 0;
          font-size: clamp(9px, 1vw, 11px);
          color: var(--os-green-label);
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .weather-stat-value {
          margin: 2px 0 0;
          font-size: clamp(11px, 1.2vw, 13px);
          font-weight: 500;
          color: var(--os-white);
          line-height: 1.2;
        }

        .rain-summary {
          margin: 0;
          font-size: clamp(10px, 1.1vw, 12px);
          color: var(--os-blue);
          line-height: 1.3;
        }

        .panel-forecast-wrap {
          padding-top: clamp(4px, 0.6vh, 6px);
          border-top: 0.5px solid rgba(255, 255, 255, 0.07);
        }

        .panel-forecast { display: flex; }
        .panel-forecast-col {
          flex: 1;
          text-align: center;
          padding: clamp(2px, 0.4vh, 4px) 0;
          min-width: 0;
        }

        .panel-forecast-col-divider { border-right: 0.5px solid rgba(255, 255, 255, 0.10); }
        .panel-forecast-time { margin: 0; font-size: clamp(8px, 0.95vw, 10px); color: var(--os-green-label); }
        .panel-forecast-temp { margin: 3px 0 0; font-size: clamp(12px, 1.35vw, 15px); font-weight: 300; color: var(--os-white); }
        .panel-forecast-rain { margin: 2px 0 0; font-size: clamp(8px, 0.95vw, 10px); color: var(--os-white-80); }
        .panel-forecast-rain-high { color: var(--os-blue); font-weight: 500; }
        .panel-forecast-empty { margin: 0; font-size: 10px; color: var(--os-green-label); text-align: center; }

        .sun-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: clamp(10px, 1.1vw, 12px);
        }

        .sun-label { color: var(--os-green-label); }
        .sun-value { color: var(--os-white-80); }

        .community-list {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .community-item {
          flex-shrink: 1;
          min-height: 0;
          padding: clamp(3px, 0.5vh, 5px) 0;
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.05);
        }

        .community-item:last-child { border-bottom: none; }
        .community-type { margin: 0; font-size: 8px; color: var(--os-green-label); letter-spacing: 1px; text-transform: uppercase; }
        .community-name { margin: 2px 0 0; font-size: clamp(10px, 1.1vw, 12px); font-weight: 500; color: var(--os-white); line-height: 1.15; }
        .community-detail { margin: 2px 0 0; font-size: clamp(9px, 1vw, 11px); color: var(--os-white-80); line-height: 1.2; }

        .player-error {
          position: fixed;
          top: clamp(8px, 1vh, 12px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 50;
          margin: 0;
          padding: 6px 12px;
          font-size: 11px;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 6px;
        }
      `}</style>

      {error && <p className="player-error">Error: {error}</p>}

      <div className="left-zone">
        <img
          className="scene-photo"
          src={coursePhotoUrl}
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
        <div className="gradient-left" aria-hidden="true" />

        <div className="left-ui">
          <div className="overlay-top-left">
            <img className="overlay-logo" src={logoUrl} alt="Olde Sycamore Golf Club" />
            {showTagline ? <p className="overlay-tagline">{clubTagline}</p> : null}
          </div>

          <div className="overlay-status-top">
            <span
              className="status-badge"
              style={{
                background: statusBadgeStyle.background,
                border: statusBadgeStyle.border,
                color: statusBadgeStyle.color,
              }}
            >
              <span className="status-live-dot" />
              {statusBadgeLabel}
            </span>
          </div>

          <div className="overlay-conditions-left">
            {conditionItems.map((item, i) => (
              <div key={item.label}>
                <p className="condition-stack-label">{item.label}</p>
                <p className="condition-stack-value">{item.value}</p>
                {i < conditionItems.length - 1 && (
                  <div className="condition-stack-divider" aria-hidden="true" />
                )}
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

      <div className="panel-right" style={{ background: panelBgColor }}>
        {showPanelWeather ? (
        <section className="panel-section panel-section-weather">
          <div className="panel-section-inner">
            <div className="weather-hero">
              <p className="panel-temp">{tempDisplay}°</p>
              <div className="weather-meta">
                <p className="weather-condition">{weather?.condition_text || '—'}</p>
                <p className="weather-feels">Feels like {feelsDisplay}°</p>
              </div>
            </div>
            <div className="weather-stats-grid">
              <div>
                <p className="weather-stat-label">Wind</p>
                <p className="weather-stat-value">{windLabel}</p>
              </div>
              <div>
                <p className="weather-stat-label">Humidity</p>
                <p className="weather-stat-value">
                  {weather?.humidity != null ? `${Math.round(weather.humidity)}%` : '—'}
                </p>
              </div>
              <div>
                <p className="weather-stat-label">UV Index</p>
                <p className="weather-stat-value" style={{ color: uvColor }}>
                  {uvRowText}
                </p>
              </div>
              <div>
                <p className="weather-stat-label">Rain</p>
                <p className="weather-stat-value">{rainLabelText}</p>
              </div>
            </div>
            {rainSummary ? <p className="rain-summary">{rainSummary}</p> : null}
            <div className="panel-forecast-wrap">{renderPanelForecast(forecastSlots)}</div>
            <div className="sun-row">
              <span>
                <span className="sun-label">Sunrise </span>
                <span className="sun-value">{sunriseDisplay}</span>
              </span>
              <span>
                <span className="sun-label">Sunset </span>
                <span className="sun-value">{sunsetDisplay}</span>
              </span>
            </div>
          </div>
        </section>
        ) : null}

        {showPanelProShop ? (
        <section className="panel-section">
          <div className="panel-section-inner">
            <p className="panel-section-header">{proShopTitle}</p>
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
        </section>
        ) : null}

        {showPanelCommunity ? (
        <section className="panel-section panel-section-community">
          <div className="panel-section-inner community-list">
            <p className="panel-section-header">Community</p>
            {communityItems.map((item) => (
              <div key={item.key} className="community-item">
                <p className="community-type">{item.type}</p>
                <p className="community-name">{item.name}</p>
                <p className="community-detail">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>
        ) : null}
      </div>
    </div>
  )
}
