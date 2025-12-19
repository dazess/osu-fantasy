import React, { useState } from 'react'
import { register } from '../api'

export default function Register({ onRegister }){
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)

  async function doRegister(e){
    e.preventDefault()
    setMsg(null)
    const res = await register(username, email, password)
    if(res.id){
      setMsg('Registered — you can now log in')
      onRegister()
    } else {
      setMsg(res.detail || 'Registration failed')
    }
  }

  return (
    <form onSubmit={doRegister} style={{display:'grid', gap:8}}>
      <h2>Register</h2>
      <input placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} />
      <input placeholder="email (optional)" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button type="submit">Register</button>
      {msg && <div>{msg}</div>}
    </form>
  )
}
