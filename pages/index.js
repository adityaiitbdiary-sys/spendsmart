import Head from "next/head";
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
        if (session?.user) loadExpenses();
        else setExpenses([]);
      }
    );

    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  async function signIn() {
    const email = prompt("Enter your email (same as Supabase user):");
    if (!email) return;

    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) alert(error.message);
    else alert("Magic link sent! Check your inbox.");
  }

  async function loadExpenses() {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .limit(100);

    if (error) setMessage(error.message);
    else setExpenses(data || []);
  }

  async function addExpense() {
    if (!user) return alert("Sign in first.");
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
        setMessage(parsed.error || "Parsing failed");
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

      if (error) setMessage(error.message);
      else {
        setText("");
        loadExpenses();
      }
    } catch (e) {
      setMessage(String(e));
    }
    setLoadingAdd(false);
  }

  async function getAdvice() {
    if (!user) return alert("Sign in first.");
    if (expenses.length === 0)
      return setAdvice("Add expenses first so I can analyze 🙂");

    setLoadingAdvice(true);

    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses }),
      });

      const data = await resp.json();
      if (!resp.ok) setAdvice(data.error || "Could not analyze.");
      else setAdvice(data.analysis);
    } catch (e) {
      setAdvice(String(e));
    }

    setLoadingAdvice(false);
  }

  const totalAmount = expenses.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

  const totalThisMonth = (() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return expenses
      .filter((e) => {
        const d = new Date(e.expense_date);
        return d.getMonth() === m && d.getFullYear() === y;
      })
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  })();

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Clash+Display:wght@500;600;700&family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top left, #7b5cff 0, #0b1020 40%, #050712 100%)",
          color: "#f5f5ff",
          display: "flex",
          justifyContent: "center",
          padding: "32px 20px",
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        <div style={{ width: "100%", maxWidth: 1100 }}>
          {/* TOP BAR */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 24,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  fontFamily: "'Clash Display', sans-serif",
                }}
              >
                SpendSmart{" "}
                <span
                  style={{
                    fontSize: 20,
                    fontFamily: "'Clash Display', sans-serif",
                  }}
                >
                  β
                </span>
              </div>
              <div style={{ opacity: 0.8, marginTop: 4 }}>
                Track your expenses with AI insights.
              </div>
            </div>

            {!user ? (
              <button
                onClick={signIn}
                style={{
                  background: "#fff",
                  padding: "8px 16px",
                  borderRadius: 20,
                  color: "#1b1538",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                }}
              >
                Sign in
              </button>
            ) : (
              <div
                style={{
                  padding: "8px 16px",
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 20,
                }}
              >
                Logged in as <b>{user.email}</b>
              </div>
            )}
          </div>

          {user && (
            <>
              {/* SUMMARY CARDS */}
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.1)",
                    padding: 16,
                    borderRadius: 18,
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div style={{ opacity: 0.8, fontSize: 14 }}>
                    Total spent
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700 }}>
                    ₹{totalAmount}
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.1)",
                    padding: 16,
                    borderRadius: 18,
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div style={{ opacity: 0.8, fontSize: 14 }}>
                    This month’s spending
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700 }}>
                    ₹{totalThisMonth}
                  </div>
                </div>
              </div>

              {/* MAIN GRID */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.1fr 1fr",
                  gap: 20,
                }}
              >
                {/* LEFT SIDE */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {/* ADD EXPENSE */}
                  <div
                    style={{
                      background: "rgba(9,11,32,0.9)",
                      padding: 16,
                      borderRadius: 18,
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                      Add new expense
                    </div>

                    <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 10 }}>
                      Type: <i>"Pizza 450"</i> or <i>"Auto 120 office"</i>.
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        style={{
                          flex: 1,
                          padding: 10,
                          borderRadius: 999,
                          border: "1px solid rgba(255,255,255,0.2)",
                          background: "rgba(15,18,45,0.9)",
                          color: "white",
                        }}
                        placeholder="e.g. Pizza 450"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                      />
                      <button
                        onClick={addExpense}
                        disabled={loadingAdd}
                        style={{
                          background:
                            "linear-gradient(135deg, #8f6bff, #b06cff)",
                          color: "white",
                          padding: "8px 20px",
                          borderRadius: 999,
                          border: "none",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {loadingAdd ? "Adding…" : "Add"}
                      </button>
                    </div>

                    {message && (
                      <p style={{ color: "salmon", marginTop: 8 }}>{message}</p>
                    )}
                  </div>

                  {/* EXPENSE LIST */}
                  <div
                    style={{
                      background: "rgba(9,11,32,0.9)",
                      padding: 16,
                      borderRadius: 18,
                      border: "1px solid rgba(255,255,255,0.1)",
                      minHeight: 220,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: 10,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>Recent expenses</span>
                      <span style={{ opacity: 0.6, fontSize: 12 }}>
                        Showing {expenses.length} entries
                      </span>
                    </div>

                    {expenses.length === 0 && (
                      <p style={{ opacity: 0.7 }}>No expenses yet.</p>
                    )}

                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                      <table style={{ width: "100%", fontSize: 14 }}>
                        <thead>
                          <tr style={{ opacity: 0.7 }}>
                            <th align="left">Date</th>
                            <th align="left">Item</th>
                            <th align="left">Category</th>
                            <th align="right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expenses.map((e) => (
                            <tr key={e.id}>
                              <td>{e.expense_date}</td>
                              <td>{e.item}</td>
                              <td>{e.category}</td>
                              <td align="right">₹{e.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* RIGHT SIDE — AI COACH */}
                <div>
                  <div
                    style={{
                      background:
                        "linear-gradient(135deg, #8f6bff, #a56aff, #c46dff)",
                      padding: 20,
                      borderRadius: 22,
                      minHeight: 240,
                      color: "white",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: "0 20px 40px rgba(90,50,160,0.4)",
                    }}
                  >
                    <div>
                      <div style={{ opacity: 0.8, fontSize: 14 }}>
                        AI Financial Coach
                      </div>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          marginTop: 4,
                        }}
                      >
                        Personalized insights on your money
                      </div>
                    </div>

                    <div
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        padding: 14,
                        borderRadius: 14,
                        marginTop: 12,
                        fontSize: 14,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {advice ||
                        "Click 'Get Advice' to understand your spending patterns and where you can save more."}
                    </div>

                    <div style={{ textAlign: "right", marginTop: 16 }}>
                      <button
                        onClick={getAdvice}
                        disabled={loadingAdvice}
                        style={{
                          background: "white",
                          color: "#6b4bff",
                          padding: "8px 18px",
                          borderRadius: 999,
                          border: "none",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {loadingAdvice ? "Thinking…" : "Get Advice"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
