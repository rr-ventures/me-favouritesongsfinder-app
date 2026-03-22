import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'
import { logger } from '../utils/logger.js'

let db: Database.Database | null = null

function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'soundscope.db')
}

function getSchemaPath(): string {
  // In production, schema.sql is bundled alongside the main process
  // In development, it's relative to the src directory
  const candidates = [
    path.join(process.env.APP_ROOT ?? '', 'src/main/lib/db/schema.sql'),
    path.join(__dirname, '../../db/schema.sql'),
    path.join(__dirname, 'schema.sql'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  throw new Error('schema.sql not found')
}

export function getDb(): Database.Database {
  if (db) return db

  const dbPath = getDbPath()
  logger.info('Opening database', { path: dbPath })

  db = new Database(dbPath, { verbose: undefined })

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  // Apply schema
  const schemaPath = getSchemaPath()
  const schema = fs.readFileSync(schemaPath, 'utf-8')
  db.exec(schema)

  logger.info('Database ready', { tables: getTableCount() })

  return db
}

function getTableCount(): number {
  if (!db) return 0
  const row = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number }
  return row.count
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
    logger.info('Database closed')
  }
}
