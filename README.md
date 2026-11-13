# The Game Room — Five multiplayer browser games


## Neon Strike: original third-person arcade football

**Play:** `https://infinite-race.onrender.com/strike.html`.

The game takes inspiration from the *genre* of fast, behind-the-player football games, including the action-focused perspective of Sloclap's Rematch, but is **an original small-scale browser game**, not a replica of Rematch. It does not contain Rematch's characters, graphics, code, audio, branding, progression systems or complete competitive netcode. It is not affiliated with Sloclap. Art and stadium assets are created procedurally using Three.js.

**Features:** 3v3 matches with private room codes, join and choose your side (cyan or coral), bot fill if fewer than six friends are present, a four-minute clock, walled pitch, working goalies, team AI, server-authoritative ball and score, built-in controls screen, keyboard/mouse and gamepad input, touch controls, camera follow, match HUD, minimap, shot charging, slide tackles, passing, lob passes and a rematch button. It's designed primarily for desktop browsers with WebGL.

**Controls:** WASD move relative to camera; mouse aim/turn; Shift sprint; hold/release left mouse to shoot; right mouse or K pass; F or Space tackle; Q lob; E call pass; H help, R recenter camera. Gamepad: left stick movement, right stick look, right trigger hold/release shoot, RB pass, X tackle, Y lob, LB sprint. Touch screens have a joystick and action buttons.

**Technical notes:** Active rooms, bots and match state are kept in server memory, not PostgreSQL. A Render restart ends live matches. The authoritative server runs at 30 ticks per second and broadcasts snapshots at 10Hz; clients smooth visual positions. Room codes aren't accounts or persistent lobbies. For full competitive multiplayer, the next steps would include client-side prediction, interpolation buffers, lag compensation, reconnect tokens, server monitoring, improved goalie animations and ranked matchmaking.

## Shared First Discoveries & fully local AI

**New:** You can make new combinations permanent for everyone with PostgreSQL, see a special **✨ FIRST DISCOVERY!** label under the word when you genuinely discover an unseen item, and generate thousands more combinations on your own Windows PC with Google Gemma 3 + Ollama (no Gemini API).

**Setup:** [Shared database and local Gemma recipe generator](SHARED_DISCOVERIES_LOCAL_AI.md).

The site now starts with five playable games:

- **Infinite Race** — `/race.html` (crafting, races, bingo and elimination battles).
- **Bluff Club** — `/bluff.html` (2–12 players; 51 newly curated extra-hard questions from NASA, Natural History Museum and Smithsonian sources; the fact and source are revealed after voting).
- **Context Crash** — `/context.html` (3–12 players; an **original** out-of-context comedy game with a separate multiplayer namespace). Each player answers a private innocent prompt, receives another player's quote without its original question, rewrites the context, then votes anonymously on the funniest disaster. It has room codes, timed phases, a host skip option, scoring, a final doubled-points round, and a leaderboard.
- **Tee Riot** — `/tee.html` (3–12 players; an original T-shirt party game inspired by drawing/slogan competitions). Everyone designs an image and submits two slogans; the server pairs art with another player's slogan, then runs an elimination tournament with private artist-vote restrictions, byes for odd player counts, scoring and a champion reveal. The drawing editor has a smooth brush, eraser, shape tools, fill bucket, eyedropper, text stamp, palette/custom colours, brush size, opacity, transparent PNG export, history undo/redo, touch support and a live mockup with shirt-colour selection.
- **Neon Strike** — `/strike.html` (new original **3D arcade football** game): third-person WebGL field, one controlled player in 3v3 matches, bot-filled positions, friend room codes for up to six players, timed games, stamina/sprint, dribbling, chargeable shots, lob shots, passing, ball calling and slide tackles. Controls are WASD+mouse on desktop, standard gamepad, or touch virtual controls on supported devices. The server owns physics and scorekeeping; rendering uses a locally served, pinned `three` dependency rather than a remote CDN.

All five games run on the same Render service and are accessible from the game-card homepage at `/`. Context Crash is independently implemented, not an official Jackbox game and not affiliated with Jackbox.

