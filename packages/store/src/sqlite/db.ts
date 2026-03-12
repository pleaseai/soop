/**
 * Minimal SQLite adapter that works in both Node.js (better-sqlite3) and
 * Bun compiled binaries (bun:sqlite).
 *
 * better-sqlite3 is a native .node addon — it cannot be loaded from inside
 * a Bun compiled binary's virtual filesystem. bun:sqlite is a Bun built-in
 * that is not available in Node.js. Runtime detection picks the right one.
 */

export interface SqliteStatement {
  run: (...args: unknown[]) => unknown
  get: (...args: unknown[]) => unknown
  all: (...args: unknown[]) => unknown[]
}

export interface SqliteDb {
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
  transaction: <T>(fn: () => T) => () => T
  close: () => void
}

export async function openSqliteDatabase(path: string): Promise<SqliteDb> {
  const p = path === 'memory' ? ':memory:' : path

  if (typeof Bun !== 'undefined') {
    // bun:sqlite is built into the Bun runtime (and compiled binaries).
    // The import is dynamic so bundlers don't try to resolve it statically.
    const { Database } = await import('bun:sqlite')
    return new Database(p) as unknown as SqliteDb
  }

  const { default: BetterSQLite } = await import('better-sqlite3')
  return new BetterSQLite(p) as unknown as SqliteDb
}
