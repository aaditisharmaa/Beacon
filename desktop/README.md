# BEACON Desktop

## Development

```powers
npm install
npm run electron:dev
```

The desktop app expects Django at `http://127.0.0.1:8001` by default.

## Hosted backend

Create `desktop/.env` with:

```text
VITE_API_URL=https://your-beacon-api.onrender.com
```

## Production build

```powers
npm run electron:build
```
