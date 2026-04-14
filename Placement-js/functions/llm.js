/* eslint-disable */
"use strict";

/**
 * LLM provider abstraction.
 * Uses native fetch (Node 20+) — no external SDK dependencies needed.
 *
 * Supported providers:
 *   openai    → OpenAI Chat Completions API
 *   gemini    → Google Generative AI (Gemini)
 *   anthropic → Anthropic Messages API
 *   groq      → Groq (OpenAI-compatible endpoint)
 *   mistral   → Mistral AI (OpenAI-compatible endpoint)
 */

// ─── Retry helper ────────────────────────────────────────────────────────────

async function withRetry(fn, attempts = 2, delayMs = 2000) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        console.warn(`[llm] attempt ${i + 1} failed: ${err.message}. Retrying…`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

// ─── JSON extraction ─────────────────────────────────────────────────────────

function extractJSON(text) {
  // 1. Direct parse
  try {
    return JSON.parse(text.trim());
  } catch {}

  // 2. Strip markdown fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {}
  }

  // 3. Find the outermost {...} block
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }

  throw new Error("Could not extract valid JSON from LLM response");
}

// ─── OpenAI-compatible (OpenAI, Groq, Mistral) ───────────────────────────────

const OPENAI_COMPAT_BASES = {
  openai: "https://api.openai.com",
  groq: "https://api.groq.com/openai",
  mistral: "https://api.mistral.ai",
};

async function callOpenAICompat(provider, apiKey, model, prompt) {
  const base = OPENAI_COMPAT_BASES[provider];
  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 4096,
  };

  // OpenAI JSON mode (works for gpt-4o, gpt-4o-mini, gpt-4-turbo)
  if (provider === "openai") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`${provider} API error (${res.status}): ${data.error?.message ?? JSON.stringify(data)}`);
  }
  return data.choices[0].message.content;
}

// ─── Google Gemini ────────────────────────────────────────────────────────────

async function callGemini(apiKey, model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Gemini API error (${res.status}): ${data.error?.message ?? JSON.stringify(data)}`);
  }
  return data.candidates[0].content.parts[0].text;
}

// ─── Anthropic Claude ─────────────────────────────────────────────────────────

async function callAnthropic(apiKey, model, prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok || data.type === "error") {
    throw new Error(`Anthropic API error (${res.status}): ${data.error?.message ?? JSON.stringify(data)}`);
  }
  return data.content[0].text;
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

/**
 * @param {{ provider: string, model: string, apiKey: string, prompt: string }} opts
 * @returns {Promise<object>} parsed JSON from LLM
 */
async function callLLM({ provider, model, apiKey, prompt }) {
  let rawText;

  await withRetry(async () => {
    switch (provider) {
      case "openai":
      case "groq":
      case "mistral":
        rawText = await callOpenAICompat(provider, apiKey, model, prompt);
        break;
      case "gemini":
        rawText = await callGemini(apiKey, model, prompt);
        break;
      case "anthropic":
        rawText = await callAnthropic(apiKey, model, prompt);
        break;
      default:
        throw new Error(`Unknown LLM provider: "${provider}"`);
    }
  });

  return extractJSON(rawText);
}

module.exports = { callLLM };
