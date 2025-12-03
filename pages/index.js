import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnon);

export default function Home() {
  const [user, setUser] = useState(null);
  const [text, setText] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // When page loads, check if user is logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        setUser(data.session.user);
        loadExpenses();
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          loadExpenses();
        } else {
          setExpenses([]);
        }
      }
    );

    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  async function signIn() {
    const email = prompt(
      "Enter your email (the same email you added as user in Supabase):"
    );
    if (!email) return;

    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      alert(error.message);
    } else {
      alert("Magic link sent! Check your email and open the link.");
    }
  }

  async function loadExpenses() {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
      setMessage(error.message);
    } else {
      setExpenses(data || []);
    }
  }

  async function addExpense() {
    if (!user) {
      alert("Please sign in first.");
      return;
    }
    if (!text.trim()) return;

    setLoading(true);
    setMessage("");

    try {
      // 1) Ask backend to parse the text using Gemini
      const resp = await fetch("/api/parse-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const parsed = await resp.json();

      if (!resp.ok) {
        console.error(parsed);
        setMessage(parsed.error || "Parse failed");
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

      // 2) Save to Supabase
      const { error } = await supabase.from("expenses").insert([
        {
          owner: user.id,
          item: parsed.item,
          amount: parsed.amount,
          category: parsed.category,
          expense_date: today,
        },
      ]);

      if (error) {
        console.error(error);
        setMessage(error.message);
      } else {
        setText("");
        await loadExpenses();
      }
    } catch (e) {
      console.error(e);
      setMessage(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>SpendSmart (Test Version)</h1>

      {!user && (
        <div>
          <p>You are not signed in.</p>
          <button onClick={signIn}>Sign in with magic link</button>
        </div>
      )}

      {user && (
        <div>
          <p>Signed in as {user.email}</p>

          <div style={{ marginTop: 16 }}>
            <input
              style={{ padding: 8, minWidth: 260 }}
              placeholder="e.g. Pizza 450"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              onClick={addExpense}
              disabled={loading}
              style={{ marginLeft: 8 }}
            >
              {loading ? "Adding..." : "Add expense"}
            </button>
          </div>

          {message && (
            <p style={{ color: "red", marginTop: 8 }}>{message}</p>
          )}

          <div style={{ marginTop: 24 }}>
            <h3>Your recent expenses</h3>
            {expenses.length === 0 && <p>No expenses yet.</p>}
            <ul>
              {expenses.map((e) => (
                <li key={e.id}>
                  {e.expense_date} — {e.item} — {e.category} — ₹{e.amount}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
