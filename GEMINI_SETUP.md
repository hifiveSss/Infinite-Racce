# Gemini-only setup for Infinite Race

Infinite Race now uses **Gemini only** for cloud crafting and themed bingo. Groq is not called and its old cloud-generated recipe cache is excluded by a new cache version.

## Render environment variables

Add up to five Gemini keys in **Render → Infinite Race → Environment**, one per value:

```text
GEMINI_API_KEY_1=YOUR_FIRST_KEY
GEMINI_API_KEY_2=YOUR_SECOND_KEY
GEMINI_API_KEY_3=YOUR_THIRD_KEY
GEMINI_API_KEY_4=YOUR_FOURTH_KEY
GEMINI_API_KEY_5=YOUR_FIFTH_KEY
GEMINI_MODEL=gemini-3.5-flash
```

Only use keys you own or are authorized to use, in compliance with Google's policies. Never commit actual keys to GitHub.

**Compatibility:** The old `GEMINI_API_KEY` variable is used as slot 1 only when `GEMINI_API_KEY_1` is absent. Identical key strings are deduplicated.

## Routing

- First check premade and previously generated recipes.
- For unknown combinations and full themed bingo boards, select an available configured Gemini key in round-robin order.
- On an error or quota response, briefly cool down that individual key and try another available one.
- If every key fails, crafting falls back to the optional browser-local model. Themed bingo reports an error instead of showing a partial board.
- Category generation still validates the requested exact 9, 16 or 25 squares (minus any custom squares).
- The `/api/status` response exposes `geminiKeysConfigured` (a number), without disclosing keys.
- Previous cloud-generated combinations were not provider-tagged. The saved recipe cache therefore uses a fresh `cacheVersion: 2`, keeping built-in recipes but excluding unlabelled old remote results (including Groq).

**Important:** Gemini quotas are assessed per Google Cloud project, not per API key. Five keys from the same project share quotas. Separate projects and accounts must follow Google's policies and still have their own applicable limits.

Documentation: https://ai.google.dev/gemini-api/docs/rate-limits
