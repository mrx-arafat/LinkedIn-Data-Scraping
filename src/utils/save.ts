import fs from 'node:fs';
import path from 'node:path';

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function saveJSON(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function saveCSV<T extends Record<string, any>>(filePath: string, rows: T[]) {
  ensureDir(path.dirname(filePath));
  if (rows.length === 0) return fs.writeFileSync(filePath, '', 'utf-8');
  const preferred = ['name', 'headline', 'username', 'profileUrl'];
  const headers = preferred
    .filter((h) => h in rows[0])
    .concat(
      Object.keys(rows[0]).filter((h) => !preferred.includes(h))
    );
  const escape = (v: any) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('\n') || s.includes('"')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [headers.join(',')].concat(rows.map((r) => headers.map((h) => escape(r[h])).join(',')));
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

