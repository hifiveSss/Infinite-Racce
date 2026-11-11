# Infinite Race: Shared discoveries + local Gemma generator

## 1. Make new recipes permanent for everyone

The website now supports one authoritative **PostgreSQL** database:

1. Create a persistent PostgreSQL database (Render Postgres, Supabase Postgres or another service).
2. In your **Infinite Race Render web service → Environment**, add **`DATABASE_URL`** containing the Postgres connection string. Keep it private.
3. Save and redeploy/restart your web service.
4. Visit [the safe status page](https://infinite-race.onrender.com/api/status) and check:
   - `databaseConfigured: true`
   - `databaseReady: true`
   - `sharedRecipes`: number of permanently saved new pairs
   - `recordedFirstWords`: count of claimed first-word discoveries

The server creates its own `infinite_race_recipes` and `infinite_race_first_words` tables.

**First discovery:** When someone combines a previously unknown pair, one result is permanently written to the database. The first person who makes a completely new *word*, rather than merely an unseen pairing of existing words, receives a gold **✨ FIRST DISCOVERY!** caption directly beneath the resulting piece. Their username is stored with the discovery. Repeating a saved pair later returns its **exact same word and emoji**. Two concurrent players cannot overwrite each other's results.

The baseline 26,906 built-in recipes and the community dataset are already recorded, so they never count as first discoveries. A server successfully saving a new word claims it once globally, even if other pairs later create the same word.

**Without `DATABASE_URL`**, Infinite Race remains playable with its prebuilt and community recipes and Gemini/local fallbacks, but newly generated recipes are not guaranteed to survive Render restarts and don't receive a global-first badge. This distinction is intentional: Render's default filesystem is temporary.

If your provider requires TLS, add `DATABASE_SSL=require`. Never put a database connection string in source code or browser JavaScript.

**Important about Render storage:** A free Render Postgres database currently expires after 30 days. Use a persistent, adequately backed-up database if you want discoveries permanently saved for years. Render persistent disks are another option for files but are available only for paid services; this implementation uses PostgreSQL so players can also share across multiple server instances.

## 2. Run Google Gemma locally — no Gemini API required

**Gemini is a cloud service. Gemma is Google's downloadable model family.** Use [Ollama](https://ollama.com/download) to run Gemma entirely on your computer.

1. Install **Node.js LTS** from https://nodejs.org/.
2. Install Ollama from https://ollama.com/download.
3. In Windows Terminal / Command Prompt run:

   ```cmd
   ollama pull gemma3:4b
   ```

4. In the downloaded Infinite Race project folder, double-click **`tools\run-local-explorer.cmd`**.

It explores local combinations like an automated player. Starting with **Water, Fire, Wind, Earth**, it tries pairs, asks your **local** Gemma model for a creative result, adds useful new words to its bank and starts pairing those too. It appends each useful result to `local-recipes.jsonl` so stopping with Ctrl+C or restarting doesn't lose the progress already saved. It sends **no prompts, answers or API keys** to Google.

The default script generates up to **300 more combinations per run**. For a longer run:

```cmd
node tools\local-recipe-explorer.mjs --model=gemma3:4b --max=2000
```

**Hardware:** Gemma 3 4B is about a 3.3 GB model download and may run on your 8 GB RX 6600 if Ollama supports the GPU/drivers, otherwise it falls back to CPU and will be slower. You can try `gemma3:1b` if the 4B model is too slow, though the combinations will usually be less clever. The very first `ollama pull` needs internet access; subsequent crafting uses only Ollama on `localhost:11434`.

**Note:** This is an offline model, not a substitute for the official Neal.fun server, and generated combinations are not guaranteed to be factual or funny. Test a batch of results before publishing thousands of them.

## 3. Import your offline results into the public shared database

After setting up the database, add another private Render variable:

```text
RECIPE_IMPORT_TOKEN=<a long random secret, at least 20 characters>
```

Generate your own secret (e.g. via a password manager). Don't commit it to GitHub.

Then, **in your own Windows terminal** (this `set` only lasts for that terminal):

```cmd
set RECIPE_IMPORT_TOKEN=your-secret-that-matches-render
node tools\upload-local-recipes.mjs --server=https://infinite-race.onrender.com --file=local-recipes.jsonl
```

The uploader sends batches of 50 to an authenticated `/api/recipes/import` endpoint. Already known pairs are skipped, and the first saved result is retained. Uploaded words become premade public recipes but do not falsely award a *player* first-discovery badge.

All local generation works without the public website. **Uploading** is optional and, naturally, needs an internet connection to your own server. Keep the uploader token secret; it can add permanent recipes.

## Optional: Turn off all cloud AI crafting on Render

If you want **the website** to only use recorded/prebuilt recipes, add \`NO_AI_CRAFTING=1\` to Render. This disables Gemini for **crafting**, so unknown pairs won't generate new results on the server. Your local PC explorer can still grow a much larger set without any Gemini API calls; import the accepted JSONL recipes when you want others to use them. Bingo category generation still uses Gemini.


## 4. Safety and longevity

- Recipes are treated as order-independent: `Water + Fire` equals `Fire + Water`.
- Duplicate attempts return the saved authoritative result.
- A unique database index enforces first-writer-wins, including across simultaneous requests.
- The server does not expose database credentials or upload tokens to visitors.
- Browser-generated fallback recipes are still subject to the game's quality and rate-limit checks; publicly shared user-generated content may still need moderation if the site grows.
- Since any player can add discoveries through normal gameplay, keep database backups and monitor storage use.

Official documentation: https://ai.google.dev/gemma/docs/integrations/ollama and https://render.com/docs/disks
