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

function collectLayerImportViolations(
  targetDirs: string[],
  forbiddenPrefixes: string[],
  options?: { exactMatches?: string[]; bannedLinePatterns?: RegExp[] },
): { file: string; line: string }[] {
  const srcDir = path.resolve(process.cwd(), 'src');
  const files = targetDirs.flatMap((dir) => getFilesRecursively(dir, ['.ts', '.tsx']));
  const violations: { file: string; line: string }[] = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      for (const pattern of options?.bannedLinePatterns ?? []) {
        if (pattern.test(line)) {
          violations.push({ file: path.relative(process.cwd(), filePath), line: line.trim() });
        }
      }

      const match = line.match(/(?:from|import)\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/);
      const importPath = match?.[1] ?? match?.[2];
      if (!importPath || !importPath.startsWith('.')) continue;

      const resolvedPath = path.resolve(path.dirname(filePath), importPath);
      const relToSrc = path.relative(srcDir, resolvedPath).replace(/\\/g, '/').replace(/\.(ts|tsx)$/, '');
      const hitPrefix = forbiddenPrefixes.some((prefix) => relToSrc.startsWith(prefix));
      const hitExact = (options?.exactMatches ?? []).includes(relToSrc);
      if (hitPrefix || hitExact) {
        violations.push({ file: path.relative(process.cwd(), filePath), line: line.trim() });
      }
    }
  }

  return violations;
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

  it('contract: src/components/** and src/stores/** must NOT bypass services via adapter/repository access', () => {
    const componentsDir = path.resolve(process.cwd(), 'src/components');
    const storesDir = path.resolve(process.cwd(), 'src/stores');

    const sharedViolations = collectLayerImportViolations(
      [componentsDir, storesDir],
      ['core/adapters', 'core/repositories'],
      { bannedLinePatterns: [/\bcore\.(adapter|\w+Repo)\b/] },
    );

    const uiCoreSingletonViolations = collectLayerImportViolations(
      [componentsDir],
      [],
      { exactMatches: ['core', 'core/index'] },
    );

    expect([...sharedViolations, ...uiCoreSingletonViolations]).toEqual([]);
  });

  it('contract: src/core/adapters/** must NOT contain seeding logic or import domain/repository modules', () => {
    const adaptersDir = path.resolve(process.cwd(), 'src/core/adapters');
    const violations = collectLayerImportViolations(
      [adaptersDir],
      ['domain', 'core/repositories', 'core/db/defaultData', 'core/plugin', 'stores', 'components', 'plugins'],
      {
        exactMatches: ['core', 'core/index'],
        bannedLinePatterns: [/\bisSandboxModeActive\b/],
      },
    );

    expect(violations).toEqual([]);
  });

  it('contract: src/domain/** must NOT import core singleton, adapters, plugin runtime, stores, or UI', () => {
    const domainDir = path.resolve(process.cwd(), 'src/domain');
    const importViolations = collectLayerImportViolations(
      [domainDir],
      ['core/adapters', 'core/plugin', 'stores', 'components', 'plugins'],
      { exactMatches: ['core', 'core/index'] },
    );

    const concreteRepoViolations: { file: string; line: string }[] = [];
    for (const filePath of getFilesRecursively(domainDir, ['.ts', '.tsx'])) {
      const rel = path.relative(domainDir, filePath).replace(/\\/g, '/');
      if (rel.startsWith('bootstrap/')) continue;
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
      for (const line of lines) {
        if (
          /from\s+['"][^'"]*core\/repositories\//.test(line) &&
          !/^\s*import\s+type\b/.test(line)
        ) {
          concreteRepoViolations.push({ file: path.relative(process.cwd(), filePath), line: line.trim() });
        }
      }
    }

    expect([...importViolations, ...concreteRepoViolations]).toEqual([]);
  });
});
