# Deploy Documentation Site

OpenPocket docs are built as a static website with VitePress.

This project deploys documentation with Vercel.

This repository also includes:

- `vercel.json`

### Steps

1. Import the repository in Vercel.
2. Keep default root directory as repository root.
3. Build command: `npm run docs:build`
4. Output directory: `frontend/.vitepress/dist`
5. Deploy.

Vercel deployment uses docs base `/`, so no extra base setting is required.

## Local Preview

Run docs locally before deploying:

```bash
npm run docs:dev
```

Build for production:

```bash
npm run docs:build
```

Preview production build:

```bash
npm run docs:preview
```
