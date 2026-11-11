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

## 2. Auto-combine ANY two already-made words on your computer

The local generator now has a **browser dashboard**, running at **http://127.0.0.1:38417** on your own PC.

It downloads the complete **existing recipe graph**, including the ingredient pair **and its result**, from Infinite Race: the built-in, community and shared saved recipes. It calculates the **fewest known crafting operations needed to reach each word from Water, Fire, Wind and Earth**. It then tries *unrecorded* ingredient pairs in ascending order of their **combined crafting cost**, randomising within equal-difficulty groups. That means beginner-level ingredients come first, not random late-game nonsense like Dingleflower + PeanutButterHair.

Words with **no known path from the four starter elements are excluded**, rather than pretending they are easy. When a new recipe is made, its resulting word gets a crafting cost and may unlock more reachable words through existing recipes. These newly reachable recipes are ranked automatically. Every valid result is saved locally and used in future attempts.

The dashboard offers a difficulty limit: **Very easy (4 crafts), Common (8 crafts, default), More variety (12), Deep (20), or No limit**. The number means the combined cost to reach *both input words*; a new combination itself adds one more craft. You can raise the limit whenever the easier pairs have been explored.

The UI displays **new combinations this session**, **total saved locally**, **known recorded pairs**, **words reachable from the starters**, and crafting costs in its recent-discovery feed.

### Quick Windows setup

1. Install [Node.js LTS](https://nodejs.org/) and [Ollama](https://ollama.com/download).
2. Run `ollama pull gemma3:4b` once to download the local model.
3. Download the Infinite Race project to any Windows PC and double-click **`tools/run-local-explorer.cmd`**.
4. A browser opens to **http://127.0.0.1:38417**. Click **Start auto-combining**.

For macOS or Linux use `node tools/local-recipe-dashboard.mjs` and open the same localhost URL. Each PC needs Node.js, Ollama, and the model installed, but **no Gemini API account or keys**. Model inference runs entirely on that computer; the catalog is downloaded from the public Infinite Race server. Once downloaded it's cached as `local-recipe-catalog-cache.json` for offline reuse.

Every new result is appended immediately to `local-recipes.jsonl`; restarting doesn't lose it. Rejected model results are not stored. If you reload the server's catalog, the generator sees recipes other people have added too. The default model is Gemma 3 4B, with 1B and 12B options. More capable models generally need more memory.

### Uploading from any computer

In the dashboard enter the upload password and click **Upload saved combinations**. Set the **same value** for `RECIPE_IMPORT_TOKEN` in your Infinite Race Render web service's **Environment** section first.

You asked to use the password `dingledongle`. If you choose that value in Render, typing it into the dashboard will work. **It isn't hardcoded in the repository or saved by the dashboard.** Since it's short and has been shared in a conversation, a longer randomly generated password is safer for a public website.

Uploads are sent over HTTPS in batches of 50 and require the persistent Postgres database (`DATABASE_URL`) to be configured. Already known pairs are skipped, and the server preserves whoever first recorded a combination.

If you'd rather use the command-line uploader, it still works with `RECIPE_IMPORT_TOKEN` as a terminal environment variable:

```cmd
set RECIPE_IMPORT_TOKEN=your-password-matching-render
node tools\upload-local-recipes.mjs --server=https://infinite-race.onrender.com --file=local-recipes.jsonl
```

### Performance and limitations

The full catalog includes hundreds of thousands of recipes **with their outputs**, so initial download and shortest-path calculation may take a little time. The live counter increases only after a valid recipe is written to disk. Results produced by local AI are not guaranteed to be logical or high-quality; consider checking them before uploading large batches. The local computer doesn't have to stay online after uploading; newly uploaded recipes are stored on the shared website database.

## 3. Optional: disable cloud AI crafting on the website

Add `NO_AI_CRAFTING=1` to Render to make the *website* use only recorded recipes. New locally generated recipes can still be uploaded. Themed bingo may still use Gemini for categories.

## 4. Safety and longevity

- Recipes are treated as order-independent: `Water + Fire` equals `Fire + Water`.
- Duplicate attempts return the saved authoritative result.
- A unique database index enforces first-writer-wins, including across simultaneous requests.
- The server does not expose database credentials or upload tokens to visitors.
- Browser-generated fallback recipes are still subject to the game's quality and rate-limit checks; publicly shared user-generated content may still need moderation if the site grows.
- Since any player can add discoveries through normal gameplay, keep database backups and monitor storage use.

Official documentation: https://ai.google.dev/gemma/docs/integrations/ollama and https://render.com/docs/disks
