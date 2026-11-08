# Infinite Race — Bingo & Polish Update

A Node.js and Socket.IO browser crafting game. Players **do not need to download anything**; deploy the site to a Node-compatible host (e.g. Render) and share its URL.

## Deploy

1. Upload the contents of this `infinite-race` folder to your GitHub repository.
2. On Render, create or update a **Web Service** with build command `npm install` and start command `npm start`.
3. Add `GEMINI_API_KEY` in Render **Environment**. Never put the key in GitHub or HTML.
4. Optional: `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite` as used by your earlier version; change it if Google says your free-tier model is unavailable.
5. Deploy and open the provided public URL. Free hosting and AI have quotas and may sleep or rate-limit.

To run locally for testing, install Node.js 18+ and run `npm install && npm start`, then open `http://localhost:3000`.

## How to play

- Click an item in the right bank to drop it in a random visible board position; drag a bank item onto the board or move existing pieces together to combine.
- Drag empty space to pan. The connected starfield moves with the board. Scroll to zoom.
- Elements flash while combinations are being generated, then pop and make sounds when placed. Mute via speaker.
- Create a lobby, share its code, select **Find a word** or **Bingo**, then start. Each new round resets all players' word banks to Water, Fire, Wind, Earth.
- Bingo supports 3x3, 4x4 and 5x5, with random targets or partial/full comma- or newline-separated custom lists. **First player to discover a square claims it**, permanently for that round. A full row, column or diagonal wins instantly. If all squares are claimed first, highest number of claimed squares wins; ties share the victory.
- At the end everyone sees a victory screen with fanfare, scores and a waiting message. The host starts the next round from the lobby.

## Notes

AI requests still require internet and free-tier Gemini capacity. Repeated pairs use a cached recipe. Speed is constrained by Google's API and free server wake-up time. Race state and cache are currently stored in process/local files, so free hosting restarts can reset rooms and discoveries.
