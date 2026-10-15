# Deploying for free

Two pieces: the API on Render (free web service) and the static frontend on GitHub Pages. No card needed for either.

## 1. API on Render (Blueprint)

1. render.com -> **New +** -> **Blueprint**.
2. Pick the `nightterm` repo -> **Connect**.
3. Render reads `render.yaml` and shows one service, `nightterm-api` (Docker, Free). Click **Apply**.
4. Wait for the first build (a few minutes). When it says **Live**, open the service page and copy its URL, for example `https://nightterm-api.onrender.com`.
5. Check it: open `<that URL>/health`. You should see `{"ok":true}`. Then `<that URL>/quotes?symbols=RELIANCE` should return a price.

`render.yaml` already sets `healthCheckPath: /health` and `CORS_ORIGINS=https://mjanthony819.github.io,http://localhost:3000`. If you ever host the frontend on another domain, add it to `CORS_ORIGINS` in the Render dashboard (Environment tab), comma separated, no path and no trailing slash.

## 2. Frontend on GitHub Pages

1. Repo **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**.
2. Repo **Settings -> Secrets and variables -> Actions -> Variables -> New repository variable**:
   name `API_URL`, value = the Render URL from step 1.4 (no trailing slash).
3. **Actions -> deploy-frontend -> Run workflow** (or push any change under `frontend/`).
4. Site: https://mjanthony819.github.io/nightterm/

Until `API_URL` is set the workflow skips the deploy (it just leaves a notice). Set the variable, then re-run it.

## Notes

- Free Render services sleep after about 15 minutes without traffic. The first request after that takes up to a minute; the UI shows a "waking server" banner. The optional `keepalive` workflow pings `/health` every ~14 minutes to reduce this. Delete `.github/workflows/keepalive.yml` if you do not want it.
- Yahoo Finance is unofficial and may rate-limit shared cloud IPs. The API caches quotes for 45 s and serves the last good answer if Yahoo errors, so one burst does not blank the screen. If Yahoo blocks Render's IP for a while, quotes show as missing until it clears.
- Local run: `cd backend && pip install -r requirements.txt && uvicorn main:app --port 8000`, then `cd frontend && npm i && npm run dev`.