**Tee Riot scoring:** +100 points to the artist and +40 to the assigned slogan writer for each vote the shirt receives. A final tournament winner is crowned after 3–12 players' shirts face off. Images are sent as limited-size WebP or PNG data URLs (not permanently stored). Drawing, slogan and match phases have automatic timeouts.

**Context Crash scoring:** +1,000 points per vote for your twisted post, plus +200 per vote to the original quote author (if submitted); final round doubles both. You cannot vote for your own post. Player names and original innocent prompts remain private during voting and are revealed afterward. Game state is currently in memory and resets after a server restart.

---

# Infinite Race — Battle & Crafting Update

Multiplayer browser crafting game with word racing, colored bingo and timed power battles. Built on Node.js, Express and Socket.IO.

## Deploy on Render (free-tier)

1. Upload the files inside this folder to your GitHub repository (keep `package.json` in the repository root).
2. Create/update your Render **Web Service** with Build `npm install`, Start `npm start`, instance type Free.
3. Configure up to five Gemini keys in Render Environment as `GEMINI_API_KEY_1` through `GEMINI_API_KEY_5`. An existing `GEMINI_API_KEY` can act as slot 1 for backwards compatibility. Gemini handles new cloud combinations and themed bingo; `GEMINI_MODEL` defaults to `gemini-3.5-flash` (you can override it). See [Gemini setup](GEMINI_SETUP.md) for full details.
4. Visit the Render URL. Players do not need to download or install the game.

Free Render instances sleep between visits; in-memory lobby state and player discoveries are not persistent across server restarts. Gemini free API quotas also apply. Do not put API secrets in GitHub or client-side code.

## Community Infinite Craft recipe database (no AI for recorded pairs)

Infinite Race now downloads an **existing community dataset** of up to 205,626 recorded Infinite Craft recipes into the server's memory when it starts. It uses this as the **first lookup for every craft**. A recorded pair returns immediately with **no Gemini, local AI or API request**.

