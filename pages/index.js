import Head from "next/head";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnon);

const CATEGORY_COLORS = [
  "#ff9f40",
  "#4bc0c0",
  "#ff6384",
  "#36a2eb",
  "#9966ff",
  "#ffcd56",
  "#7bdcb5",
  "#f78da7",
];

export default function Home() {
  const [user, setUser] = useState(null);
  const [text, setText] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [message, setMessage] = useState("");
  const [advice, setAdvice] = useState("");
  const [range, setRange] = useState("all"); // "today" | "month" | "all"

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
      .limit(200);

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

  // ---------- totals + filters ----------
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const expensesThisMonth = expenses.filter((e) => {
    const d = new Date(e.expense_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const expensesToday = expenses.filter((e) => e.expense_date === todayStr);

  let filteredExpenses = expenses;
  if (range === "today") filteredExpenses = expensesToday;
  else if (range === "month") filteredExpenses = expensesThisMonth;

  const totalFiltered = filteredExpenses.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

  const totalThisMonth = expensesThisMonth.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

  // ---------- category donut data (for current filter) ----------
  const categoryTotalsMap = filteredExpenses.reduce((acc, e) => {
    const cat = e.category || "Other";
    const amt = Number(e.amount || 0);
    acc[cat] = (acc[cat] || 0) + amt;
    return acc;
  }, {});

  const categoryEntries = Object.entries(categoryTotalsMap).sort(
    (a, b) => b[1] - a[1]
  );
  const chartTotal = categoryEntries.reduce((sum, [, v]) => sum + v, 0);

  let currentAngle = 0;
  const slices = categoryEntries.map(([name, value], index) => {
    const angle = chartTotal > 0 ? (value / chartTotal) * 360 : 0;
    const start = currentAngle;
    const end = currentAngle + angle;
    currentAngle = end;
    return {
      name,
      value,
      start,
      end,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    };
  });

  const chartGradient =
    chartTotal > 0
      ? `conic-gradient(${slices
          .map(
            (s) =>
              `${s.color} ${s.start.toFixed(1)}deg ${s.end.toFixed(1)}deg`
          )
          .join(", ")})`
      : "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15), rgba(0,0,0,0.2))";

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
          href="https://fonts.googleapis.com/css2?family=Satisfy&family=Poppins:wght@300;400;500;600;700&display=swap"
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
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 400,
                  letterSpacing: "0.5px",
                  fontFamily: "'Satisfy', cursive",
                  lineHeight: 1,
                }}
              >
                SpendSmart{" "}
                <span
                  style={{
                    fontSize: 26,
                    fontFamily: "'Satisfy', cursive",
                  }}
                >
                  β
                </span>
              </div>
              <div style={{ opacity: 0.8, marginTop: 6, fontSize: 14 }}>
                Track your expenses and get AI-powered insights.
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
                  fontSize: 13,
                }}
              >
                Logged in as <b>{user.email}</b>
              </div>
            )}
          </div>

          {user && (
            <>
              {/* FILTER TABS */}
              <div
                style={{
                  display: "inline-flex",
                  padding: 4,
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.35)",
                  marginBottom: 16,
                  gap: 4,
                }}
              >
                {[
                  { id: "today", label: "Today" },
                  { id: "month", label: "This Month" },
                  { id: "all", label: "All" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setRange(opt.id)}
                    style={{
                      borderRadius: 999,
                      border: "none",
                      padding: "6px 14px",
                      fontSize: 13,
                      cursor: "pointer",
                      background:
                        range === opt.id
                          ? "rgba(255,255,255,0.9)"
                          : "transparent",
                      color: range === opt.id ? "#1b1538" : "#f5f5ff",
                      fontWeight: range === opt.id ? 600 : 400,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* SUMMARY CARDS */}
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
                    minWidth: 220,
                    background: "rgba(255,255,255,0.1)",
                    padding: 16,
                    borderRadius: 18,
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div style={{ opacity: 0.8, fontSize: 14 }}>
                    Total spent (
                    {range === "today"
                      ? "today"
                      : range === "month"
                      ? "this month"
                      : "all time"}
                    )
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700 }}>
                    ₹{totalFiltered.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                    {range === "today"
                      ? `Today • ${filteredExpenses.length} entries`
                      : range === "month"
                      ? `This month • ${filteredExpenses.length} entries`
                      : `All time • ${filteredExpenses.length} entries`}
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    minWidth: 220,
                    background: "rgba(255,255,255,0.1)",
                    padding: 16,
                    borderRadius: 18,
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div style={{ opacity: 0.8, fontSize: 14 }}>
                    This month&apos;s spending
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700 }}>
                    ₹{totalThisMonth.toFixed(0)}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                    Based on your entries for this month
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
                      Type <i>"Pizza 450"</i> or <i>"Auto 120 office"</i>. Gemini
                      will understand it.
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
                          outline: "none",
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
                          opacity: loadingAdd ? 0.8 : 1,
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
                        fontSize: 14,
                      }}
                    >
                      <span>Recent expenses</span>
                      <span style={{ opacity: 0.6, fontSize: 12 }}>
                        Showing {filteredExpenses.length} entries
                      </span>
                    </div>

                    {filteredExpenses.length === 0 && (
                      <p style={{ opacity: 0.7, fontSize: 13 }}>
                        No expenses for this range.
                      </p>
                    )}

                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          fontSize: 13,
                          borderCollapse: "collapse",
                        }}
                      >
                        <thead>
                          <tr style={{ opacity: 0.7 }}>
                            <th align="left" style={{ paddingBottom: 6 }}>
                              Date
                            </th>
                            <th align="left" style={{ paddingBottom: 6 }}>
                              Item
                            </th>
                            <th align="left" style={{ paddingBottom: 6 }}>
                              Category
                            </th>
                            <th align="right" style={{ paddingBottom: 6 }}>
                              Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredExpenses.map((e) => (
                            <tr key={e.id}>
                              <td style={{ padding: "4px 0" }}>
                                {e.expense_date}
                              </td>
                              <td style={{ padding: "4px 0" }}>{e.item}</td>
                              <td style={{ padding: "4px 0" }}>{e.category}</td>
                              <td
                                align="right"
                                style={{ padding: "4px 0", fontWeight: 600 }}
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

                {/* RIGHT SIDE — AI COACH + DONUT */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* AI COACH CARD */}
                  <div
                    style={{
                      background:
                        "linear-gradient(135deg, #8f6bff, #a56aff, #c46dff)",
                      padding: 20,
                      borderRadius: 22,
                      minHeight: 230,
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
                          opacity: loadingAdvice ? 0.8 : 1,
                        }}
                      >
                        {loadingAdvice ? "Thinking…" : "Get Advice"}
                      </button>
                    </div>
                  </div>

                  {/* DONUT CHART CARD */}
                  <div
                    style={{
                      background: "rgba(9,11,32,0.9)",
                      padding: 16,
                      borderRadius: 18,
                      border: "1px solid rgba(255,255,255,0.1)",
                      display: "flex",
                      gap: 16,
                      alignItems: "center",
                      minHeight: 190,
                    }}
                  >
                    <div style={{ flex: 0, position: "relative" }}>
                      <div
                        style={{
                          width: 120,
                          height: 120,
                          borderRadius: "50%",
                          background: chartGradient,
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            inset: 20,
                            borderRadius: "50%",
                            background: "rgba(9,11,32,1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            opacity: 0.8,
                            textAlign: "center",
                            padding: 4,
                          }}
                        >
                          {chartTotal > 0
                            ? "Categories"
                            : "No data for\nthis range"}
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          marginBottom: 4,
                          fontSize: 14,
                        }}
                      >
                        Categories ({range === "today"
                          ? "today"
                          : range === "month"
                          ? "this month"
                          : "all time"}
                        )
                      </div>
                      {categoryEntries.length === 0 ? (
                        <p style={{ fontSize: 12, opacity: 0.7 }}>
                          Add some expenses to see category-wise breakdown.
                        </p>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            fontSize: 12,
                          }}
                        >
                          {categoryEntries.slice(0, 5).map(([name, value], i) => (
                            <div
                              key={name}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center" }}>
                                <span
                                  style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: "50%",
                                    backgroundColor:
                                      CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                                    marginRight: 6,
                                  }}
                                />
                                <span>{name}</span>
                              </div>
                              <span style={{ fontWeight: 600 }}>
                                ₹{value.toFixed(0)}
                              </span>
                            </div>
                          ))}
                          {categoryEntries.length > 5 && (
                            <div style={{ fontSize: 11, opacity: 0.7 }}>
                              + {categoryEntries.length - 5} more categories
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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
    </>
  );
}
