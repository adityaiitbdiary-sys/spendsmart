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
      .limit(100);

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

  const totalAmount = expenses.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );
  const totalThisMonth = (() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return expenses
      .filter((e) => {
        const d = new Date(e.expense_date);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  })();

  return (
    <div
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: 0,
        background:
          "radial-gradient(circle at top left, #7b5cff 0, #0b1020 40%, #050712 100%)",
        color: "#f5f5ff",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1100,
          padding: "32px 20px 40px",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              SpendSmart <span style={{ fontSize: 16 }}>β</span>
            </div>
            <div style={{ fontSize: 14, opacity: 0.8 }}>
              Track your expenses and get AI-powered insights.
            </div>
          </div>
          <div>
            {!user ? (
              <button
                onClick={signIn}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: "none",
                  background: "#ffffff",
                  color: "#1b1538",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Sign in
              </button>
            ) : (
              <div
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.1)",
                  fontSize: 13,
                }}
              >
                Logged in as <b>{user.email}</b>
              </div>
            )}
          </div>
        </div>

        {user && (
          <>
            {/* Summary cards */}
            <div
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 24,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 180,
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05))",
                  borderRadius: 18,
                  padding: 16,
                  backdropFilter: "blur(14px)",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.8 }}>Total spent</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                  ₹{totalAmount.toFixed(0)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  Across {expenses.length} entries
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  minWidth: 180,
                  background:
                    "linear-gradient(135deg, rgba(115,255,215,0.16), rgba(73,205,255,0.12))",
                  borderRadius: 18,
                  padding: 16,
                  backdropFilter: "blur(14px)",
                  border: "1px solid rgba(115,255,215,0.35)",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  This month&apos;s spending
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                  ₹{totalThisMonth.toFixed(0)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  Based on your entries for this month
                </div>
              </div>
            </div>

            {/* Main grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
                gap: 20,
              }}
            >
              {/* Left side: add + list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Add expense card */}
                <div
                  style={{
                    background: "rgba(9, 11, 32, 0.9)",
                    borderRadius: 18,
                    padding: 16,
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
                  }}
                >
                  <div style={{ marginBottom: 8, fontWeight: 600 }}>
                    Add new expense
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 10 }}>
                    Type something like <i>&quot;Pizza 450&quot;</i> or{" "}
                    <i>&quot;Auto 120 office&quot;</i>. Gemini will understand it.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      style={{
                        flex: 1,
                        padding: 10,
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.18)",
                        background: "rgba(8,11,35,0.8)",
                        color: "white",
                        outline: "none",
                        fontSize: 14,
                      }}
                      placeholder="e.g. Pizza 450"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                    <button
                      onClick={addExpense}
                      disabled={loadingAdd}
                      style={{
                        padding: "8px 18px",
                        borderRadius: 999,
                        border: "none",
                        background:
                          "linear-gradient(135deg, #8f6bff, #b66cff)",
                        color: "white",
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: "pointer",
                        opacity: loadingAdd ? 0.7 : 1,
                      }}
                    >
                      {loadingAdd ? "Adding..." : "Add"}
                    </button>
                  </div>
                  {message && (
                    <p style={{ color: "#ff8080", marginTop: 8, fontSize: 13 }}>
                      {message}
                    </p>
                  )}
                </div>

                {/* Expenses list */}
                <div
                  style={{
                    background: "rgba(9, 11, 32, 0.9)",
                    borderRadius: 18,
                    padding: 16,
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
                    minHeight: 220,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>Recent expenses</div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>
                      Showing last {Math.min(expenses.length, 100)} entries
                    </div>
                  </div>
                  {expenses.length === 0 && (
                    <p style={{ fontSize: 13, opacity: 0.7 }}>
                      No expenses yet. Add your first one above.
                    </p>
                  )}
                  <div
                    style={{
                      maxHeight: 260,
                      overflowY: "auto",
                      marginTop: 4,
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                      }}
                    >
                      <thead>
                        <tr style={{ opacity: 0.6 }}>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "6px 4px",
                              fontWeight: 500,
                            }}
                          >
                            Date
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "6px 4px",
                              fontWeight: 500,
                            }}
                          >
                            Item
                          </th>
                          <th
                            style={{
                              textAlign: "left",
                              padding: "6px 4px",
                              fontWeight: 500,
                            }}
                          >
                            Category
                          </th>
                          <th
                            style={{
                              textAlign: "right",
                              padding: "6px 4px",
                              fontWeight: 500,
                            }}
                          >
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((e) => (
                          <tr key={e.id}>
                            <td style={{ padding: "4px 4px", opacity: 0.8 }}>
                              {e.expense_date}
                            </td>
                            <td style={{ padding: "4px 4px" }}>{e.item}</td>
                            <td
                              style={{
                                padding: "4px 4px",
                                fontSize: 12,
                                opacity: 0.85,
                              }}
                            >
                              {e.category}
                            </td>
                            <td
                              style={{
                                padding: "4px 4px",
                                textAlign: "right",
                                fontWeight: 600,
                              }}
                            >
                              ₹{Number(e.amount || 0).toFixed(0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right side: AI coach */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    background:
                      "linear-gradient(145deg, #7b5cff, #9a68ff, #b86dff)",
                    borderRadius: 22,
                    padding: 18,
                    boxShadow:
                      "0 20px 45px rgba(66, 47, 152, 0.8)",
                    minHeight: 220,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        opacity: 0.85,
                        marginBottom: 4,
                      }}
                    >
                      AI Financial Coach
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                      Personalized insights on your money
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      background: "rgba(255,255,255,0.12)",
                      borderRadius: 14,
                      padding: 12,
                      fontSize: 14,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {advice ||
                      "Click 'Get Advice' to see how your money is flowing this month, what looks healthy, and where you can save a bit more."}
                  </div>
                  <div style={{ marginTop: 10, textAlign: "right" }}>
                    <button
                      onClick={getAdvice}
                      disabled={loadingAdvice}
                      style={{
                        padding: "8px 18px",
                        borderRadius: 999,
                        border: "none",
                        background: "#ffffff",
                        color: "#6b4bff",
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: "pointer",
                        opacity: loadingAdvice ? 0.8 : 1,
                      }}
                    >
                      {loadingAdvice ? "Thinking..." : "Get Advice"}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(9, 11, 32, 0.9)",
                    borderRadius: 18,
                    padding: 14,
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 12,
                    opacity: 0.8,
                  }}
                >
                  Tip: Try logging one week of spending honestly. Then hit
                  &quot;Get Advice&quot; and treat it like a weekly money
                  retro with your AI co-pilot.
                </div>
              </div>
            </div>
          </>
        )}

        {!user && (
          <p style={{ marginTop: 24, fontSize: 13, opacity: 0.75 }}>
            Sign in to start tracking your expenses with AI.
          </p>
        )}
      </div>
    </div>
  );
}
