<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Reglas del proyecto

Antes de cualquier tarea leé CLAUDE.md completo y respetá todas sus reglas: también son para vos. La especificación está en docs/SPEC.md y el sistema de diseño en docs/DESIGN.md.

## Cuando trabajás delegado por Claude

- Hacé solo la fase o tarea que te pasan. No avances a la siguiente.
- Si llegás a un FRENÁ, a una decisión de la SPEC que no se puede cumplir, o necesitás una dependencia nueva, no improvises: frená y explicá el problema.
- Al terminar, corré npm run lint, npm run typecheck, npm test y npm run build (y npm run check:responsive y npm run check:design si tocaste interfaz).
- Reportá: archivos tocados, resultado de cada comando y dónde quedaron las capturas.
- No hagas commits.
