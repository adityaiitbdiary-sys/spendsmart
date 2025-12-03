// pages/api/analyze.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed, use POST" });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: "Missing Gemini API key" });
  }

  const { expenses } = req.body || {};
  if (!Array.isArray(expenses) || expenses.length === 0) {
    return res.status(400).json({ error: "expenses array is required" });
  }

  const prompt = `
You are a friendly personal finance coach.

User's monthly expenses (as JSON array):
${JSON.stringify(expenses)}

Write a short analysis (max ~150 words) with:
1. Spending overview (which categories are high/low).
2. 1–2 positive compliments.
3. 2 actionable tips to improve or save money.

Use simple, conversational English. No bullet points, just paragraphs.
  `;

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=" +
        GEMINI_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await r.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      return res.status(500).json({
        error: "Gemini returned no text",
        raw: data,
      });
    }

    return res.status(200).json({ analysis: text.trim() });
  } catch (err) {
    return res.status(500).json({
      error: "Request to Gemini failed",
      details: String(err),
    });
  }
}
