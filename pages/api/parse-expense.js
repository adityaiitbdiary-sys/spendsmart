// pages/api/parse-expense.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed, use POST" });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: "Missing Gemini API key" });
  }

  const { text } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: "missing text field in body" });
  }

  const prompt = `
Extract expense details from text and return ONLY JSON.
Fields: item (string), amount (number), category (string).
Text: "${text}"
Example:
{"item":"Pizza","amount":450,"category":"Food"}
Now return JSON only.
`;

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" +
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
    // Try to read the text from Gemini's response
    const modelText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    try {
      const parsed = JSON.parse(modelText.trim());
      return res.status(200).json(parsed);
    } catch (e) {
      // Gemini didn't give valid JSON, return raw text for debugging
      return res.status(500).json({
        error: "Model did not return valid JSON",
        modelText,
      });
    }
  } catch (err) {
    return res.status(500).json({ error: "Request to Gemini failed", details: String(err) });
  }
}
