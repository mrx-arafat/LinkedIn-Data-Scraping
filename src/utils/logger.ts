/* Simple logger with levels and progress */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  if (levelOrder[level] < levelOrder[currentLevel]) return;
  const prefix = `[${new Date().toISOString()}] [${level.toUpperCase()}]`;
  if (meta) console.log(prefix, msg, JSON.stringify(meta));
  else console.log(prefix, msg);
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => log('debug', m, meta),
  info: (m: string, meta?: Record<string, unknown>) => log('info', m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => log('warn', m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log('error', m, meta),
};

export function progress(current: number, total: number) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  process.stdout.write(`\rProgress: ${current}/${total} (${pct}%)   `);
  if (current >= total) process.stdout.write('\n');
}

