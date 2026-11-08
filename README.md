# Infinite Race
A multiplayer infinite-combination crafting game with AI recipes, lobby codes, race targets, and a reset word bank for each race.

## Run
1. Install Node.js 18+.
2. In this folder run `npm install`.
3. Set `OPENAI_API_KEY` in your server environment to enable AI-generated combinations. Never put the key in the browser code.
4. Run `npm start` and open http://localhost:3000.
5. Deploy the Node server to a host that supports persistent WebSocket connections (e.g. Render or Railway), set `OPENAI_API_KEY`, and share its public URL with friends.

## Notes
- The built-in recipes work without an API key. Unknown combinations fall back to combined words when AI is unavailable.
- Recipes are cached to `recipes-cache.json` for consistency. On ephemeral hosting use a persistent disk or database to preserve the cache across deployments.
- Rooms live in server memory and reset when the server restarts. This is a playable prototype, not a production-scale matchmaking backend.
- AI combinations can be imperfect; semantic quality depends on the model.
