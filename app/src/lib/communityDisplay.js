export const COMMUNITY_ROTATE_MS = 8000

export const DEFAULT_COMMUNITY_EVENTS = [
  {
    key: 'default-event-1',
    type: 'Upcoming',
    name: "Men's Invitational",
    detail: 'May 24–26 · Registration open',
  },
  {
    key: 'default-event-2',
    type: 'Events',
    name: 'Wine Tasting May 31',
    detail: '',
  },
]

const FALLBACK_ACHIEVEMENTS = [
  {
    key: 'default-ach-1',
    type: 'Hole in One',
    name: 'Robert Chen',
    detail: 'Hole 7 · 162 yds · 7-iron · May 21',
  },
  {
    key: 'default-ach-2',
    type: 'Low Round',
    name: 'J. Williams',
    detail: '68 · May 20 · -4 under par',
  },
]

export function normalizeCommunityItems(communityItems) {
  const raw = communityItems && typeof communityItems === 'object' ? communityItems : {}
  return {
    achievements: Array.isArray(raw.achievements) ? raw.achievements : [],
    events: Array.isArray(raw.events) ? raw.events : [],
  }
}

/** Achievements rotate; events are always shown on screen. */
export function buildCommunitySections(communityItems) {
  const { achievements: achievementRows, events: eventRows } =
    normalizeCommunityItems(communityItems)

  const achievements = []
  const achievementList = achievementRows.filter((a) => a.enabled !== false)
  achievementList.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))

  for (const a of achievementList) {
    const name = String(a.name || '').trim()
    if (!name) continue
    achievements.push({
      key: a.id || `ach-${achievements.length}`,
      type: String(a.type || 'Achievement').trim() || 'Achievement',
      name,
      detail: String(a.detail || '').trim(),
    })
  }

  const events = []
  const eventList = eventRows.filter((e) => e.enabled !== false)
  let eventCount = 0
  eventList.forEach((e, idx) => {
    const name = String(e.name || '').trim()
    if (!name) return
    eventCount += 1
    const eventType = String(e.type || '').trim()
    events.push({
      key: e.id || `ev-${idx}`,
      type: eventType || (eventCount === 1 ? 'Upcoming' : 'Events'),
      name,
      detail: String(e.detail || '').trim(),
    })
  })

  if (!achievements.length && !events.length) {
    return {
      achievements: [...FALLBACK_ACHIEVEMENTS],
      events: [...DEFAULT_COMMUNITY_EVENTS],
    }
  }

  if (!events.length) {
    return { achievements, events: [...DEFAULT_COMMUNITY_EVENTS] }
  }

  return { achievements, events }
}
