// pages/api/parse-expense.js
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

  // verify token via Supabase Admin SDK
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken)
  if (userErr || !userData?.user) return res.status(401).json({ error: 'invalid token' })
  const userId = userData.user.id

  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'missing text' })

  // Build prompt for Gemini to return strict JSON
  const prompt = `
You are an assistant that extracts structured expense JSON from short user text.
Input: ${text}
Return ONLY valid JSON with these fields: item (string), amount (number), category (string), expense_date (YYYY-MM-DD optional).
If amount is not present, return amount: 0. If category is unclear, set category to "Other".
Example output:
{"item":"Pizza","amount":450,"category":"Food","expense_date":"2025-12-03"}
Now parse the input and return JSON only.
`

  // Call Gemini (replace URL with your provider's actual endpoint as required)
  const r = await fetch('https://api.gemini.example/v1/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GEMINI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      max_tokens: 200
    })
  })

  if (!r.ok) {
    const textErr = await r.text()
    return res.status(500).json({ error: 'gemini error: ' + textErr })
  }
  const result = await r.json()
  // attempt to parse returned text (providers differ - adapt if needed)
  const raw = result?.text ?? JSON.stringify(result)
  try {
    const parsed = JSON.parse(raw.trim())
    // attach owner so frontend can insert easily if needed
    parsed.owner = userId
    return res.status(200).json(parsed)
  } catch (e) {
    return res.status(500).json({ error: 'invalid json from model', raw })
  }
}
