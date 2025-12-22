import React from 'react'
import AuthButton from '../components/AuthButton'
import ShadButton from '../components/ui/ShadButton'
import { LeagueItem } from '../components/league-item'

export default function Landing(){
  return (
    <div style={{ minHeight: '100vh', background: '#24222A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ opacity: 0.9, marginTop: 8 }}></p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 18 }}>
        </div>

        <div style={{ marginTop: 18 }}>
          <AuthButton />
          <LeagueItem leagueName="osu! World Cup 2025" />
        </div>
      </div>
    </div>
  )
}