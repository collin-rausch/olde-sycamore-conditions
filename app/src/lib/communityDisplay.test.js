import {
  buildCommunitySections,
  COMMUNITY_ROTATE_MS,
  DEFAULT_COMMUNITY_EVENTS,
} from './communityDisplay'

test('COMMUNITY_ROTATE_MS is 8 seconds', () => {
  expect(COMMUNITY_ROTATE_MS).toBe(8000)
})

test('buildCommunitySections returns default events when none provided', () => {
  const { achievements, events } = buildCommunitySections({ achievements: [], events: [] })
  expect(achievements.length).toBeGreaterThan(0)
  expect(events).toEqual(DEFAULT_COMMUNITY_EVENTS)
})

test('buildCommunitySections uses admin events when provided', () => {
  const { events } = buildCommunitySections({
    achievements: [],
    events: [{ name: "Men's Invitational", detail: 'June 1', enabled: true }],
  })
  expect(events.some((e) => e.name.includes('Invitational'))).toBe(true)
})

test('buildCommunitySections omits disabled events', () => {
  const { events } = buildCommunitySections({
    achievements: [],
    events: [{ name: 'Hidden', enabled: false }],
  })
  expect(events).toEqual(DEFAULT_COMMUNITY_EVENTS)
})
