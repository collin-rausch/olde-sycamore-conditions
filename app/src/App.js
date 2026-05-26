import React, { useEffect, useState } from 'react'
import Player from './routes/Player'
import Editor from './routes/Editor'
import Admin from './routes/Admin'

const ADMIN_LOGO_URL =
  'https://xntieyqrodsjelotcmnr.supabase.co/storage/v1/object/public/assets/olde%20sycamore%20golf%20club%20logo.png'

function getPageTitle(pathname) {
  if (pathname.includes('/admin')) return 'Admin · Olde Sycamore'
  if (pathname.includes('/editor')) return 'Editor · Olde Sycamore'
  return 'Olde Sycamore Golf Club'
}

function App() {
  const path = window.location.pathname
  const isEditor = path.includes('/editor')
  const isAdmin = path.includes('/admin')

  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem('admin_authenticated') === 'true',
  )
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    document.title = getPageTitle(path)
  }, [path])

  const handleAdminSignIn = (e) => {
    e.preventDefault()
    if (pw === process.env.REACT_APP_ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_authenticated', 'true')
      setAuthed(true)
      setErr('')
      setPw('')
      return
    }
    setErr('Incorrect password')
    setPw('')
  }

  if (isAdmin && !authed) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0a0f0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <form
          onSubmit={handleAdminSignIn}
          style={{
            background: '#111814',
            border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            padding: '32px 28px',
            width: 320,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <img
            src={ADMIN_LOGO_URL}
            alt="Olde Sycamore Golf Club"
            style={{
              height: 52,
              width: 'auto',
              filter: 'brightness(10)',
              opacity: 0.9,
            }}
          />
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 13,
              fontWeight: 500,
              color: '#fff',
              textAlign: 'center',
            }}
          >
            Signage Manager
          </p>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 11,
              color: 'rgba(255,255,255,0.38)',
              textAlign: 'center',
            }}
          >
            Olde Sycamore Golf Club
          </p>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            style={{
              marginTop: 24,
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 14px',
              fontSize: 13,
              color: '#fff',
              background: 'rgba(255,255,255,0.06)',
              border: '0.5px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
            }}
          />
          <button
            type="submit"
            style={{
              marginTop: 10,
              width: '100%',
              height: 44,
              background: '#166534',
              border: '0.5px solid rgba(74,222,128,0.30)',
              color: '#4ade80',
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Sign in
          </button>
          <p
            role="alert"
            style={{
              margin: '8px 0 0',
              width: '100%',
              height: 16,
              fontSize: 11,
              color: '#f87171',
              textAlign: 'center',
            }}
          >
            {err || '\u00a0'}
          </p>
        </form>
      </div>
    )
  }

  return (
    <div className="App">
      {isAdmin ? <Admin /> : isEditor ? <Editor /> : <Player />}
    </div>
  )
}

export default App
