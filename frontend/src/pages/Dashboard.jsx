import React from 'react'
import AuthButton from '@/components/AuthButton';

export default function Dashboard(){
  return (
    <div style={{maxWidth:700, margin:'2rem auto', padding:'1rem', fontFamily:'sans-serif', position:'relative'}}>
      <AuthButton />
      <h2>Dashboard</h2>
      <p>This is a placeholder dashboard — login required.</p>
    </div>
  )
}
