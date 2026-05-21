import React from 'react'
import Player from './routes/Player'
import Editor from './routes/Editor'
import Admin from './routes/Admin'

function App() {
  const path = window.location.pathname
  const isEditor = path.includes('/editor')
  const isAdmin = path.includes('/admin')

  return (
    <div className="App">
      {isAdmin ? <Admin /> : isEditor ? <Editor /> : <Player />}
    </div>
  )
}

export default App
