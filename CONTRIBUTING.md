# Contributing to agent-pet

Thanks for thinking about contributing. agent-pet is small on purpose — keep PRs scoped and the build green.

## Local setup

```bash
git clone https://github.com/gibbon/agent-pet.git
cd agent-pet
pnpm install
pnpm typecheck
pnpm test
pnpm build       # produces dist/agent-pet.js + dist/agent-pet-widget.iife.js + dist/agent-pet-widget.es.js
```

Node ≥ 20 + pnpm ≥ 9 are required. macOS, Linux, and WSL2 are the primary paths.

## Try the live examples

```bash
npx serve . -p 5174
# then open http://localhost:5174/examples/auto-mount.html
```

## What to contribute

| If you want to… | You're really adding | Ship size |
|---|---|---|
| Add a new pet source provider (e.g. for a private catalog API) | a `PetProvider` definition | one folder under `src/core/providers/`, ~50 LOC |
| Fix a bug in the renderer or add a small atlas helper | code | normal PR |
| Translate the `messages` defaults to another language | a `Partial<PetMessages>` example in the README | one PR |
| Improve docs, fix typos | docs | one PR |
| Suggest a new top-level feature (e.g. setAmbient API, extra-tabs slot) | discussion | open an issue first |

If you're unsure, [open an issue](https://github.com/gibbon/agent-pet/issues/new) before writing code.

## PR checklist

Before opening a PR:

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` produces all three artifacts without warnings
- [ ] If you changed the public API, the relevant `agent-pet/widget` and `agent-pet` exports are updated
- [ ] If you added user-facing strings, they go through `PetMessages` (not hardcoded English)
- [ ] If you added user-facing icons, they go through `PetIcons` (not hardcoded `Icon*` imports)
- [ ] CHANGELOG.md has an entry under an unreleased heading or the next version

## Versioning

We follow semver. Pre-1.0 every minor (`0.X` → `0.Y`) may include breaking changes; once we hit 1.0 the version bucket becomes major-only.

CDN paths under `/v<bucket>/` are immutable — once shipped they don't change. New versions get a new bucket. Old buckets keep working for pinned consumers.

## Releases

Maintainers cut releases via:

```bash
pnpm version <patch|minor|major>      # bumps package.json + commits + tags
pnpm publish                          # prepublishOnly runs build + tests
git push --follow-tags
gh release create v<x.y.z> --notes-from-tag
```

The Cloudflare Pages deploy + the new `/v<bucket>/` path go live automatically on push to `master`.

## Reporting issues

Use [GitHub Issues](https://github.com/gibbon/agent-pet/issues) with:
- agent-pet version (`/v0.x/` from your script tag, or `npm view agent-pet version`)
- Browser + OS
- Reproduction (a CodePen / minimal HTML helps a lot)
- What you expected vs. what happened

## License

By contributing, you agree your work is released under [Apache-2.0](LICENSE).
