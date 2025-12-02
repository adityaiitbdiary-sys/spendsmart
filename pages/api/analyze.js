// pages/api/analyze.js
import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY
const APP_CLIENT_SECRET = process.env.APP_CLIENT_SECRET || ''

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  if (APP_CLIENT_SECRET && req.headers['x-app-secret'] !== APP_CLIENT_SECRET) {
    return res.status(401).json({ error: 'unauthorized header' })
  }

  const accessToken = req.headers.authorization?.replace('Bearer ', '')
  if (!accessToken) return res.status(401).json({ error: 'missing token' })

  // verify user
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'invalid token' })
  const userId = userData.user.id

  // fetch user's expenses
  const { data: expenses, error: fetchErr } = await supabaseAdmin
    .from('expenses')
    .select('item,amount,category,expense_date')
    .eq('owner', userId)
    .order('expense_date', { ascending: false })

  if (fetchErr) return res.status(500).json({ error: 'db error' })

  // build analysis prompt
  const prompt = `You are a helpful financial coach. Given the user's expenses JSON below, provide:
1) A short summary of spending distribution (categories and percentages).
2) Two observations (what stands out).
3) Two practical tips to reduce spending.
Return plain text, human-friendly.

Expenses:
${JSON.stringify(expenses)}
`

  const r = await fetch('https://api.gemini.example/v1/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GEMINI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt, max_tokens: 400 })
  })

  if (!r.ok) {
    const textErr = await r.text()
    return res.status(500).json({ error: 'gemini error: ' + textErr })
  }
  const json = await r.json()
  const analysis = json?.text ?? JSON.stringify(json)
  return res.status(200).json({ analysis })
}
