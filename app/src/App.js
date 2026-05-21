import React from 'react'
import Player from './routes/Player'
import Editor from './routes/Editor'

function App() {
  const isEditor = window.location.pathname.includes('/editor')

  return (
    <div className="App">
      {isEditor ? <Editor /> : <Player />}
    </div>
  )
}

export default App
