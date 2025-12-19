const API_BASE = '/api'

export async function register(username, email, password){
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({username, email, password})
  })
  return res.json()
}

export async function login(username, password){
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({username, password})
  })
  return res.json()
}

export async function me(token){
  const res = await fetch(`${API_BASE}/me`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  return res.json()
}
