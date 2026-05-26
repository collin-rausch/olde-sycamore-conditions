import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const DEFAULT_LOGO_URL =
  'https://xntieyqrodsjelotcmnr.supabase.co/storage/v1/object/public/assets/olde%20sycamore%20golf%20club%20logo.png'

const DEFAULT_BG_URL =
  'https://xntieyqrodsjelotcmnr.supabase.co/storage/v1/object/public/assets/img-olde-sycamore-1.webp'

const CLUB_DISPLAY_NAME = 'Olde Sycamore Golf Club'

const PANEL_BG_PRESETS = {
  dark_green: 'rgba(6,14,8,0.82)',
  dark_navy: 'rgba(6,12,24,0.82)',
  dark_charcoal: 'rgba(18,18,18,0.82)',
  custom: null,
}

const STATUS_OPTIONS = [
  'Open',
  'Frost Delay',
  'Rain Delay',
  'Course Maintenance',
  'Back 9 Only',
  'Front 9 Only',
  'Closed',
]

const CART_OPTIONS = ['90° Rule', 'Fairways Open', 'Paths Only', 'No Carts']
const FAIRWAY_OPTIONS = ['Firm', 'Normal', 'Soft', 'Wet']
const BUNKER_OPTIONS = ['Groomed', 'Normal', 'Wet', 'Under Maintenance']
const ROUND_OPTIONS = ['Round 1', 'Round 2', 'Round 3', 'Round 4', 'Final']
const ACHIEVEMENT_TYPES = [
  'Hole in One',
  'Low Round',
  'Course Record',
  'Achievement',
  'Tournament Win',
  'Other',
]

const NAV_ITEMS = [
  { id: 'club', icon: 'building', title: 'Club settings', subtitle: 'Logo, tagline & location' },
  { id: 'conditions', icon: 'flag', title: 'Course conditions', subtitle: 'Status, greens & daily note' },
  { id: 'slots', icon: 'layout', title: 'Display slots', subtitle: 'Center card & right panel', dividerBefore: true },
  { id: 'proshop', icon: 'tools-kitchen-2', title: 'Pro shop & dining', subtitle: 'Hours & specials' },
  { id: 'community', icon: 'users', title: 'Community', subtitle: 'Leaderboard & achievements' },
  { id: 'branding', icon: 'palette', title: 'Branding', subtitle: 'Colors & background photo' },
]

const CENTER_SLOT_TOGGLES = [
  { key: 'tournament', label: 'Club tournament', desc: 'Manual entry or Golf Genius API' },
  { key: 'memberSpotlight', label: 'Member spotlight', desc: 'Achievements and hole in ones' },
  { key: 'pgaTour', label: 'PGA Tour live', desc: 'Pro leaderboard via Sportradar' },
  { key: 'courseNotice', label: 'Course notice', desc: 'Important alerts and notices' },
  { key: 'courseTips', label: 'Course tips', desc: 'Weather-based golfer advice' },
]

const PANEL_SLOT_TOGGLES = [
  { key: 'weather', label: 'Live weather', desc: 'Temperature, wind, UV, forecast' },
  { key: 'proShop', label: 'Pro shop & dining', desc: 'Hours, specials, happy hour' },
  { key: 'community', label: 'Community', desc: 'Achievements, records, events' },
]

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function defaultProShopRows() {
  return [
    { id: uid(), label: 'Pro shop', value: '7 AM – 6 PM', enabled: true },
    { id: uid(), label: 'Bar & grill', value: '11 AM – 9 PM', enabled: true },
    { id: uid(), label: 'Happy hour', value: '4–7 PM · $5 drafts', enabled: true, highlight: true },
    { id: uid(), label: "Today's special", value: 'Prime Rib Night', enabled: true },
    { id: uid(), label: 'Cart rental', value: '$20 · Paths only today', enabled: true },
  ]
}

function defaultTournament() {
  return {
    name: "Men's Invitational",
    round: 'Round 2',
    golfGeniusApi: false,
    apiKey: '',
    rows: [
      { position: 1, name: 'J. Williams', score: '-5', thru: 'F', enabled: true },
      { position: 2, name: 'M. Thompson', score: '-3', thru: '14', enabled: true },
      { position: 3, name: 'R. Chen', score: '-2', thru: 'F', enabled: true },
      { position: 4, name: 'D. Martinez', score: '+1', thru: '12', enabled: true },
      { position: 5, name: 'T. Johnson', score: '+2', thru: 'F', enabled: true },
    ],
  }
}

function defaultDisplaySlots() {
  return {
    center: {
      tournament: true,
      memberSpotlight: true,
      pgaTour: true,
      courseNotice: true,
      courseTips: true,
    },
    panel: { weather: true, proShop: true, community: true },
  }
}

function defaultCommunity() {
  return {
    achievements: [
      {
        id: uid(),
        type: 'Hole in One',
        name: 'Robert Chen',
        detail: 'Hole 7 · 162 yds · 7-iron · May 21',
        date: '2026-05-21',
        enabled: true,
      },
      {
        id: uid(),
        type: 'Low Round',
        name: 'J. Williams',
        detail: '68 · May 20 · -4 under par',
        date: '2026-05-20',
        enabled: true,
      },
    ],
    events: [
      {
        id: uid(),
        name: "Men's Invitational",
        detail: 'May 24–26 · Registration open',
        enabled: true,
      },
    ],
  }
}

function defaultClubSettings() {
  return {
    club_tagline: '18 holes · Est. 1997',
    show_tagline: true,
    location_name: 'Charlotte, NC',
    latitude: 35.1653,
    longitude: -80.6093,
    logo_url: DEFAULT_LOGO_URL,
    accent_color: '#7ab648',
    panel_bg: 'dark_green',
    panel_bg_custom: 'rgba(6,14,8,0.82)',
    bg_photo_url: DEFAULT_BG_URL,
    pro_shop_title: 'Pro Shop & Dining',
    pro_shop_rows: defaultProShopRows(),
    community_items: defaultCommunity(),
    tournament_data: defaultTournament(),
    display_slots: defaultDisplaySlots(),
  }
}

function defaultCourseForm() {
  return {
    course_status: 'Open',
    greens_speed: '11.2 ft',
    fairway_condition: 'Firm',
    bunker_condition: 'Groomed',
    cart_rule: '90° Rule',
    daily_note: '',
  }
}

function parseJson(val, fallback) {
  if (!val) return fallback
  if (typeof val === 'object') return val
  try {
    return JSON.parse(val)
  } catch {
    return fallback
  }
}

