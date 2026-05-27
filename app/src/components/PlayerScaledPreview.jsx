import React, { useEffect, useMemo, useRef, useState } from 'react'
import { buildCommunitySections } from '../lib/communityDisplay'

const PREVIEW_WIDTH = 1920
const PREVIEW_HEIGHT = 1080

const DEFAULT_LOGO_URL =
  'https://xntieyqrodsjelotcmnr.supabase.co/storage/v1/object/public/assets/olde%20sycamore%20golf%20club%20logo.png'

const DEFAULT_BG_URL =
  'https://xntieyqrodsjelotcmnr.supabase.co/storage/v1/object/public/assets/img-olde-sycamore-1.webp'

const PREVIEW_SLOT_DEFS = [
  { id: 'tournament', toggleKey: 'tournament', label: 'Club tournament', dotColor: '#4ade80' },
  { id: 'pro', toggleKey: 'pgaTour', label: 'PGA Tour · live', dotColor: '#60a5fa' },
  {
    id: 'notice',
    toggleKey: 'courseNotice',
    label: 'Course notice',
    dotColor: '#fbbf24',
    requiresNotice: true,
  },
  { id: 'tips', toggleKey: 'courseTips', label: 'Course tips', dotColor: null },
]

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
  return STATUS_BADGE_LABELS[normalizeCourseStatusKey(status)] || 'OPEN'
}

