import { useState } from 'react'
import ChatbotInterface from './ChatbotIframe'

function App() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundImage: 'url("Screenshot 2025-11-13 135432.png")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed'
    }}>
      <ChatbotInterface/>
    </div>
  )
}

export default App;