function parseGreensSpeed(text) {
  const n = parseFloat(String(text).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 11.2
}

function achievementTypeLabel(type) {
  return String(type || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toUpperCase()
}

async function geocodeLocation(locationName) {
  const q = encodeURIComponent(locationName.trim())
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    { headers: { 'User-Agent': 'olde-sycamore-conditions-admin/1.0' } },
  )
  if (!res.ok) throw new Error('Geocoding request failed')
  const data = await res.json()
  if (!data?.[0]?.lat || !data?.[0]?.lon) {
    throw new Error('Could not find coordinates for that location')
  }
  return {
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon),
  }
}

async function uploadToAssets(file, prefix) {
  const ext = file.name.split('.').pop() || 'bin'
  const path = `${prefix}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('assets').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  })
  if (error) throw error
  const { data } = supabase.storage.from('assets').getPublicUrl(path)
  return data.publicUrl
}

function getStatusButtonStyle(status, active) {
  if (!active) {
    return {
      background: 'rgba(255,255,255,0.04)',
      border: '0.5px solid rgba(255,255,255,0.10)',
      color: 'rgba(255,255,255,0.35)',
    }
  }
  const map = {
    Open: { background: '#166534', border: '0.5px solid rgba(74,222,128,0.4)', color: '#4ade80' },
    'Frost Delay': { background: 'rgba(29,78,216,0.55)', border: '0.5px solid rgba(96,165,250,0.45)', color: '#93c5fd' },
    'Rain Delay': { background: 'rgba(29,78,216,0.55)', border: '0.5px solid rgba(96,165,250,0.45)', color: '#93c5fd' },
    'Course Maintenance': { background: 'rgba(120,53,15,0.55)', border: '0.5px solid rgba(251,191,36,0.45)', color: '#fbbf24' },
    'Back 9 Only': { background: 'rgba(120,53,15,0.55)', border: '0.5px solid rgba(251,191,36,0.45)', color: '#fbbf24' },
    'Front 9 Only': { background: 'rgba(120,53,15,0.55)', border: '0.5px solid rgba(251,191,36,0.45)', color: '#fbbf24' },
    Closed: { background: 'rgba(127,29,29,0.60)', border: '0.5px solid rgba(248,113,113,0.4)', color: '#f87171' },
  }
  return map[status] || map.Open
}

function getPreviewStatusStyle(status) {
  const s = (status || 'Open').toLowerCase()
  if (s.includes('closed')) return { background: 'rgba(127,29,29,0.82)', color: '#f87171' }
  if (s.includes('frost') || s.includes('rain')) return { background: 'rgba(29,78,216,0.72)', color: '#93c5fd' }
  if (s.includes('maintenance') || s.includes('back 9') || s.includes('front 9')) {
    return { background: 'rgba(120,53,15,0.72)', color: '#fbbf24' }
  }
  return { background: 'rgba(16,68,36,0.82)', color: '#4ade80' }
}

function getPreviewStatusLabel(status) {
  const s = (status || 'Open').toUpperCase()
  if (s.includes('FROST')) return 'FROST DELAY'
  if (s.includes('RAIN')) return 'RAIN DELAY'
  if (s.includes('MAINTENANCE')) return 'MAINTENANCE'
  if (s.includes('BACK 9')) return 'BACK 9 ONLY'
  if (s.includes('FRONT 9')) return 'FRONT 9 ONLY'
  if (s.includes('CLOSED')) return 'CLOSED'
  return 'OPEN'
}

function resolvePanelBg(panelBg, panelBgCustom) {
  if (panelBg === 'custom') return panelBgCustom || PANEL_BG_PRESETS.dark_green
  return PANEL_BG_PRESETS[panelBg] || PANEL_BG_PRESETS.dark_green
}

function getFirstCenterSlotLabel(displaySlots, dailyNote) {
  const c = displaySlots?.center || {}
  const order = [
    ['tournament', 'Club tournament'],
    ['memberSpotlight', 'Member spotlight'],
    ['pgaTour', 'PGA Tour · live'],
    ['courseNotice', 'Course notice'],
    ['courseTips', 'Course tips'],
  ]
  for (const [key, label] of order) {
    if (!c[key]) continue
    if (key === 'courseNotice' && !dailyNote?.trim()) continue
    return label
  }
  return 'Course tips'
}

function TablerIcon({ name, style }) {
  const iconClass = name.startsWith('ti-') ? name : `ti-${name}`
  return <i className={`ti ${iconClass}`} style={style} aria-hidden="true" />
}

function SubHeader({ children }) {
  return <p style={S.subSectionHeader}>{children}</p>
}

function FieldLabel({ children }) {
  return <label style={S.fieldLabel}>{children}</label>
}

function TextInput({ value, onChange, placeholder, style }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="adm-input"
      style={{ ...S.input, ...style }}
    />
  )
}

function SelectInput({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="adm-select" style={S.input}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

function TextArea({ value, onChange, placeholder, height }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="adm-input"
      style={{ ...S.input, ...S.textarea, height: height || 52 }}
    />
  )
}

function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{
        ...S.toggleTrack,
        background: on ? '#166534' : 'rgba(255,255,255,0.10)',
      }}
    >
      <span style={{ ...S.toggleThumb, transform: on ? 'translateX(13px)' : 'translateX(0)' }} />
    </button>
  )
}

function ToggleRow({ label, description, on, onChange }) {
  return (
    <div style={S.toggleRow}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={S.toggleLabel}>{label}</p>
        {description ? <p style={S.toggleDesc}>{description}</p> : null}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  )
}

function MiniPreview({ club, course }) {
  const accent = club.accent_color || '#7ab648'
  const panelBg = resolvePanelBg(club.panel_bg, club.panel_bg_custom)
  const proRows = (club.pro_shop_rows || []).filter((r) => r.enabled)
  const achievements = (club.community_items?.achievements || [])
    .filter((a) => a.enabled)
    .slice(0, 3)
  const events = (club.community_items?.events || []).filter((e) => e.enabled).slice(0, 2)
  const showWeather = club.display_slots?.panel?.weather !== false
  const showProShop = club.display_slots?.panel?.proShop !== false
  const showCommunity = club.display_slots?.panel?.community !== false
  const slotLabel = getFirstCenterSlotLabel(club.display_slots, course.daily_note)
  const statusStyle = getPreviewStatusStyle(course.course_status)
  const greens = course.greens_speed || '11.2 ft'

  return (
    <div style={S.miniOuter}>
      <div style={S.miniScaleBox}>
      <div style={S.miniScreen}>
        <div style={S.miniLeft}>
          <img src={club.bg_photo_url || DEFAULT_BG_URL} alt="" style={S.miniPhoto} />
          <div style={S.miniLeftOverlay}>
            <div style={S.miniLogoBlock}>
              <img src={club.logo_url || DEFAULT_LOGO_URL} alt="" style={S.miniLogo} />
              {club.show_tagline && club.club_tagline ? (
                <p style={S.miniTagline}>{club.club_tagline}</p>
              ) : null}
            </div>
            <div style={{ ...S.miniStatusBadge, ...statusStyle }}>
              {getPreviewStatusLabel(course.course_status)}
            </div>
            <div style={S.miniConditions}>
              <div>
                <p style={{ ...S.miniCondLabel, color: accent }}>Greens</p>
                <p style={S.miniCondVal}>{greens}</p>
              </div>
              <div>
                <p style={{ ...S.miniCondLabel, color: accent }}>Fairways</p>
                <p style={S.miniCondVal}>{course.fairway_condition}</p>
              </div>
              <div>
                <p style={{ ...S.miniCondLabel, color: accent }}>Bunkers</p>
                <p style={S.miniCondVal}>{course.bunker_condition}</p>
              </div>
              <div>
                <p style={{ ...S.miniCondLabel, color: accent }}>Cart</p>
                <p style={S.miniCondVal}>{course.cart_rule}</p>
              </div>
            </div>
            <div style={S.miniCenterCard}>
              <p style={{ ...S.miniCardLabel, color: accent }}>{slotLabel}</p>
              <p style={S.miniCardBody}>
                {slotLabel.toLowerCase().includes('notice') && course.daily_note
                  ? course.daily_note.slice(0, 60)
                  : slotLabel.toLowerCase().includes('tournament')
                    ? `${club.tournament_data?.name || 'Tournament'} · ${club.tournament_data?.round || 'Round 2'}`
                    : 'Preview content'}
              </p>
            </div>
          </div>
        </div>
        {showWeather || showProShop || showCommunity ? (
          <div style={{ ...S.miniRight, background: panelBg }}>
            {showWeather ? (
              <div style={S.miniPanelBlock}>
                <p style={S.miniTemp}>68°</p>
                <p style={S.miniWeatherSub}>Partly Cloudy · NE 10 mph</p>
                <div style={S.miniForecast}>
                  {['2 PM', '3 PM', '4 PM'].map((t) => (
                    <span key={t} style={S.miniForecastCol}>
                      {t}
                      <br />
                      70°
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {showProShop ? (
              <div style={S.miniPanelBlock}>
                <p style={{ ...S.miniSectionTitle, color: accent }}>{club.pro_shop_title}</p>
                {proRows.slice(0, 3).map((r) => (
                  <div key={r.id} style={S.miniRow}>
                    <span style={{ color: accent, fontSize: 5 }}>{r.label}</span>
                    <span style={S.miniRowVal}>{r.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {showCommunity ? (
              <div style={S.miniPanelBlock}>
                <p style={{ ...S.miniSectionTitle, color: accent }}>Community</p>
                {[...achievements, ...events].slice(0, 2).map((item) => (
                  <div key={item.id} style={{ marginTop: 3 }}>
                    <p style={{ fontSize: 4, color: accent, margin: 0, letterSpacing: 0.5 }}>
                      {item.type ? achievementTypeLabel(item.type) : 'UPCOMING'}
                    </p>
                    <p style={{ fontSize: 5, color: '#fff', margin: '1px 0 0' }}>{item.name}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      </div>
    </div>
  )
}

export default function Admin() {
  const [activeSection, setActiveSection] = useState('club')
  const [settingsRowId, setSettingsRowId] = useState(null)
  const [courseRowId, setCourseRowId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [publishError, setPublishError] = useState(null)

  const [club, setClub] = useState(defaultClubSettings)
  const [course, setCourse] = useState(defaultCourseForm)

  const [logoFile, setLogoFile] = useState(null)
  const [logoFileName, setLogoFileName] = useState('')
  const [logoPreview, setLogoPreview] = useState(null)
  const [bgFile, setBgFile] = useState(null)
  const [bgFileName, setBgFileName] = useState('')
  const [bgPreview, setBgPreview] = useState(null)

  const [showAchievementForm, setShowAchievementForm] = useState(false)
  const [achievementDraft, setAchievementDraft] = useState({
    type: 'Hole in One',
    name: '',
    detail: '',
    date: '',
  })

  const activeNav = useMemo(() => NAV_ITEMS.find((n) => n.id === activeSection), [activeSection])

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const settingsRes = await supabase
      .from('club_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const courseRes = await supabase
      .from('course_status')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (settingsRes.error) {
      setLoadError(settingsRes.error.message)
      setLoading(false)
      return
    }

    if (settingsRes.data) {
      const row = settingsRes.data
      setSettingsRowId(row.id)
      setClub({
        club_tagline: row.club_tagline ?? defaultClubSettings().club_tagline,
        show_tagline: row.show_tagline ?? true,
        location_name: row.location_name ?? 'Charlotte, NC',
        latitude: row.latitude,
        longitude: row.longitude,
        logo_url: row.logo_url ?? DEFAULT_LOGO_URL,
        accent_color: row.accent_color ?? '#7ab648',
        panel_bg: row.panel_bg ?? 'dark_green',
        panel_bg_custom: row.panel_bg_custom ?? PANEL_BG_PRESETS.dark_green,
        bg_photo_url: row.bg_photo_url ?? DEFAULT_BG_URL,
        pro_shop_title: row.pro_shop_title ?? 'Pro Shop & Dining',
        pro_shop_rows: parseJson(row.pro_shop_rows, defaultProShopRows()),
        community_items: parseJson(row.community_items, defaultCommunity()),
        tournament_data: parseJson(row.tournament_data, defaultTournament()),
        display_slots: parseJson(row.display_slots, defaultDisplaySlots()),
      })
      if (row.logo_url) {
        const name = decodeURIComponent(row.logo_url.split('/').pop() || 'logo.png')
        setLogoFileName(name)
      }
      if (row.bg_photo_url) {
        const name = decodeURIComponent(row.bg_photo_url.split('/').pop() || 'background.webp')
        setBgFileName(name)
      }
    }

    if (courseRes.error) {
      setLoadError(courseRes.error.message)
      setLoading(false)
      return
    }

    if (courseRes.data) {
      const row = courseRes.data
      setCourseRowId(row.id)
      const gs = row.greens_speed != null ? `${row.greens_speed} ft` : '11.2 ft'
      setCourse({
        course_status: row.course_status ?? 'Open',
        greens_speed: gs,
        fairway_condition: row.fairway_condition ?? 'Firm',
        bunker_condition: row.bunker_condition ?? 'Groomed',
        cart_rule: row.cart_rule ?? '90° Rule',
        daily_note: row.daily_note ?? '',
      })
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!published) return undefined
    const t = setTimeout(() => setPublished(false), 2500)
    return () => clearTimeout(t)
  }, [published])

  const updateClub = (patch) => setClub((c) => ({ ...c, ...patch }))

  const handleLogoFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoFileName(file.name)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleBgFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBgFile(file)
    setBgFileName(file.name)
    setBgPreview(URL.createObjectURL(file))
  }

  const handlePublish = async () => {
    if (publishing) return
    setPublishing(true)
    setPublishError(null)
    setPublished(false)

    try {
      let latitude = club.latitude
      let longitude = club.longitude
      try {
        const geo = await geocodeLocation(club.location_name)
        latitude = geo.latitude
        longitude = geo.longitude
      } catch (geoErr) {
        if (!latitude || !longitude) {
          throw geoErr
        }
        console.warn('[Admin] Geocode failed, using saved coordinates:', geoErr)
      }

      let logoUrl = club.logo_url
      let bgUrl = club.bg_photo_url
      if (logoFile) {
        logoUrl = await uploadToAssets(logoFile, 'logo')
      }
      if (bgFile) {
        bgUrl = await uploadToAssets(bgFile, 'course-bg')
      }

      const settingsPayload = {
        club_tagline: club.club_tagline.trim(),
        show_tagline: club.show_tagline,
        location_name: club.location_name.trim(),
        latitude,
        longitude,
        logo_url: logoUrl,
        accent_color: club.accent_color,
        panel_bg: club.panel_bg,
        panel_bg_custom: club.panel_bg_custom,
        bg_photo_url: bgUrl,
        pro_shop_title: club.pro_shop_title.trim(),
        pro_shop_rows: club.pro_shop_rows,
        community_items: club.community_items,
        tournament_data: club.tournament_data,
        display_slots: club.display_slots,
        updated_at: new Date().toISOString(),
      }

      const coursePayload = {
        course_status: course.course_status,
        cart_rule: course.cart_rule,
        greens_speed: parseGreensSpeed(course.greens_speed),
        fairway_condition: course.fairway_condition,
        bunker_condition: course.bunker_condition,
        daily_note: course.daily_note.trim().slice(0, 120),
        updated_at: new Date().toISOString(),
      }

      console.log('[Admin] Publishing club_settings:', settingsPayload)
      console.log('[Admin] Publishing course_status:', coursePayload)

      const { data: existingSettings, error: settingsLookupError } = await supabase
        .from('club_settings')
        .select('id')
        .limit(1)
        .maybeSingle()

      if (settingsLookupError) {
        console.error('[Admin] club_settings lookup failed:', settingsLookupError)
        throw new Error(`club_settings lookup: ${settingsLookupError.message}`)
      }

      const settingsId = existingSettings?.id ?? settingsRowId
      let settingsData
      let settingsError

      if (settingsId) {
        console.log('[Admin] Updating club_settings id:', settingsId)
        const result = await supabase
          .from('club_settings')
          .update(settingsPayload)
          .eq('id', settingsId)
          .select()
          .single()
        settingsData = result.data
        settingsError = result.error
      } else {
        console.log('[Admin] Inserting new club_settings row')
        const result = await supabase
          .from('club_settings')
          .insert(settingsPayload)
          .select()
          .single()
        settingsData = result.data
        settingsError = result.error
      }

      if (settingsError) {
        console.error('[Admin] club_settings save failed:', settingsError)
        throw new Error(`club_settings: ${settingsError.message}`)
      }
      console.log('[Admin] club_settings saved:', settingsData)
      if (settingsData?.id) setSettingsRowId(settingsData.id)

      const { data: existingCourse, error: courseLookupError } = await supabase
        .from('course_status')
        .select('id')
        .limit(1)
        .maybeSingle()

      if (courseLookupError) {
        console.error('[Admin] course_status lookup failed:', courseLookupError)
        throw new Error(`course_status lookup: ${courseLookupError.message}`)
      }

      const courseId = existingCourse?.id ?? courseRowId
      let courseData
      let courseError

      if (courseId) {
        console.log('[Admin] Updating course_status id:', courseId)
        const result = await supabase
          .from('course_status')
          .update(coursePayload)
          .eq('id', courseId)
          .select()
          .single()
        courseData = result.data
        courseError = result.error
      } else {
        console.log('[Admin] Inserting new course_status row')
        const result = await supabase
          .from('course_status')
          .insert(coursePayload)
          .select()
          .single()
        courseData = result.data
        courseError = result.error
      }

      if (courseError) {
        console.error('[Admin] course_status save failed:', courseError)
        throw new Error(`course_status: ${courseError.message}`)
      }
      console.log('[Admin] course_status saved:', courseData)
      if (courseData?.id) setCourseRowId(courseData.id)
      updateClub({ latitude, longitude, logo_url: logoUrl, bg_photo_url: bgUrl })
      setLogoFile(null)
      setBgFile(null)
      setPublished(true)
    } catch (err) {
      const message = err?.message || String(err)
      console.error('[Admin] Publish failed:', err)
      setPublishError(message)
    } finally {
      setPublishing(false)
    }
  }

  const addProShopRow = () => {
    if (club.pro_shop_rows.length >= 8) return
    updateClub({
      pro_shop_rows: [...club.pro_shop_rows, { id: uid(), label: '', value: '', enabled: true }],
    })
  }

  const addAchievement = () => {
    const active = club.community_items.achievements.filter((a) => a.enabled).length
    if (active >= 5 && !achievementDraft.name) return
    const entry = {
      id: uid(),
      type: achievementDraft.type,
      name: achievementDraft.name.trim(),
      detail: achievementDraft.detail.trim(),
      date: achievementDraft.date,
      enabled: true,
    }
    updateClub({
      community_items: {
        ...club.community_items,
        achievements: [entry, ...club.community_items.achievements],
      },
    })
    setAchievementDraft({ type: 'Hole in One', name: '', detail: '', date: '' })
    setShowAchievementForm(false)
  }

  const addEvent = () => {
    const events = club.community_items.events || []
    if (events.length >= 3) return
    updateClub({
      community_items: {
        ...club.community_items,
        events: [...events, { id: uid(), name: '', detail: '', enabled: true }],
      },
    })
  }

  const noteLen = course.daily_note.length

  const renderClubSection = () => (
    <>
      <SubHeader>Logo</SubHeader>
      <label style={S.uploadSlot}>
        <input type="file" accept="image/png,image/*" hidden onChange={handleLogoFile} />
        {logoPreview || club.logo_url ? (
          <img src={logoPreview || club.logo_url} alt="" style={S.uploadPreviewLogo} />
        ) : (
          <span style={S.uploadPlaceholder}>Upload logo</span>
        )}
      </label>
      {logoFileName ? <p style={S.hint}>{logoFileName}</p> : null}
      <p style={S.hint}>PNG with transparency · max 2MB</p>
      <FieldLabel>Tagline</FieldLabel>
      <TextInput
        value={club.club_tagline}
        onChange={(v) => updateClub({ club_tagline: v })}
        placeholder="e.g. 18 holes · Est. 1997"
      />
      <ToggleRow
        label="Show tagline below logo"
        on={club.show_tagline}
        onChange={(v) => updateClub({ show_tagline: v })}
      />
      <SubHeader>Location</SubHeader>
      <FieldLabel>City, State</FieldLabel>
      <TextInput
        value={club.location_name}
        onChange={(v) => updateClub({ location_name: v })}
        placeholder="e.g. Charlotte, NC"
      />
      <p style={S.hint}>
        We&apos;ll look up coordinates automatically for weather data and sunrise/sunset times
      </p>
    </>
  )

  const renderConditionsSection = () => (
    <>
      <SubHeader>Course status</SubHeader>
      <div style={S.statusGrid}>
        {STATUS_OPTIONS.map((status, i) => {
          const fullWidth = i === STATUS_OPTIONS.length - 1
          return (
            <button
              key={status}
              type="button"
              style={{
                ...S.statusBtn,
                ...(fullWidth ? { gridColumn: '1 / -1' } : {}),
                ...getStatusButtonStyle(status, course.course_status === status),
              }}
              onClick={() => setCourse((c) => ({ ...c, course_status: status }))}
            >
              {status}
            </button>
          )
        })}
      </div>
      <SubHeader>Conditions</SubHeader>
      <FieldLabel>Greens speed</FieldLabel>
      <TextInput
        value={course.greens_speed}
        onChange={(v) => setCourse((c) => ({ ...c, greens_speed: v }))}
        placeholder="11.2 ft"
      />
      <FieldLabel>Fairways</FieldLabel>
      <SelectInput
        value={course.fairway_condition}
        onChange={(v) => setCourse((c) => ({ ...c, fairway_condition: v }))}
        options={FAIRWAY_OPTIONS}
      />
      <FieldLabel>Bunkers</FieldLabel>
      <SelectInput
        value={course.bunker_condition}
        onChange={(v) => setCourse((c) => ({ ...c, bunker_condition: v }))}
        options={BUNKER_OPTIONS}
      />
      <FieldLabel>Cart rule</FieldLabel>
      <SelectInput
        value={course.cart_rule}
        onChange={(v) => setCourse((c) => ({ ...c, cart_rule: v }))}
        options={CART_OPTIONS}
      />
      <SubHeader>Today&apos;s note</SubHeader>
      <TextArea
        value={course.daily_note}
        onChange={(v) => setCourse((c) => ({ ...c, daily_note: v.slice(0, 120) }))}
        placeholder="Important message for golfers today"
        height={56}
      />
      <p style={{ ...S.charCount, color: noteLen > 100 ? '#f87171' : 'rgba(255,255,255,0.35)' }}>
        {noteLen} / 120
      </p>
    </>
  )

  const renderSlotsSection = () => (
    <>
      <SubHeader>Center card rotation</SubHeader>
      {CENTER_SLOT_TOGGLES.map(({ key, label, desc }) => (
        <ToggleRow
          key={key}
          label={label}
          description={desc}
          on={club.display_slots.center[key] !== false}
          onChange={(v) =>
            updateClub({
              display_slots: {
                ...club.display_slots,
                center: { ...club.display_slots.center, [key]: v },
              },
            })
          }
        />
      ))}
      <SubHeader>Right panel sections</SubHeader>
      {PANEL_SLOT_TOGGLES.map(({ key, label, desc }) => (
        <ToggleRow
          key={key}
          label={label}
          description={desc}
          on={club.display_slots.panel[key] !== false}
          onChange={(v) =>
            updateClub({
              display_slots: {
                ...club.display_slots,
                panel: { ...club.display_slots.panel, [key]: v },
              },
            })
          }
        />
      ))}
    </>
  )

  const renderProShopSection = () => (
    <>
      <SubHeader>Section title</SubHeader>
      <TextInput
        value={club.pro_shop_title}
        onChange={(v) => updateClub({ pro_shop_title: v })}
        placeholder="Pro Shop & Dining"
      />
      <SubHeader>Rows</SubHeader>
      {club.pro_shop_rows.map((row, idx) => (
        <div key={row.id} style={S.proRow}>
          <TextInput
            value={row.label}
            onChange={(v) => {
              const rows = [...club.pro_shop_rows]
              rows[idx] = { ...row, label: v }
              updateClub({ pro_shop_rows: rows })
            }}
            placeholder="Label"
            style={{ width: 90, flexShrink: 0 }}
          />
          <TextInput
            value={row.value}
            onChange={(v) => {
              const rows = [...club.pro_shop_rows]
              rows[idx] = { ...row, value: v }
              updateClub({ pro_shop_rows: rows })
            }}
            placeholder="Value"
            style={{ flex: 1 }}
          />
          <Toggle
            on={row.enabled !== false}
            onChange={(v) => {
              const rows = [...club.pro_shop_rows]
              rows[idx] = { ...row, enabled: v }
              updateClub({ pro_shop_rows: rows })
            }}
          />
          <button
            type="button"
            className="adm-delete-btn"
            style={S.deleteBtn}
            onClick={() =>
              updateClub({ pro_shop_rows: club.pro_shop_rows.filter((r) => r.id !== row.id) })
            }
            aria-label="Delete row"
          >
            <TablerIcon name="ti-x" style={{ fontSize: 14 }} />
          </button>
        </div>
      ))}
      <button
        type="button"
        style={S.addBtn}
        onClick={addProShopRow}
        disabled={club.pro_shop_rows.length >= 8}
      >
        Add row
      </button>
    </>
  )

  const renderCommunitySection = () => {
    const td = club.tournament_data
    const achievements = club.community_items.achievements || []
    const events = club.community_items.events || []
    const activeAchievements = achievements.filter((a) => a.enabled).length

    return (
      <>
        <SubHeader>Tournament leaderboard</SubHeader>
        <FieldLabel>Tournament name</FieldLabel>
        <TextInput
          value={td.name}
          onChange={(v) => updateClub({ tournament_data: { ...td, name: v } })}
          placeholder="Men's Invitational"
        />
        <FieldLabel>Round</FieldLabel>
        <SelectInput
          value={td.round}
          onChange={(v) => updateClub({ tournament_data: { ...td, round: v } })}
          options={ROUND_OPTIONS}
        />
        {td.rows.map((row, idx) => (
          <div key={row.position} style={S.leaderRow}>
            <span style={S.leaderPos}>{row.position}</span>
            <TextInput
              value={row.name}
              onChange={(v) => {
                const rows = [...td.rows]
                rows[idx] = { ...row, name: v }
                updateClub({ tournament_data: { ...td, rows } })
              }}
              placeholder="Name"
              style={{ flex: 1 }}
            />
            <TextInput
              value={row.score}
              onChange={(v) => {
                const rows = [...td.rows]
                rows[idx] = { ...row, score: v }
                updateClub({ tournament_data: { ...td, rows } })
              }}
              placeholder="Score"
              style={{ width: 44 }}
            />
            <TextInput
              value={row.thru}
              onChange={(v) => {
                const rows = [...td.rows]
                rows[idx] = { ...row, thru: v }
                updateClub({ tournament_data: { ...td, rows } })
              }}
              placeholder="Thru"
              style={{ width: 36 }}
            />
            <Toggle
              on={row.enabled !== false}
              onChange={(v) => {
                const rows = [...td.rows]
                rows[idx] = { ...row, enabled: v }
                updateClub({ tournament_data: { ...td, rows } })
              }}
            />
          </div>
        ))}
        <ToggleRow
          label="Golf Genius API"
          description={td.golfGeniusApi ? 'Auto-populate scores' : 'Uses manual entries above'}
          on={td.golfGeniusApi}
          onChange={(v) => updateClub({ tournament_data: { ...td, golfGeniusApi: v } })}
        />
        {td.golfGeniusApi ? (
          <>
            <FieldLabel>API key</FieldLabel>
            <TextInput
              value={td.apiKey}
              onChange={(v) => updateClub({ tournament_data: { ...td, apiKey: v } })}
              placeholder="Golf Genius API key"
            />
            <p style={S.hint}>Connect Golf Genius to auto-populate scores</p>
          </>
        ) : null}

        <SubHeader>Member spotlight</SubHeader>
        {!showAchievementForm ? (
          <button type="button" style={S.addBtn} onClick={() => setShowAchievementForm(true)}>
            Add achievement
          </button>
        ) : (
          <div style={S.achievementForm}>
            <FieldLabel>Type</FieldLabel>
            <SelectInput
              value={achievementDraft.type}
              onChange={(v) => setAchievementDraft((d) => ({ ...d, type: v }))}
              options={ACHIEVEMENT_TYPES}
            />
            <FieldLabel>Name</FieldLabel>
            <TextInput
              value={achievementDraft.name}
              onChange={(v) => setAchievementDraft((d) => ({ ...d, name: v }))}
              placeholder="Robert Chen"
            />
            <FieldLabel>Detail</FieldLabel>
            <TextInput
              value={achievementDraft.detail}
              onChange={(v) => setAchievementDraft((d) => ({ ...d, detail: v }))}
              placeholder="Hole 7 · 162 yds · 7-iron"
            />
            <FieldLabel>Date</FieldLabel>
            <input
              type="date"
              value={achievementDraft.date}
              onChange={(e) => setAchievementDraft((d) => ({ ...d, date: e.target.value }))}
              className="adm-input"
              style={S.input}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" style={{ ...S.addBtn, flex: 1 }} onClick={addAchievement}>
                Save
              </button>
              <button
                type="button"
                style={{ ...S.previewBtn, flex: 1, height: 32 }}
                onClick={() => setShowAchievementForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {activeAchievements >= 5 ? (
          <p style={S.hint}>Maximum 5 active achievements (disable one to add another)</p>
        ) : null}
        {achievements.map((a, idx) => (
          <div key={a.id} style={S.achievementCard}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ ...S.achievementType, color: club.accent_color }}>
                {achievementTypeLabel(a.type)}
              </p>
              <p style={S.achievementName}>{a.name}</p>
              <p style={S.achievementDetail}>{a.detail}</p>
              {a.date ? <p style={S.hint}>{a.date}</p> : null}
            </div>
            <Toggle
              on={a.enabled !== false}
              onChange={(v) => {
                const list = [...achievements]
                list[idx] = { ...a, enabled: v }
                updateClub({ community_items: { ...club.community_items, achievements: list } })
              }}
            />
            <button
              type="button"
              className="adm-delete-btn"
              style={S.deleteBtn}
              onClick={() =>
                updateClub({
                  community_items: {
                    ...club.community_items,
                    achievements: achievements.filter((x) => x.id !== a.id),
                  },
                })
              }
            >
              <TablerIcon name="ti-x" style={{ fontSize: 14 }} />
            </button>
          </div>
        ))}

        <SubHeader>Events</SubHeader>
        {events.map((ev, idx) => (
          <div key={ev.id} style={S.eventRow}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <TextInput
                value={ev.name}
                onChange={(v) => {
                  const list = [...events]
                  list[idx] = { ...ev, name: v }
                  updateClub({ community_items: { ...club.community_items, events: list } })
                }}
                placeholder="Event name"
              />
              <TextInput
                value={ev.detail}
                onChange={(v) => {
                  const list = [...events]
                  list[idx] = { ...ev, detail: v }
                  updateClub({ community_items: { ...club.community_items, events: list } })
                }}
                placeholder="May 24–26"
              />
            </div>
            <Toggle
              on={ev.enabled !== false}
              onChange={(v) => {
                const list = [...events]
                list[idx] = { ...ev, enabled: v }
                updateClub({ community_items: { ...club.community_items, events: list } })
              }}
            />
            <button
              type="button"
              className="adm-delete-btn"
              style={S.deleteBtn}
              onClick={() =>
                updateClub({
                  community_items: {
                    ...club.community_items,
                    events: events.filter((x) => x.id !== ev.id),
                  },
                })
              }
            >
              <TablerIcon name="ti-x" style={{ fontSize: 14 }} />
            </button>
          </div>
        ))}
        <button type="button" style={S.addBtn} onClick={addEvent} disabled={events.length >= 3}>
          Add event
        </button>
      </>
    )
  }

  const renderBrandingSection = () => (
    <>
      <SubHeader>Colors</SubHeader>
      <FieldLabel>Label accent color</FieldLabel>
      <div style={S.colorRow}>
        <label style={{ cursor: 'pointer' }}>
          <input
            type="color"
            value={club.accent_color}
            onChange={(e) => updateClub({ accent_color: e.target.value })}
            style={S.colorSwatch}
          />
        </label>
        <TextInput
          value={club.accent_color}
          onChange={(v) => updateClub({ accent_color: v })}
          placeholder="#7ab648"
          style={{ flex: 1 }}
        />
      </div>
      <FieldLabel>Right panel background</FieldLabel>
      <select
        value={club.panel_bg}
        onChange={(e) => updateClub({ panel_bg: e.target.value })}
        className="adm-select"
        style={S.input}
      >
        <option value="dark_green">Dark green (default)</option>
        <option value="dark_navy">Dark navy</option>
        <option value="dark_charcoal">Dark charcoal</option>
        <option value="custom">Custom</option>
      </select>
      {club.panel_bg === 'custom' ? (
        <>
          <FieldLabel>Custom background</FieldLabel>
          <TextInput
            value={club.panel_bg_custom}
            onChange={(v) => updateClub({ panel_bg_custom: v })}
            placeholder="rgba(6,14,8,0.82)"
          />
        </>
      ) : null}
      <SubHeader>Background photo</SubHeader>
      <div style={S.bgSlot}>
        <img src={bgPreview || club.bg_photo_url || DEFAULT_BG_URL} alt="" style={S.bgPreview} />
      </div>
      {bgFileName ? <p style={S.hint}>{bgFileName}</p> : null}
      <label style={S.addBtn}>
        <input type="file" accept="image/jpeg,image/webp,image/*" hidden onChange={handleBgFile} />
        Upload new photo
      </label>
      <p style={S.hint}>16:9 landscape · min 1920×1080 · JPG or WebP</p>
    </>
  )

  const renderEditBody = () => {
    if (loading) return <p style={S.loading}>Loading settings…</p>
    if (loadError) return <p style={S.error}>{loadError}</p>
    switch (activeSection) {
      case 'club':
        return renderClubSection()
      case 'conditions':
        return renderConditionsSection()
      case 'slots':
        return renderSlotsSection()
      case 'proshop':
        return renderProShopSection()
      case 'community':
        return renderCommunitySection()
      case 'branding':
        return renderBrandingSection()
      default:
        return null
    }
  }

  const publishLabel = publishing ? 'Publishing…' : published ? 'Published ✓' : 'Publish to all screens'

  return (
    <div className="admin-dashboard">
      <style>{`
        .admin-dashboard, .admin-dashboard * { box-sizing: border-box; }
        .admin-dashboard {
          display: flex;
          height: 100vh;
          overflow: hidden;
          background: #0a0f0a;
          font-family: Inter, system-ui, -apple-system, sans-serif;
          color: #fff;
          -webkit-font-smoothing: antialiased;
        }
        .adm-input:focus, .adm-select:focus {
          border-color: rgba(122,182,72,0.45) !important;
          outline: none;
        }
        .adm-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='rgba(255,255,255,0.45)' d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 8px center;
          padding-right: 24px;
        }
        .admin-edit-body::-webkit-scrollbar { width: 3px; }
        .admin-edit-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        .adm-icon-btn:hover { background: rgba(255,255,255,0.06) !important; color: rgba(255,255,255,0.70) !important; }
        .adm-icon-btn.active { background: rgba(122,182,72,0.15) !important; color: #7ab648 !important; }
        .adm-delete-btn:hover { color: #f87171 !important; border-color: rgba(248,113,113,0.35) !important; }
        @keyframes adm-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>

      <nav style={S.sidebar}>
        {NAV_ITEMS.map((item) => (
          <React.Fragment key={item.id}>
            {item.dividerBefore ? (
              <div style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
            ) : null}
            <button
              type="button"
              className={`adm-icon-btn${activeSection === item.id ? ' active' : ''}`}
              style={{
                ...S.iconBtn,
                ...(activeSection === item.id
                  ? { background: 'rgba(122,182,72,0.15)', color: '#7ab648' }
                  : {}),
              }}
              onClick={() => setActiveSection(item.id)}
              title={item.title}
            >
              <i className={`ti ti-${item.icon}`} aria-hidden="true" />
            </button>
          </React.Fragment>
        ))}
      </nav>

      <aside style={S.editPanel}>
        <header style={S.editHeader}>
          <p style={S.editTitle}>{activeNav?.title}</p>
          <p style={S.editSubtitle}>{activeNav?.subtitle}</p>
        </header>
        <div className="admin-edit-body" style={S.editBody}>
          {renderEditBody()}
        </div>
        <footer style={S.editFooter}>
          <button type="button" style={S.previewBtn} title="Open player preview" onClick={() => window.open('/', '_blank')}>
            <TablerIcon name="ti-eye" style={{ fontSize: 16 }} />
          </button>
          <button
            type="button"
            style={{
              ...S.publishBtn,
              opacity: publishing ? 0.75 : 1,
              background: published ? '#14532d' : '#166534',
            }}
            onClick={handlePublish}
            disabled={publishing || loading}
          >
            <TablerIcon name="ti-send" style={{ fontSize: 14, marginRight: 6 }} />
            {publishLabel}
          </button>
        </footer>
        {publishError ? (
          <p style={S.publishError} role="alert">
            Publish failed: {publishError}
          </p>
        ) : null}
      </aside>

      <main style={S.previewPanel}>
        <div style={S.previewHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={S.liveDot} />
            <span style={S.previewHeaderText}>Live preview · updates as you edit</span>
          </div>
          <span style={S.previewClubName}>{CLUB_DISPLAY_NAME}</span>
        </div>
        <div style={S.previewFrame}>
          <div style={S.previewFrameInner}>
            <MiniPreview club={club} course={course} />
          </div>
        </div>
      </main>
    </div>
  )
}

const S = {
  sidebar: {
    width: 52,
    flexShrink: 0,
    background: '#070c07',
    borderRight: '0.5px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '14px 0',
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 18,
    color: 'rgba(255,255,255,0.35)',
    border: 'none',
    background: 'transparent',
    transition: 'all 0.15s',
    padding: 0,
  },
  editPanel: {
    width: 280,
    flexShrink: 0,
    background: '#0a0f0a',
    borderRight: '0.5px solid rgba(255,255,255,0.07)',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  editHeader: {
    padding: '14px 14px 10px',
    borderBottom: '0.5px solid rgba(255,255,255,0.07)',
  },
  editTitle: { margin: 0, fontSize: 13, fontWeight: 500, color: '#fff' },
  editSubtitle: { margin: '2px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.35)' },
  editBody: {
    flex: 1,
    overflowY: 'auto',
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minHeight: 0,
  },
  editFooter: {
    padding: '10px 14px',
    borderTop: '0.5px solid rgba(255,255,255,0.07)',
    display: 'flex',
    gap: 6,
  },
  previewBtn: {
    width: 38,
    height: 38,
    flexShrink: 0,
    background: 'rgba(255,255,255,0.06)',
    border: '0.5px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    color: 'rgba(255,255,255,0.60)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  publishBtn: {
    flex: 1,
    height: 38,
    background: '#166534',
    border: '0.5px solid rgba(74,222,128,0.30)',
    color: '#4ade80',
    fontSize: 12,
    fontWeight: 700,
    borderRadius: 8,
    letterSpacing: 0.5,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'inherit',
  },
  previewPanel: {
    flex: 1,
    minWidth: 0,
    background: '#0d140d',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  previewHeader: {
    padding: '10px 14px',
    borderBottom: '0.5px solid rgba(255,255,255,0.07)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#4ade80',
    animation: 'adm-pulse 2s ease-in-out infinite',
  },
  previewHeaderText: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  previewClubName: { fontSize: 11, color: 'rgba(255,255,255,0.28)' },
  previewFrame: {
    flex: 1,
    width: '100%',
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
    overflow: 'hidden',
  },
  previewFrameInner: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
  },
  subSectionHeader: {
    margin: 0,
    fontSize: 9,
    color: '#7ab648',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    paddingBottom: 6,
    borderBottom: '0.5px solid rgba(122,182,72,0.18)',
  },
  fieldLabel: {
    display: 'block',
    margin: '0 0 4px',
    fontSize: 10,
    color: 'rgba(255,255,255,0.50)',
  },
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '0.5px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    color: '#fff',
    fontSize: 11,
    padding: '5px 8px',
    width: '100%',
    fontFamily: 'inherit',
  },
  textarea: { resize: 'none' },
  toggleTrack: {
    width: 30,
    height: 17,
    borderRadius: 9,
    border: 'none',
    padding: 2,
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  toggleThumb: {
    width: 13,
    height: 13,
    borderRadius: '50%',
    background: '#fff',
    transition: 'transform 0.2s',
    display: 'block',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 0',
    gap: 10,
  },
  toggleLabel: { margin: 0, fontSize: 11, color: '#fff' },
  toggleDesc: { margin: '2px 0 0', fontSize: 9, color: 'rgba(255,255,255,0.35)' },
  hint: { margin: '4px 0 0', fontSize: 9, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 },
  charCount: { margin: '4px 0 0', textAlign: 'right', fontSize: 10 },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 6,
  },
  statusBtn: {
    minHeight: 34,
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '4px 6px',
  },
  uploadSlot: {
    display: 'block',
    aspectRatio: '3 / 1',
    border: '1px dashed rgba(255,255,255,0.18)',
    borderRadius: 8,
    overflow: 'hidden',
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.03)',
  },
  uploadPreviewLogo: { width: '100%', height: '100%', objectFit: 'contain', padding: 8 },
  uploadPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
  },
  proRow: { display: 'flex', alignItems: 'center', gap: 6 },
  deleteBtn: {
    width: 28,
    height: 28,
    flexShrink: 0,
    border: '0.5px solid rgba(255,255,255,0.10)',
    borderRadius: 6,
    background: 'transparent',
    color: 'rgba(255,255,255,0.40)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  addBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '0.5px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    padding: '8px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'center',
  },
  leaderRow: { display: 'flex', alignItems: 'center', gap: 4 },
  leaderPos: {
    width: 18,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    flexShrink: 0,
  },
  achievementForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 10,
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    border: '0.5px solid rgba(255,255,255,0.08)',
  },
  achievementCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '8px 0',
    borderBottom: '0.5px solid rgba(255,255,255,0.06)',
  },
  achievementType: { margin: 0, fontSize: 8, letterSpacing: 1.2, textTransform: 'uppercase' },
  achievementName: { margin: '2px 0 0', fontSize: 11, fontWeight: 500 },
  achievementDetail: { margin: '2px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.55)' },
  eventRow: { display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 0' },
  colorRow: { display: 'flex', alignItems: 'center', gap: 8 },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    background: 'transparent',
  },
  bgSlot: {
    aspectRatio: '16 / 9',
    borderRadius: 8,
    overflow: 'hidden',
    border: '0.5px solid rgba(255,255,255,0.10)',
  },
  bgPreview: { width: '100%', height: '100%', objectFit: 'cover' },
  loading: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  error: { color: '#f87171', fontSize: 11 },
  publishError: {
    margin: 0,
    padding: '8px 14px 12px',
    fontSize: 11,
    lineHeight: 1.4,
    color: '#fca5a5',
    background: 'rgba(127,29,29,0.35)',
    borderTop: '0.5px solid rgba(248,113,113,0.25)',
  },
  miniOuter: {
    width: '100%',
    maxHeight: '100%',
    aspectRatio: '16 / 9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniScaleBox: {
    width: `${(100 / 1.8).toFixed(2)}%`,
    height: `${(100 / 1.8).toFixed(2)}%`,
    transform: 'scale(1.8)',
    transformOrigin: 'center center',
  },
  miniScreen: {
    width: '100%',
    height: '100%',
    display: 'flex',
    borderRadius: 8,
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
  },
  miniLeft: { width: '72%', position: 'relative', overflow: 'hidden' },
  miniPhoto: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  miniLeftOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 40%, rgba(0,0,0,0.55) 100%)',
  },
  miniLogoBlock: { position: 'absolute', top: '4%', left: '3%' },
  miniLogo: { height: 14, width: 'auto', filter: 'brightness(10)', opacity: 0.92 },
  miniTagline: { margin: '2px 0 0', fontSize: 4, color: '#fff' },
  miniStatusBadge: {
    position: 'absolute',
    top: '4%',
    left: '62%',
    transform: 'translateX(-50%)',
    fontSize: 4,
    fontWeight: 700,
    letterSpacing: 0.5,
    padding: '2px 6px',
    borderRadius: 8,
    whiteSpace: 'nowrap',
  },
  miniConditions: {
    position: 'absolute',
    left: '3%',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  miniCondLabel: { margin: 0, fontSize: 3.5, textTransform: 'uppercase', letterSpacing: 0.4 },
  miniCondVal: { margin: '1px 0 0', fontSize: 5.5, color: '#fff' },
  miniCenterCard: {
    position: 'absolute',
    top: '50%',
    left: '62%',
    transform: 'translate(-50%, -50%)',
    width: '38%',
    background: 'rgba(255,255,255,0.12)',
    backdropFilter: 'blur(4px)',
    borderRadius: 4,
    padding: '6px 8px',
    border: '0.5px solid rgba(255,255,255,0.15)',
  },
  miniCardLabel: { margin: 0, fontSize: 3.5, textTransform: 'uppercase', letterSpacing: 0.5 },
  miniCardBody: { margin: '3px 0 0', fontSize: 4.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.3 },
  miniRight: {
    width: '28%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-evenly',
    padding: '6px 8px',
    fontSize: 5,
  },
  miniPanelBlock: { padding: '2px 0' },
  miniTemp: { margin: 0, fontSize: 14, fontWeight: 200, lineHeight: 1 },
  miniWeatherSub: { margin: '2px 0 0', fontSize: 4, color: 'rgba(255,255,255,0.65)' },
  miniForecast: { display: 'flex', gap: 4, marginTop: 4 },
  miniForecastCol: { flex: 1, textAlign: 'center', fontSize: 3.5, color: 'rgba(255,255,255,0.55)' },
  miniSectionTitle: {
    margin: '0 0 3px',
    fontSize: 4,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  miniRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 4,
    marginTop: 2,
    gap: 4,
  },
  miniRowVal: { color: 'rgba(255,255,255,0.85)', textAlign: 'right' },
}
