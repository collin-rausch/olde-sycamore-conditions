import '@testing-library/jest-dom'

window.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
})

jest.mock('./lib/supabaseClient')

jest.mock('@screencloud/apps-sdk', () => ({
  connectScreenCloud: jest.fn(() => Promise.resolve()),
  getScreenCloud: jest.fn(() => null),
}))

jest.mock('@screencloud/apps-editor-sdk', () => ({
  connectScreenCloud: jest.fn(() => Promise.resolve()),
  getScreenCloud: jest.fn(() => null),
}))
