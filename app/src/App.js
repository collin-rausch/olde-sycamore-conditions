import React, { useEffect } from 'react'
import Player from './routes/Player'
import Editor from './routes/Editor'
import Admin from './routes/Admin'

function getPageTitle(pathname) {
  if (pathname.includes('/admin')) return 'Admin · Olde Sycamore'
  if (pathname.includes('/editor')) return 'Editor · Olde Sycamore'
  return 'Olde Sycamore Golf Club'
}

function App() {
  const path = window.location.pathname
  const isEditor = path.includes('/editor')
  const isAdmin = path.includes('/admin')

  useEffect(() => {
    document.title = getPageTitle(window.location.pathname)
  }, [])

  return (
    <div className="App">
      {isAdmin ? <Admin /> : isEditor ? <Editor /> : <Player />}
    </div>
  )
}

export default App
