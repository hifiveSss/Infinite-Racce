# The Game Room — Three multiplayer browser games

The site now starts with three playable games:

- **Infinite Race** — `/race.html` (crafting, races, bingo and elimination battles).
- **Bluff Club** — `/bluff.html` (2–12 players; 51 newly curated extra-hard questions from NASA, Natural History Museum and Smithsonian sources; the fact and source are revealed after voting).
- **Context Crash** — `/context.html` (3–12 players; an **original** out-of-context comedy game with a separate multiplayer namespace). Each player answers a private innocent prompt, receives another player's quote without its original question, rewrites the context, then votes anonymously on the funniest disaster. It has room codes, timed phases, a host skip option, scoring, a final doubled-points round, and a leaderboard.

All three games run on the same Render service and are accessible from the split-card homepage at `/`. Context Crash is independently implemented, not an official Jackbox game and not affiliated with Jackbox.

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
