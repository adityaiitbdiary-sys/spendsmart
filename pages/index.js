import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function Home() {
  const [user, setUser] = useState(null)
  const [text, setText] = useState('')
  const [expenses, setExpenses] = useState([])
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(r => {
      setUser(r.data.session?.user ?? null)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.access_token) fetchExpenses(session.access_token)
    })
  }, [])

  async function signIn() {
    const email = prompt('Enter your email (use your single allowed email).')
    if (!email) return
    await supabase.auth.signInWithOtp({ email })
    alert('Check your email for a magic link to sign in.')
  }

  async function fetchExpenses(token) {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
      .limit(100)
    setExpenses(data ?? [])
  }

  async function addExpenseFromText() {
    if (!text.trim()) return
    setLoading(true)
    const session = (await supabase.auth.getSession()).data.session
    if (!session) { alert('Please sign in first'); setLoading(false); return }
    // send to serverless parser
    const r = await fetch('/api/parse-expense', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        'x-app-secret': process.env.NEXT_PUBLIC_APP_CLIENT_SECRET || ''
      },
      body: JSON.stringify({ text })
    })
    const parsed = await r.json()
    if (parsed?.error) { alert('Parse error: ' + parsed.error); setLoading(false); return }
    // insert into Supabase
    const insert = await supabase.from('expenses').insert([{
      owner: parsed.owner || session.user.id,
      item: parsed.item || parsed.name || text,
      amount: parsed.amount,
      category: parsed.category || 'Other',
      expense_date: parsed.expense_date || new Date().toISOString().slice(0,10)
    }])
    if (insert.error) alert('DB insert error: ' + insert.error.message)
    else {
      setText('')
      fetchExpenses()
    }
    setLoading(false)
  }

  async function getAnalysis() {
    setLoading(true)
    const session = (await supabase.auth.getSession()).data.session
    if (!session) { alert('Please sign in'); setLoading(false); return }
    const r = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        'x-app-secret': process.env.NEXT_PUBLIC_APP_CLIENT_SECRET || ''
      },
      body: JSON.stringify({ })
    })
    const j = await r.json()
    setAnalysis(j.analysis || j.error || '')
    setLoading(false)
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>SpendSmart</h1>
      {!user ? (
        <div>
          <p>You are not signed in.</p>
          <button onClick={signIn}>Sign in (magic link)</button>
        </div>
      ) : (
        <div>
          <p>Signed in as {user.email}</p>
          <div style={{ marginTop: 12 }}>
            <input value={text} onChange={e=>setText(e.target.value)} placeholder="e.g., Pizza 450" style={{width:360}}/>
            <button onClick={addExpenseFromText} disabled={loading} style={{marginLeft:8}}>Add</button>
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={getAnalysis} disabled={loading}>Get Advice</button>
          </div>
          <div style={{ marginTop: 16 }}>
            <h3>Your expenses</h3>
            <ul>
              {expenses.map(e=>(
                <li key={e.id}>{e.expense_date} — {e.item} — {e.category} — ₹{e.amount}</li>
              ))}
            </ul>
          </div>
          <div style={{ marginTop: 16 }}>
            <h3>AI Advice</h3>
            <div style={{ whiteSpace: 'pre-wrap', background:'#f3f3ff', padding:12, borderRadius:8 }}>{analysis || 'No advice yet'}</div>
          </div>
        </div>
      )}
    </div>
  )
}
