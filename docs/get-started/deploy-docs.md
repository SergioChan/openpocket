# Deploy Documentation Site

OpenPocket docs are built as a static website with VitePress.

You can deploy with either GitHub Pages or Vercel.

## Option A: GitHub Pages (Recommended)

This repository includes a ready workflow:

- `.github/workflows/deploy-docs-pages.yml`

### Steps

1. In GitHub repository settings, open `Pages`.
2. Set `Source` to `GitHub Actions`.
3. Push to `main`.
4. Wait for workflow `Deploy Docs to GitHub Pages` to finish.

### Base Path and Custom Domain

The workflow resolves `DOCS_BASE` automatically:

- default (project pages): `/<repo-name>/`
- custom domain configured: `/`
- explicit override: repository variable `PAGES_DOCS_BASE`

To use a custom domain, set repository variable:

- `PAGES_CUSTOM_DOMAIN` (example: `docs.example.com`)

When `PAGES_CUSTOM_DOMAIN` is set, the workflow also writes a `CNAME` file into build output automatically.

### Published URL

Project pages default for this repository:

- `https://sergiochan.github.io/openpocket/`

With custom domain configured:

- `https://<your-domain>/`

## Option B: Vercel

This repository also includes:

- `vercel.json`

### Steps

1. Import the repository in Vercel.
2. Keep default root directory as repository root.
3. Build command: `npm run docs:build`
4. Output directory: `docs/.vitepress/dist`
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
