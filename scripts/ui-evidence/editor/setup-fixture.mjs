import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(process.argv[2]);
const here = dirname(fileURLToPath(import.meta.url));
const app = join(root, 'frontend/src/app');
// Run only in an isolated CI checkout/worktree. These fixture overrides are
// never committed to the feature branch or served to production users.
const layout = join(app, 'layout.tsx');
writeFileSync(join(root, 'frontend/qa-original-layout.txt'), readFileSync(layout));
writeFileSync(layout, "import './globals.css';\nexport default function Layout({children}:{children:React.ReactNode}) { return <html lang=\"en\"><body>{children}</body></html>; }\n");
mkdirSync(join(app, 'editor-feedback-fixture'), { recursive: true });
writeFileSync(join(app, 'editor-feedback-fixture/page.tsx'), readFileSync(join(here, 'fixture-page.tsx')));
console.log('Installed offline editor fixture in', root);
