# Lauren Apex Global

## Files
- `index.html` — public site + client dashboard
- `admin.html` — admin panel (`/admin.html`)
- `config.js` — **private secrets** (password, Firebase, wallets) — not on GitHub
- `config.example.js` — template you can commit
- `background-video.mp4`, `owner.jpg` — media

## First setup
1. Copy config:
   ```
   copy config.example.js config.js
   ```
   (Mac/Linux: `cp config.example.js config.js`)
2. Edit `config.js` with your real password, Firebase keys, and wallet addresses.
3. Open with Live Server or deploy (see below).

## GitHub (no secrets)
Only commit safe files. `config.js` is listed in `.gitignore`.

```powershell
git add .
git status
# confirm config.js is NOT listed
git commit -m "Site without secrets"
git push
```

## Vercel
**Option A — drag & drop:** upload the folder **including** `config.js`.

**Option B — GitHub import:** after clone on your machine, ensure `config.js` exists, then either:
- Deploy with Vercel CLI from that folder: `npx vercel --prod`
- Or add `config.js` on the server another way

Without `config.js`, the site falls back to safe placeholders and admin default must be set in code example only.

## Admin
- URL: `https://your-domain/admin.html`
- Change email/password under **Settings** after login (stored in browser for that domain).
