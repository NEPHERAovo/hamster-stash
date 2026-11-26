import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function formatShanghaiDateYYMMDD(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${year}${month}${day}`;
}

export function computeNextVersion(currentVersion, now = new Date()) {
  const todayCode = formatShanghaiDateYYMMDD(now);
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(currentVersion).trim());
  const major = match ? match[1] : '1';
  const minor = match ? match[2] : '0';
  const patch = match ? match[3] : '';

  let nextSeq = 1;
  const dateSeqMatch = /^(\d{6})(\d{2,})$/.exec(patch);
  if (dateSeqMatch && dateSeqMatch[1] === todayCode) {
    nextSeq = Number(dateSeqMatch[2]) + 1;
  }

  return `${major}.${minor}.${todayCode}${String(nextSeq).padStart(2, '0')}`;
}

const isCli =
  typeof process !== 'undefined' &&
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const pkgUrl = new URL('../package.json', import.meta.url);
  const pkg = JSON.parse(readFileSync(pkgUrl, 'utf-8'));
  const nextVersion = computeNextVersion(pkg.version);
  pkg.version = nextVersion;
  writeFileSync(pkgUrl, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8');
  process.stdout.write(`${nextVersion}\n`);
}
