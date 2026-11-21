import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function getFilesRecursively(dir: string, extensions: string[]): string[] {
  const result: string[] = [];
  if (!fs.existsSync(dir)) return result;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...getFilesRecursively(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      result.push(fullPath);
    }
  }
  return result;
}

describe('Architecture & Language Boundary Contracts', () => {
  it('contract: src/plugins/** must NOT contain relative imports into stores/, core/, domain/, or components/', () => {
    const pluginFiles = getFilesRecursively(path.resolve(process.cwd(), 'src/plugins'), ['.ts', '.tsx']);
    const srcDir = path.resolve(process.cwd(), 'src');

    const violations: { file: string; line: string }[] = [];

    for (const filePath of pluginFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/from\s+['"]([^'"]+)['"]/);
        if (match && match[1].startsWith('.')) {
          const resolvedPath = path.resolve(path.dirname(filePath), match[1]);
          const relToSrc = path.relative(srcDir, resolvedPath);
          if (
            relToSrc.startsWith('stores') ||
            relToSrc.startsWith('core') ||
            relToSrc.startsWith('domain') ||
            relToSrc.startsWith('components/ledger')
          ) {
            violations.push({ file: path.relative(process.cwd(), filePath), line: line.trim() });
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('contract: src/components/** and src/plugins/** must NOT contain hardcoded bg-white or #ffffff', () => {
    const targetDirs = [
      path.resolve(process.cwd(), 'src/components'),
      path.resolve(process.cwd(), 'src/plugins'),
    ];

    const files = targetDirs.flatMap((dir) => getFilesRecursively(dir, ['.ts', '.tsx']));
    const hardcodedWhitePattern = /\b(bg-white|#ffffff|#1E1D1A)\b/i;

    const violations: { file: string; line: string }[] = [];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (hardcodedWhitePattern.test(line)) {
          violations.push({ file: path.relative(process.cwd(), filePath), line: line.trim() });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('contract: AGENTS.md and LESSONS.md must contain zero CJK characters to guard English engineering boundary', () => {
    const docFiles = ['AGENTS.md', 'LESSONS.md'];
    const cjkPattern = /[\u4e00-\u9fa5]/g;

    const violations: { file: string; match: string }[] = [];

    for (const fileName of docFiles) {
      const filePath = path.resolve(process.cwd(), fileName);
      if (!fs.existsSync(filePath)) {
        violations.push({ file: fileName, match: 'File does not exist' });
        continue;
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      const matches = content.match(cjkPattern);
      if (matches && matches.length > 0) {
        violations.push({ file: fileName, match: `Found ${matches.length} CJK characters: ${matches.slice(0, 5).join(', ')}...` });
      }
    }

    expect(violations).toEqual([]);
  });

  it('contract: lucide-react must be completely purged from package.json and all source files', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
    expect(pkg.dependencies?.['lucide-react']).toBeUndefined();
    expect(pkg.devDependencies?.['lucide-react']).toBeUndefined();

    const allSourceFiles = getFilesRecursively(path.resolve(process.cwd(), 'src'), ['.ts', '.tsx']);
    const violations: { file: string; line: string }[] = [];

    for (const filePath of allSourceFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (/['"]lucide-react['"]/.test(line)) {
          violations.push({ file: path.relative(process.cwd(), filePath), line: line.trim() });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