Dataset source and credit: [Infinite Craft Solver by vantezzen](https://github.com/vantezzen/infinite-craft-solver), [project explanation](https://vantezzen.io/project/infinite-craft-solver). The creator explicitly offers the recipe archive for reuse. Data is from a 2024 community crawl, so it is not a complete or current snapshot of all possible pairs.

- Live status: \`/api/status\` contains \`communityRecipes\`, \`communityLoaded\`, \`communitySourceRecipes\`, \`communityElements\`, \`communityDiscarded\`, \`communityError\`.
- The server downloads the compact JSON (approximately 3.8 MB) at startup. If downloading fails, the built-in 26,906 recipes still work, with Gemini for unknown pairs.
- Existing built-in recipe count and community recipe count are **reported separately**, because the two sets overlap; do not add them to claim a unique combined total.
- Pairs are order-independent, outputs are sanity-filtered, and the public app does not query neal.fun directly or scrape it.
- Normal mode: recorded community combinations → built-in recipes → Gemini for completely unknown pairs, optionally local model if Gemini fails.
- **Strict no-AI crafting:** set \`NO_AI_CRAFTING=1\` on Render and restart. Then recorded combinations work with zero crafting AI calls, while unrecorded pairs return a gentle "No recorded result" error. This option applies to crafting only; themed bingo still uses Gemini.
- Set \`DISABLE_COMMUNITY_RECIPES=1\` to turn off the downloaded dataset.

The much larger 21M community crawl exists but has **unclear reuse rights**. It's not bundled here. Likewise the smaller solver archive is attributed rather than presented as our own data.


## November 2026: Faster crafting and verified Gemini slots

The built-in recipe library now has **26,906 unique unordered ingredient pairs** — **3,197 new deterministic recipes** beyond the previous 23,709, plus **94 replacements** of generic recipes with more specific outcomes. The new recipes are mainly real food preparation, countries and capitals, colours, and established science/game combinations. They never require AI or quota. These counts are validated at startup via \`recipeStats()\`.

Cloud crafting is now designed for low latency and lower API usage:

- Built-in recipes first, new Gemini generation only for unknown combinations.
- No more Bing/Wikipedia network lookups on every craft, which previously added up to 2.4 seconds.
- By default, crafting uses \`gemini-3.5-flash-lite\` with minimal thinking; themed bingo uses \`gemini-3.5-flash\` with low thinking. Override using \`GEMINI_CRAFT_MODEL\` / \`GEMINI_BINGO_MODEL\` in Render if those models aren't available to your project.
- Each key gets paced requests (default **3.6 seconds minimum between starts per key**); adjust with \`GEMINI_REQUEST_SPACING_MS\`.
- Keys returning 429 (quota), 401 (invalid key), 403 (restricted) or 404 (model unavailable) are marked and cooled down. HTTP 404 on Flash-Lite may use the Flash fallback on the same key.
- An invalid AI answer does **not** trigger four more expensive requests on other keys.
- Dynamic recipes are cached in RAM and saved using debounced async writes to a **small dynamic-only file**, rather than synchronous writes of 27,000 built-in recipes on every combination.

### Checking whether your keys REALLY work

Visit \`https://infinite-race.onrender.com/api/status\`. The \`geminiHealth.keys\` array contains each *slot number*, a sanitized real-test \`status\`, the tested model, HTTP status and last check time. **No API keys are returned.**

At server startup, each configured key gets one tiny real \`generateContent\` call, allowing us to distinguish a loaded environment variable from an actually working Gemini project. Tests are deliberately not repeated on every page load, to avoid consuming your free-tier quota.

- \`working\`: a real Gemini generation succeeded
- \`restricted\` (403) or \`invalid-key\` (401): that slot cannot currently be used
- \`rate-limited\` (429): the project has hit a current usage limit
- \`model-unavailable\` (404): the model isn't accessible for that project
- \`untested\`: the server hasn't completed its one-time test yet

If it reports **five** configured keys but you only intend to use four, check Render Environment for a leftover \`GEMINI_API_KEY_5\` or other old variable. Multiple API keys in the same Google Cloud project **share** that project's limits.

Google's per-project limits depend on model, RPM, TPM and RPD. This software cannot multiply quotas or guarantee an unlimited free tier. In-memory caches reset on Render service restarts, and persistent storage requires a persistent disk/database.

Official docs: https://ai.google.dev/gemini-api/docs/rate-limits


## Controls

- Click a sidebar item: places it near the center with a small random offset.
- Drag from sidebar to a piece: combines immediately upon release.
- Drag on canvas to move pieces and combine them; drop a piece over the right-hand sidebar to remove that *piece from the board*, not your discovered item.
- Drag empty board to pan; mouse wheel zooms.
- New discoveries are appended to the end of the item bank, after earlier items.

## Modes

- **Word race**: create a custom target or random target using Easy / Medium / Hard and optional theme.
- **Bingo**: first player to claim a square owns it; player's color and name show on the square. A line wins. If every square is claimed without a line, highest score wins. Custom/AI/random boards support 3x3, 4x4, 5x5.
- **Power battle**: host sets 15–900 seconds. Craft items and submit one fighter. At the deadline, submitted fighters compete in a seeded elimination tournament using consistent local power scores. The screen shows an animated bracket, sword duels, and a winner.

## Offline combinations

There are **23,709 unique preconfigured offline pair mappings** in the initial version of this update (combining hand-written mappings and coherent rule-expanded thematic mappings, NOT a million individually curated AI answers). Reachability examples can be calculated with `offlinePathTo()` in `recipe-engine.js`.

**Eternal Multiverse** is reachable from the four starters, with shortest sequential crafting depth 15 and 37 unique craft operations required along its dependency graph. These numbers refer to the current offline mapping and can change if recipes are adjusted.

No AI is needed for a known offline pair. For unknown pairs, the server tries Gemini if configured and caches results. The offline map can give broad or repeating answers because thematic rules are not the same as individually curated combinations.

## Caveats

Requires a supported Gemini API key for real open-ended AI. AI service quotas, free-tier hosting limitations and model errors are outside the game server's control. Rooms live in memory and reset if the hosting instance sleeps/restarts. Tournament-style latency balancing and a persistent database are future improvements.

## Browser-local AI edition (no API fees)

This edition uses the preconfigured offline combinations first. For an unknown pair,
`public/local-ai-worker.js` loads `onnx-community/Qwen3-1.7B-ONNX` or `onnx-community/Qwen3-0.6B-ONNX` using
Transformers.js and generates a proposed word/emoji in the visitor's own browser.
No `GEMINI_API_KEY` is required for word combinations.

- Run or deploy as before using `npm install && npm start` (Render: Node web service).
- Open the online website in recent Chrome or Edge with WebGPU enabled.
- Click **Load local AI** to preload or simply combine an unknown pair to load on demand.
- First visit **automatically downloads about 570 MB (Light) or 1.43 GB (Smart), plus extra model files** of model files from Hugging Face,
  subject to the browser's cache and device capacity. This is not an application install.
- The model runs on the visitor's device, not Render. Results are sent to the game
  server so other visitors get the same cached pair result. Free hosting may lose its
  recipe cache after a restart; configure durable storage for persistence.
- The model is small and sometimes gives poor or invalid answers. The game rejects
  obvious malformed outputs and allows retry for invalid output.
- This model is not a live web search agent. The internet is used to serve the site,
  download the AI library and model weights, and synchronize multiplayer recipes.
- **Competitive integrity:** because the client generates unknown answers, a modified
  client can send dishonest recipes and potentially cheat in races/bingo. Do not use
  this implementation for prize-bearing or high-stakes competitions without a
  trusted server-side recipe verifier.
- WebGPU is required in this build; some browsers and low-end devices cannot run it.
- The optional Gemini battle commentary and category target generation paths in
  server.js remain optional and may require a Gemini key; normal crafting does not.


## Smart local AI upgrade

Select **Auto**, **Smart (Qwen3 1.7B)**, or **Light (Qwen3 0.6B)** at the top-left of the canvas. Auto selects Smart when `navigator.deviceMemory >= 8 GB`, otherwise Light. Both are 4-bit ONNX browser models using WebGPU. If Smart fails to load, the worker falls back to Light. Changing model restarts only the AI worker; it does not clear discoveries, crafting pieces, or multiplayer lobbies.

The model weights are downloaded to each visitor's browser (not bundled inside the ZIP); Smart is around 1.43 GB and Light around 570 MB before auxiliary files. Actual performance, memory use, and first load time vary. Unknown combinations may still be imperfect. There is no paid API needed for crafting, but hosting and model availability depend on third-party free infrastructure.


## Local AI stability update (Nov 9)

- Smart: `onnx-community/Qwen2.5-1.5B-Instruct`; Light: `onnx-community/Qwen2.5-0.5B-Instruct`.
- Both use WebGPU 4-bit quantization, selecting q4 when the GPU lacks shader-f16.
- Manually choosing Smart does not silently fall back to Light; errors are reported.
- Theme generation happens on the lobby host's local AI before the race, with a preparation overlay for all players; failures cancel preparation.
- Browser WebGPU, video-memory, model CDN access and the first model download remain hardware/network prerequisites.
- Models are loaded from Hugging Face; no user install or paid API key is required.
- Live model inference was NOT tested in this environment.

## Browser AI compatibility update

- Browser model files are cached when permitted by storage settings. The model must still load into GPU/CPU memory each new tab/session; usually it will not need to download again. Private browsing, cache eviction, and model changes can cause repeat downloads.
- GPU mode uses the official Transformers.js `q4` quantisation for both Qwen2.5 models.
- CPU compatibility mode uses the Light 0.5B model, the WASM runtime, and a single thread to work without WebGPU. CPU generation may be very slow, particularly on phones.
- A model-load error is surfaced in the UI and the worker is cleared so the user can retry. This does not guarantee all browsers and GPU drivers can run local inference.
