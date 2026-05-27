import { render, screen } from '@testing-library/react'
import App from './App'

beforeEach(() => {
  window.history.pushState({}, '', '/')
  sessionStorage.clear()
})

test('renders the signage player on the default route', async () => {
  render(<App />)
  expect(
    await screen.findByRole('main', { name: /olde sycamore golf club conditions display/i }),
  ).toBeInTheDocument()
})

test('renders admin sign-in when visiting /admin', () => {
  window.history.pushState({}, '', '/admin')
  render(<App />)
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/enter password/i)).toBeInTheDocument()
})
