import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnon);

export default function Home() {
  const [user, setUser] = useState(null);
  const [text, setText] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [message, setMessage] = useState("");
  const [advice, setAdvice] = useState("");

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

    setLoadingAdd(true);
    setMessage("");

    try {
      const resp = await fetch("/api/parse-expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const parsed = await resp.json();

      if (!resp.ok) {
        console.error(parsed);
        setMessage(parsed.error || "Parse failed");
        setLoadingAdd(false);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

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
      setLoadingAdd(false);
    }
  }

  async function getAdvice() {
    if (!user) {
      alert("Please sign in first.");
      return;
    }
    if (expenses.length === 0) {
      setAdvice("Add a few expenses first so I have something to analyze 🙂");
      return;
    }

    setLoadingAdvice(true);
    setMessage("");

    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        console.error(data);
        setAdvice(data.error || "Could not generate advice.");
      } else {
        setAdvice(data.analysis);
      }
    } catch (e) {
      console.error(e);
      setAdvice(String(e));
    } finally {
      setLoadingAdvice(false);
    }
  }

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        background: "#f5f6ff",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>💸 SpendSmart (Test Version)</h1>

      {!user && (
        <div
          style={{
            padding: 16,
            background: "white",
            borderRadius: 12,
            maxWidth: 420,
          }}
        >
          <p>You are not signed in.</p>
          <button onClick={signIn}>Sign in with magic link</button>
        </div>
      )}

      {user && (
        <>
          <p>Signed in as {user.email}</p>

          <div
            style={{
              marginTop: 16,
              padding: 16,
              background: "white",
              borderRadius: 16,
              maxWidth: 600,
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            }}
          >
            <h3>Add expense</h3>
            <input
              style={{
                padding: 8,
                minWidth: 260,
                borderRadius: 8,
                border: "1px solid #ccc",
              }}
              placeholder="e.g. Pizza 450"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              onClick={addExpense}
              disabled={loadingAdd}
              style={{ marginLeft: 8 }}
            >
              {loadingAdd ? "Adding..." : "Add expense"}
            </button>
            {message && (
              <p style={{ color: "red", marginTop: 8 }}>{message}</p>
            )}
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <h3>Your recent expenses</h3>
              <div
                style={{
                  background: "white",
                  padding: 16,
                  borderRadius: 16,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                  maxHeight: 300,
                  overflowY: "auto",
                }}
              >
                {expenses.length === 0 && <p>No expenses yet.</p>}
                <ul>
                  {expenses.map((e) => (
                    <li key={e.id}>
                      {e.expense_date} — {e.item} — {e.category} — ₹
                      {e.amount}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <h3>AI Financial Coach</h3>
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #7b5cff, #8f6bff, #b06cff)",
                  color: "white",
                  padding: 16,
                  borderRadius: 16,
                  boxShadow: "0 8px 18px rgba(80,50,160,0.35)",
                  minHeight: 180,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ marginBottom: 8, fontWeight: 600 }}>
                  AI Financial Coach
                </div>
                <div
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 14,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {advice ||
                    "Click 'Get Advice' to see a personalized breakdown of your spending and tips to improve."}
                </div>
                <button
                  onClick={getAdvice}
                  disabled={loadingAdvice}
                  style={{
                    marginTop: 12,
                    alignSelf: "flex-end",
                    background: "white",
                    color: "#6a4bff",
                    borderRadius: 999,
                    padding: "6px 14px",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {loadingAdvice ? "Thinking..." : "Get Advice"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
