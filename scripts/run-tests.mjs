// Birim testleri çalıştırır. Projede test framework'ü yoktur; TypeScript dosyaları
// `typescript` paketiyle CommonJS'e derlenip Node'un yerleşik test runner'ında koşulur.
// Kullanım: npm test
import ts from 'typescript';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'footbally-tests-'));

// Derlenecek kaynaklar: testler ve test edilen saf modüller. Deno'ya özgü
// Edge Function giriş noktası (index.ts) dahil edilmez; yalnızca kuralları içeren dosyalar test edilir.
const SOURCE_DIRS = ['__tests__', 'lib', 'supabase/functions/notify-event'];
const EXCLUDED = new Set(['index.ts', 'supabase.ts', 'profiles.ts']);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return name.endsWith('.ts') && !name.endsWith('.d.ts') && !EXCLUDED.has(name) ? [full] : [];
  });
}

const testFiles = [];
for (const dir of SOURCE_DIRS) {
  for (const file of walk(join(root, dir))) {
    const rel = relative(root, file);
    const target = join(outDir, rel.replace(/\.ts$/, '.js'));
    mkdirSync(dirname(target), { recursive: true });
    const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: file,
    });
    writeFileSync(target, outputText);
    if (rel.startsWith(`__tests__${sep}`) && rel.endsWith('.test.ts')) testFiles.push(target);
  }
}

if (testFiles.length === 0) {
  console.error('Hiç test dosyası bulunamadı (__tests__/*.test.ts).');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], { stdio: 'inherit' });
process.exit(result.status ?? 1);
