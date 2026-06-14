// LAB — Game Browser shell (OddsJam/Pikkit-style). Holds sport + game state:
// shows EventsPicker to pick a sport+game, then GamePage for the chosen game.
// Fully self-contained: imports ONLY EventsPicker, GamePage, and botShared.
// Does NOT import or touch MatrixBot.jsx or any CH2/LookChannel code.
import { useState } from 'react'
import EventsPicker from './EventsPicker.jsx'
import GamePage from './GamePage.jsx'
import { NEON_T, R } from './botShared.jsx'

export default function GameBrowser({ token, onAddToSlip, onLogPosition }) {
  const [sport, setSport] = useState('MLB')
  const [game, setGame] = useState(null)

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '16px 14px', fontFamily: R }}>
      {!game ? (
        <>
          <div style={{ fontSize: '12px', fontWeight: 700, color: NEON_T, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>
            Lab — Game Browser
          </div>
          <EventsPicker
            sport={sport}
            onPickSport={setSport}
            onPickGame={(g) => { setSport(g.sport || sport); setGame(g) }}
            token={token}
          />
        </>
      ) : (
        <GamePage
          game={game}
          sport={game.sport || sport}
          token={token}
          onAddToSlip={onAddToSlip}
          onLogPosition={onLogPosition}
          onSwitchGame={(g) => { setSport(g.sport || sport); setGame(g) }}
          onBack={() => setGame(null)}
        />
      )}
    </div>
  )
}