function getStatusBadgeStyle(status) {
  const key = normalizeCourseStatusKey(status)
  if (key === 'closed') {
    return {
      background: 'rgba(127,29,29,0.82)',
      border: '0.5px solid rgba(248,113,113,0.55)',
      color: '#ef4444',
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
    color: '#4ade80',
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

function formatClubScore(score) {
  if (score === 0) return { text: 'E', tone: 'even' }
  if (score < 0) return { text: String(score), tone: 'under' }
  return { text: `+${score}`, tone: 'over' }
}

function achievementTypeLabel(type) {
  const s = String(type || 'Achievement').trim()
  if (!s) return 'Achievement'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function getActivePreviewSlot(displaySlots, dailyNote) {
  const center = displaySlots?.center || {}
  for (const slot of PREVIEW_SLOT_DEFS) {
    if (center[slot.toggleKey] === false) continue
    if (slot.requiresNotice && !dailyNote?.trim()) continue
    return slot
  }
  return PREVIEW_SLOT_DEFS[PREVIEW_SLOT_DEFS.length - 1]
}

function renderTournamentCard(td) {
  const rows = (td?.rows || []).filter((r) => r.enabled !== false).slice(0, 5)
  const title = `${td?.name || 'Tournament'} · ${td?.round || 'Round 2'}`
  return (
    <div className="slot-leaderboard">
      <div className="slot-subheader">
        <p className="slot-title">{title}</p>
        <p className="slot-live">● Live</p>
      </div>
      {rows.map((row, i) => {
        const score = formatClubScore(parseTournamentScore(row.score))
        return (
          <div
            key={row.position}
            className={`lb-row${i < rows.length - 1 ? ' lb-row-border' : ''}`}
          >
            <span className="lb-pos">{row.position}</span>
            <span className="lb-name">{row.name}</span>
            <span className={`lb-score lb-score-${score.tone}`}>{score.text}</span>
            <span className="lb-thru">{row.thru}</span>
          </div>
        )
      })}
    </div>
  )
}

function renderNoticeCard(notice) {
  return (
    <div className="slot-notice">
      <p className="slot-notice-text">{notice}</p>
      <div className="slot-notice-divider" aria-hidden="true" />
      <p className="slot-notice-byline">Posted by Olde Sycamore Golf Club</p>
    </div>
  )
}

function renderTipsCard() {
  const tips = [
    'Hydrate between holes — UV is elevated this afternoon.',
    'Account for breeze from the north on elevated tees.',
    'Greens running firm; land approach shots short.',
  ]
  return (
    <div className="slot-tips">
      {tips.map((text, i) => (
        <div key={text} className={`tip-row${i < tips.length - 1 ? ' tip-row-border' : ''}`}>
          <p className="tip-text">{text}</p>
        </div>
      ))}
    </div>
  )
}

function renderProCard() {
  const rows = [
    { position: 1, flag: '🇺🇸', name: 'S. Scheffler', score: -18 },
    { position: 2, flag: '🇨🇦', name: 'C. Conners', score: -15 },
    { position: 3, flag: '🇺🇸', name: 'X. Schauffele', score: -14 },
  ]
  return (
    <div className="slot-leaderboard slot-pro">
      <div className="slot-subheader slot-subheader-pro">
        <p className="slot-title">Charles Schwab Challenge</p>
        <p className="slot-round">R3</p>
      </div>
      {rows.map((row, i) => (
        <div key={row.position} className={`lb-row${i < rows.length - 1 ? ' lb-row-border' : ''}`}>
          <span className="lb-pos">{row.position}</span>
          <span className="lb-flag">{row.flag}</span>
          <span className="lb-name">{row.name}</span>
          <span className="lb-score lb-score-under">{row.score}</span>
        </div>
      ))}
    </div>
  )
}

function renderSlotContent(slot, club, course) {
  switch (slot.id) {
    case 'tournament':
      return renderTournamentCard(club.tournament_data)
    case 'notice':
      return renderNoticeCard(course.daily_note)
    case 'pro':
      return renderProCard()
    case 'tips':
    default:
      return renderTipsCard()
  }
}


export default function PlayerScaledPreview({ club, course, weatherDisplay }) {
  const wrapperRef = useRef(null)
  const [scale, setScale] = useState(0.5)

  const accentColor = club.accent_color || '#7ab648'
  const logoUrl = club.logo_url || DEFAULT_LOGO_URL
  const photoUrl = club.bg_photo_url || DEFAULT_BG_URL
  const dailyNote = course.daily_note?.trim() || ''

  const showWeather = club.display_slots?.panel?.weather !== false
  const showProShop = club.display_slots?.panel?.proShop !== false
  const showCommunity = club.display_slots?.panel?.community !== false

  const proRows = useMemo(
    () => (club.pro_shop_rows || []).filter((r) => r.enabled !== false).slice(0, 8),
    [club.pro_shop_rows],
  )
  const communitySections = useMemo(
    () => buildCommunitySections(club.community_items),
    [club.community_items],
  )
  const communityAchievements = communitySections.achievements
  const communityEvents = communitySections.events
  const activeSlot = useMemo(
    () => getActivePreviewSlot(club.display_slots, dailyNote),
    [club.display_slots, dailyNote],
  )

  const statusBadgeLabel = getStatusBadgeLabel(course.course_status)
  const statusBadgeStyle = getStatusBadgeStyle(course.course_status)

  const wx = weatherDisplay ?? {}
  const forecastSlots = wx.forecast ?? []

  const conditionItems = [
    { label: 'Greens', value: course.greens_speed || '11.2 ft' },
    { label: 'Fairways', value: course.fairway_condition || 'Firm' },
    { label: 'Bunkers', value: course.bunker_condition || 'Groomed' },
    { label: 'Cart', value: course.cart_rule || '90° Rule' },
  ]

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return undefined

    const updateScale = () => {
      const width = el.getBoundingClientRect().width
      if (width > 0) setScale(width / PREVIEW_WIDTH)
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(el)
    window.addEventListener('resize', updateScale)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateScale)
    }
  }, [])

  return (
    <div ref={wrapperRef} className="player-preview-wrapper">
      <style>{PLAYER_PREVIEW_CSS}</style>
      <div
        className="player-preview-scale-host"
        style={{
          width: PREVIEW_WIDTH * scale,
          height: PREVIEW_HEIGHT * scale,
        }}
      >
        <div
          className="player-preview-root"
          style={{
            '--os-green-label': accentColor,
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
            transform: `scale(${scale})`,
          }}
        >
          <div className="scene-backdrop" aria-hidden="true">
            <img className="scene-photo" src={photoUrl} alt="" aria-hidden="true" />
            <div className="gradient-top" />
            <div className="gradient-bottom" />
            <div className="gradient-left" />
          </div>

          <div className="left-zone">
            <div className="left-ui">
              <div className="overlay-top-left">
                <img className="overlay-logo" src={logoUrl} alt="" />
                {club.show_tagline === true && club.club_tagline ? (
                  <p className="overlay-tagline">{club.club_tagline}</p>
                ) : null}
              </div>

              <div className="overlay-status-top">
                <span className="status-badge" style={statusBadgeStyle}>
                  <span className="status-live-dot" />
                  {statusBadgeLabel}
                </span>
              </div>

              <div className="overlay-conditions-left">
                {conditionItems.map((item, i) => (
                  <div key={item.label}>
                    <p className="condition-stack-label">{item.label}</p>
                    <p className="condition-stack-value">{item.value}</p>
                    {i < conditionItems.length - 1 ? (
                      <div className="condition-stack-divider" aria-hidden="true" />
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="center-card">
                <div className="card-slot-label">
                  {activeSlot.dotColor ? (
                    <span className="card-dot" style={{ background: activeSlot.dotColor }} />
                  ) : null}
                  <span>{activeSlot.label}</span>
                </div>
                <div className="card-content">{renderSlotContent(activeSlot, club, course)}</div>
              </div>
            </div>
          </div>

          <div className="panel-right">
            {showWeather ? (
              <section className="panel-section panel-section-weather">
                <div className="panel-section-inner">
                  <div className="panel-block">
                    <div className="weather-hero">
                      <p className="panel-temp">
                        {wx.temperature ?? '—'}
                        {wx.temperature != null ? <span className="panel-temp-degree">°</span> : null}
                      </p>
                      <div className="weather-meta">
                        <p className="weather-condition">{wx.condition ?? '—'}</p>
                        <p className="weather-feels">
                          Feels like {wx.feelsLike ?? '—'}
                          {wx.feelsLike != null ? <span className="panel-temp-degree">°</span> : null}
                        </p>
                      </div>
                    </div>
                    <dl className="weather-rows">
                      <div className="weather-row">
                        <dt className="weather-row-label">Wind</dt>
                        <dd className="weather-row-value">{wx.wind ?? '—'}</dd>
                      </div>
                      <div className="weather-row">
                        <dt className="weather-row-label">Humidity</dt>
                        <dd className="weather-row-value">{wx.humidity ?? '—'}</dd>
                      </div>
                      <div className="weather-row">
                        <dt className="weather-row-label">UV Index</dt>
                        <dd className="weather-row-value">{wx.uv ?? '—'}</dd>
                      </div>
                      <div className="weather-row">
                        <dt className="weather-row-label">Sunset</dt>
                        <dd className="weather-row-value">{wx.sunset ?? '—'}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="panel-block">
                    <div className="panel-forecast-wrap">
                      <div className="panel-forecast">
                        {forecastSlots.map((slot, i) => (
                          <div
                            key={`${slot.time}-${i}`}
                            className={`panel-forecast-col${i < forecastSlots.length - 1 ? ' panel-forecast-col-divider' : ''}`}
                          >
                            <p className="panel-forecast-time">{slot.time}</p>
                            <p className="panel-forecast-temp">
                              {slot.temp}
                              {slot.temp != null ? <span className="panel-temp-degree">°</span> : null}
                            </p>
                            <p className="panel-forecast-rain">{slot.precip}%</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {showProShop ? (
              <section className="panel-section panel-section-proshop">
                <div className="panel-section-inner">
                  <p className="display-title panel-section-header display-title-proshop">
                    {club.pro_shop_title || 'Pro Shop & Dining'}
                  </p>
                  <div className="panel-block">
                    {proRows.map((row) => (
                      <div key={row.id} className="panel-row">
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

            {showCommunity ? (
              <section className="panel-section panel-section-community">
                <div className="panel-section-inner">
                  <p className="display-title panel-section-header display-title-community">
                    Community
                  </p>
                  {communityAchievements[0] ? (
                    <div className="panel-block">
                      <div className="community-item community-rotate-slot">
                        <p className="community-type">{communityAchievements[0].type}</p>
                        <p className="community-name">{communityAchievements[0].name}</p>
                        {communityAchievements[0].detail ? (
                          <p className="community-detail">{communityAchievements[0].detail}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {communityEvents.length > 0 ? (
                    <div className="panel-subsection-events">
                      <p className="display-title panel-section-header display-title-community">
                        Events
                      </p>
                      <div className="community-events-stack">
                        {communityEvents.map((item) => (
                          <div key={item.key} className="community-event-row">
                            <p className="community-name">{item.name}</p>
                            {item.detail ? (
                              <p className="community-detail">{item.detail}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// Player.jsx styles scoped to 1920×1080 preview (same class names, fixed canvas size).
const PLAYER_PREVIEW_CSS = `
  .player-preview-wrapper {
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 8px;
    position: relative;
    background: #000;
  }

  .player-preview-scale-host {
    position: relative;
    overflow: hidden;
  }

  .player-preview-root {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: top left;
    overflow: hidden;
    background: #000000;
    font-family: 'Plus Jakarta Sans', sans-serif;
    color: #fff;
    --os-green-label: #7ab648;
    --os-white: #ffffff;
    --os-white-80: rgba(255, 255, 255, 0.82);
    --os-divider: rgba(255, 255, 255, 0.07);
    --os-card: rgba(0, 0, 0, 0.20);
    --os-card-border: rgba(255, 255, 255, 0.13);
    --os-green-badge: #4ade80;
    --os-blue: #60a5fa;
    --os-red: #ef4444;
  }

  .player-preview-root * {
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.95);
    box-sizing: border-box;
  }

  .player-preview-root .scene-backdrop {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .player-preview-root .left-zone {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 72%;
    overflow: hidden;
    z-index: 10;
    pointer-events: none;
  }

  .player-preview-root .scene-photo {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 40%;
  }

  .player-preview-root .gradient-top,
  .player-preview-root .gradient-bottom,
  .player-preview-root .gradient-left {
    position: absolute;
    z-index: 3;
    pointer-events: none;
  }

  .player-preview-root .gradient-top {
    top: 0; left: 0; right: 0;
    height: 42%;
    background: linear-gradient(180deg, rgba(0,0,0,0.62) 0%, transparent 40%);
  }

  .player-preview-root .gradient-bottom {
    bottom: 0; left: 0; right: 0;
    height: 52%;
    background: linear-gradient(0deg, rgba(0,0,0,0.68) 0%, transparent 48%);
  }

  .player-preview-root .gradient-left {
    top: 0; bottom: 0; left: 0;
    width: 32%;
    background: linear-gradient(90deg, rgba(0,0,0,0.50) 0%, transparent 22%);
  }

  .player-preview-root .left-ui {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
  }

  .player-preview-root .overlay-top-left {
    position: absolute;
    top: 20px;
    left: 20px;
  }

  .player-preview-root .overlay-logo {
    display: block;
    height: 76px;
    width: auto;
    object-fit: contain;
    filter: brightness(10);
    opacity: 0.92;
  }

  .player-preview-root .overlay-tagline {
    margin: 6px 0 0;
    font-size: 13px;
    color: #fff;
    letter-spacing: 0.4px;
  }

  .player-preview-root .overlay-status-top {
    position: absolute;
    top: 20px;
    left: 62%;
    transform: translateX(-50%);
    white-space: nowrap;
  }

  .player-preview-root .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 22px;
    border-radius: 24px;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  .player-preview-root .status-live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    animation: preview-live-pulse 2s ease-in-out infinite;
  }

  @keyframes preview-live-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  .player-preview-root .overlay-conditions-left {
    position: absolute;
    left: 20px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .player-preview-root .condition-stack-label {
    margin: 0;
    font-size: 11px;
    color: var(--os-green-label);
    text-transform: uppercase;
    letter-spacing: 1.2px;
    font-weight: 500;
  }

  .player-preview-root .condition-stack-value {
    margin: 2px 0 0;
    font-size: 24px;
    font-weight: 400;
    color: #fff;
  }

  .player-preview-root .condition-stack-divider {
    width: 26px;
    height: 0.5px;
    background: rgba(122, 182, 72, 0.28);
    margin-top: 3px;
  }

  .player-preview-root .center-card {
    position: absolute;
    top: 50%;
    left: 62%;
    transform: translate(-50%, -50%);
    width: 480px;
    background: var(--os-card);
    backdrop-filter: blur(22px);
    border: 0.5px solid var(--os-card-border);
    border-radius: 18px;
    padding: 24px;
  }

  .player-preview-root .card-slot-label {
    display: flex;
    align-items: center;
    gap: 5px;
    margin: 0 0 16px;
    font-size: 12px;
    color: var(--os-green-label);
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .player-preview-root .card-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .player-preview-root .slot-subheader {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .player-preview-root .slot-title {
    margin: 0;
    font-size: 22px;
    font-weight: 300;
    color: #fff;
  }

  .player-preview-root .slot-live { margin: 0; font-size: 11px; color: #4ade80; }
  .player-preview-root .slot-round { margin: 0; font-size: 13px; color: var(--os-green-label); }

  .player-preview-root .lb-row {
    display: grid;
    grid-template-columns: 18px 1fr auto auto;
    align-items: center;
    gap: 8px;
    padding: 9px 0;
  }

  .player-preview-root .slot-pro .lb-row { grid-template-columns: 18px 24px 1fr auto; }
  .player-preview-root .lb-row-border { border-bottom: 0.5px solid rgba(255, 255, 255, 0.06); }
  .player-preview-root .lb-pos { font-size: 13px; color: var(--os-green-label); }
  .player-preview-root .lb-flag { font-size: 14px; }
  .player-preview-root .lb-name { font-size: 16px; color: #fff; }
  .player-preview-root .lb-score { font-size: 16px; font-weight: 600; text-align: right; }
  .player-preview-root .lb-score-under { color: #4ade80; }
  .player-preview-root .lb-score-over { color: #ef4444; }
  .player-preview-root .lb-score-even { color: rgba(255,255,255,0.82); }
  .player-preview-root .lb-thru { font-size: 12px; color: var(--os-green-label); text-align: right; min-width: 36px; }

  .player-preview-root .slot-notice { text-align: center; padding: 20px 0; }
  .player-preview-root .slot-notice-text { margin: 0; font-size: 20px; font-weight: 300; color: #fff; line-height: 1.6; }
  .player-preview-root .slot-notice-divider { width: 48px; height: 0.5px; background: var(--os-divider); margin: 18px auto 0; }
  .player-preview-root .slot-notice-byline { margin: 12px 0 0; font-size: 10px; color: var(--os-green-label); }

  .player-preview-root .tip-row { padding: 9px 0; }
  .player-preview-root .tip-row-border { border-bottom: 0.5px solid rgba(255, 255, 255, 0.06); }
  .player-preview-root .tip-text { margin: 0; font-size: 15px; color: rgba(255,255,255,0.82); line-height: 1.5; }

  .player-preview-root .panel-right {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 28%;
    background: transparent;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    gap: 10px;
    padding-block: 8px;
    overflow: hidden;
    z-index: 20;
  }

  .player-preview-root .panel-section {
    flex: 0 0 auto;
    flex-shrink: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 0 10.5px;
    border-bottom: none;
    overflow: hidden;
  }

  .player-preview-root .panel-section-inner {
    flex: 0 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
    gap: 10px;
    overflow: hidden;
    padding: 9px 10px;
    border-radius: 8px;
    border: 0.5px solid rgba(122, 182, 72, 0.2);
    background: linear-gradient(
      165deg,
      rgba(122, 182, 72, 0.11) 0%,
      rgba(12, 34, 20, 0.34) 52%,
      rgba(10, 28, 17, 0.26) 100%
    );
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 1px 6px rgba(0, 0, 0, 0.14);
  }

  .player-preview-root .panel-section-weather .panel-section-inner {
    background: linear-gradient(
      165deg,
      rgba(142, 200, 248, 0.08) 0%,
      rgba(122, 182, 72, 0.1) 14%,
      rgba(12, 34, 20, 0.34) 54%,
      rgba(10, 28, 17, 0.26) 100%
    );
    border-color: rgba(122, 182, 72, 0.22);
    box-shadow:
      inset 3px 0 0 rgba(142, 200, 248, 0.55),
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 1px 6px rgba(0, 0, 0, 0.14);
  }

  .player-preview-root .panel-section-proshop .panel-section-inner {
    background: linear-gradient(
      165deg,
      rgba(230, 210, 160, 0.07) 0%,
      rgba(122, 182, 72, 0.11) 14%,
      rgba(12, 34, 20, 0.34) 54%,
      rgba(10, 28, 17, 0.26) 100%
    );
    border-color: rgba(122, 182, 72, 0.22);
    box-shadow:
      inset 3px 0 0 rgba(230, 210, 160, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 1px 6px rgba(0, 0, 0, 0.14);
  }

  .player-preview-root .panel-section-community .panel-section-inner {
    background: linear-gradient(
      165deg,
      rgba(237, 220, 196, 0.06) 0%,
      rgba(122, 182, 72, 0.1) 14%,
      rgba(12, 34, 20, 0.34) 54%,
      rgba(10, 28, 17, 0.26) 100%
    );
    border-color: rgba(122, 182, 72, 0.22);
    box-shadow:
      inset 3px 0 0 rgba(237, 220, 196, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 1px 6px rgba(0, 0, 0, 0.14);
  }

  .player-preview-root .panel-subsection-events {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
    padding: 8px;
    border-radius: 6px;
    background: linear-gradient(165deg, rgba(122, 182, 72, 0.11) 0%, rgba(10, 30, 18, 0.28) 100%);
    border: 0.5px solid rgba(122, 182, 72, 0.18);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: inset 2px 0 0 rgba(237, 220, 196, 0.28);
  }

  .player-preview-root .panel-block {
    flex: 0 0 auto;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-bottom: 10px;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.10);
  }

  .player-preview-root .panel-section-inner > .panel-block:last-child,
  .player-preview-root .panel-section-inner > :last-child.panel-block {
    border-bottom: none;
    padding-bottom: 0;
  }

  .player-preview-root .community-events-stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .player-preview-root .community-event-row {
    padding-bottom: 6px;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.06);
  }

  .player-preview-root .community-event-row:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .player-preview-root .display-title {
    margin: 0;
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 1.3px;
    text-transform: uppercase;
    line-height: 1.15;
  }

  .player-preview-root .panel-section-header {
    margin: 0;
    flex-shrink: 0;
  }

  .player-preview-root .display-title-weather {
    color: #d4e8f4;
  }

  .player-preview-root .display-title-community {
    color: #eddcc4;
  }

  .player-preview-root .display-title-proshop {
    color: #f2ead4;
  }

  .player-preview-root .weather-rows {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .player-preview-root .weather-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 0;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.06);
  }

  .player-preview-root .weather-row:last-child {
    border-bottom: none;
  }

  .player-preview-root .weather-row-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.82);
  }

  .player-preview-root .weather-row-value,
  .player-preview-root .weather-row dd {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }

  .player-preview-root .weather-row dt {
    margin: 0;
  }

  .player-preview-root .panel-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 4.5px 0;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.05);
  }

  .player-preview-root .panel-row:last-child { border-bottom: none; }

  .player-preview-root .panel-row-label {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.2px;
    color: #b8d4a0;
  }

  .player-preview-root .weather-stat-label-wind { color: #8ec8f0; }
  .player-preview-root .weather-stat-label-humidity { color: #a8dce8; }
  .player-preview-root .weather-stat-label-uv { color: #f0d080; }
  .player-preview-root .weather-stat-label-rain { color: #7eb8f5; }

  .player-preview-root .weather-stats-body {
    flex-shrink: 0;
  }

  .player-preview-root .panel-row-value {
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    text-align: right;
  }

  .player-preview-root .panel-row-value-highlight { color: #4ade80; }

  .player-preview-root .weather-hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .player-preview-root .panel-temp {
    margin: 0;
    font-size: 48px;
    font-weight: 200;
    line-height: 1;
    display: inline-flex;
    align-items: flex-start;
  }

  .player-preview-root .panel-temp-degree {
    font-size: 0.52em;
    font-weight: 600;
    line-height: 1;
    margin-left: 0.04em;
    position: relative;
    top: 0.12em;
  }

  .player-preview-root .weather-feels .panel-temp-degree {
    font-size: 0.65em;
    top: 0.05em;
  }

  .player-preview-root .panel-forecast-temp .panel-temp-degree {
    font-size: 0.55em;
    top: 0.1em;
  }

  .player-preview-root .weather-condition { margin: 0; font-size: 15px; color: rgba(255,255,255,0.82); }
  .player-preview-root .weather-feels { margin: 3px 0 0; font-size: 12px; color: rgba(255,255,255,0.82); }

  .player-preview-root .panel-forecast-wrap {
    padding: 4px 0 3px;
    border-top: 0.5px solid rgba(255, 255, 255, 0.07);
    overflow: visible;
  }

  .player-preview-root .panel-forecast {
    display: flex;
    align-items: flex-end;
    overflow: visible;
  }

  .player-preview-root .panel-forecast-col {
    flex: 1 1 0;
    text-align: center;
    padding: 0 2px 4px;
    min-width: 0;
    overflow: visible;
  }

  .player-preview-root .panel-forecast-col-divider { border-right: 0.5px solid rgba(255, 255, 255, 0.10); }
  .player-preview-root .panel-forecast-time { margin: 0; font-size: 10px; color: var(--os-green-label); line-height: 1.25; }
  .player-preview-root .panel-forecast-temp { margin: 2px 0 0; font-size: 14px; font-weight: 300; line-height: 1.2; }
  .player-preview-root .panel-forecast-rain {
    margin: 3px 0 0;
    font-size: 10px;
    color: rgba(255,255,255,0.82);
    line-height: 1.35;
    white-space: nowrap;
  }

  .player-preview-root .sun-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }

  .player-preview-root .sun-label { color: var(--os-green-label); }
  .player-preview-root .sun-value { color: rgba(255,255,255,0.82); }

  .player-preview-root .community-item {
    padding: 0;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.05);
  }

  .player-preview-root .community-item:last-child { border-bottom: none; }
  .player-preview-root .community-type {
    margin: 0;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 9.5px;
    font-weight: 600;
    color: #b8d4a0;
    letter-spacing: 0.2px;
  }
  .player-preview-root .community-name { margin: 2px 0 0; font-size: 12px; font-weight: 500; line-height: 1.15; }
  .player-preview-root .community-detail { margin: 2px 0 0; font-size: 10px; color: rgba(255,255,255,0.82); line-height: 1.2; }
`
