# Lauren Apex Email Backend

Sends verification codes, password-reset codes, and withdrawal notices via **Nodemailer** (Gmail App Password).

## Setup

```bash
cd email-backend
npm install
copy .env.example .env   # Windows: copy .env.example .env
```

Edit `.env`:

1. Open Google Account → Security → enable 2-Step Verification
2. App passwords → generate for "Mail"
3. Set SMTP_USER=your@gmail.com and SMTP_PASS=the 16-char app password

```bash
npm start
```

API runs at http://127.0.0.1:5050

In site `config.js` add:

```js
apiBaseUrl: "http://127.0.0.1:5050"
```

On Vercel later, deploy this API separately (Railway/Render) and set apiBaseUrl to that URL.
