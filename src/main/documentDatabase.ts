import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { app } from 'electron'
import initSqlJs from 'sql.js'
import type { Database, SqlJsStatic } from 'sql.js'
import type { PageMeta, PersistedDocumentSnapshot, Workspace } from '../shared/documentSnapshot'

const require = createRequire(import.meta.url)
const sqlWasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
const DB_FILENAME = 'complexte.sqlite'

type Row = Record<string, unknown>

let databasePromise: Promise<DocumentDatabase> | null = null
let sqlJsPromise: Promise<SqlJsStatic> | null = null

function queryRows(db: Database, sql: string): Row[] {
  const result = db.exec(sql)[0]
  if (!result) return []

  return result.values.map(valueRow =>
    Object.fromEntries(result.columns.map((column, index) => [column, valueRow[index]])),
  )
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function serializeJson(value: unknown): string {
  return JSON.stringify(value)
}

function hasColumn(db: Database, tableName: string, columnName: string): boolean {
  return queryRows(db, `PRAGMA table_info(${tableName});`)
    .some(row => String(row.name ?? '') === columnName)
}

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: file => (file.endsWith('.wasm') ? sqlWasmPath : file),
    })
  }
  return sqlJsPromise
}

class DocumentDatabase {
  constructor(
    private readonly db: Database,
    private readonly filePath: string,
  ) {}

  static async open(): Promise<DocumentDatabase> {
    await app.whenReady()

    const SQL = await getSqlJs()
    const filePath = join(app.getPath('userData'), DB_FILENAME)
    await mkdir(dirname(filePath), { recursive: true })

    let rawDatabase: Uint8Array | undefined
    try {
      rawDatabase = new Uint8Array(await readFile(filePath))
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') throw error
    }

    const db = rawDatabase ? new SQL.Database(rawDatabase) : new SQL.Database()
    const repository = new DocumentDatabase(db, filePath)
    repository.ensureSchema()
    return repository
  }

  private ensureSchema(): void {
    this.db.run('PRAGMA foreign_keys = ON;')

    this.db.run(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        modified TEXT NOT NULL
      );
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        indexed_path TEXT NOT NULL,
        collections_json TEXT NOT NULL DEFAULT '[]',
        related_ids_json TEXT NOT NULL DEFAULT '[]',
        modified TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        is_initialized INTEGER NOT NULL,
        content_json TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );
    `)

    if (!hasColumn(this.db, 'pages', 'collections_json')) {
      this.db.run(`ALTER TABLE pages ADD COLUMN collections_json TEXT NOT NULL DEFAULT '[]';`)
    }

    if (!hasColumn(this.db, 'pages', 'related_ids_json')) {
      this.db.run(`ALTER TABLE pages ADD COLUMN related_ids_json TEXT NOT NULL DEFAULT '[]';`)
    }

    this.db.run(`
      CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        active_workspace_id TEXT NOT NULL,
        active_page_id TEXT,
        open_tab_ids TEXT NOT NULL,
        page_counter INTEGER NOT NULL,
        workspace_counter INTEGER NOT NULL
      );
    `)
  }

  async loadSnapshot(): Promise<PersistedDocumentSnapshot | null> {
    const workspaceRows = queryRows(
      this.db,
      'SELECT id, name, modified FROM workspaces ORDER BY modified DESC, name ASC;',
    )
    if (workspaceRows.length === 0) return null

    const pageRows = queryRows(
      this.db,
      `
        SELECT
          id,
          workspace_id,
          name,
          indexed_path,
          collections_json,
          related_ids_json,
          modified,
          display_order,
          is_initialized,
          content_json
        FROM pages
        ORDER BY workspace_id ASC, display_order ASC, name ASC;
      `,
    )
    const appState = queryRows(
      this.db,
      `
        SELECT
          active_workspace_id,
          active_page_id,
          open_tab_ids,
          page_counter,
          workspace_counter
        FROM app_state
        WHERE id = 1;
      `,
    )[0]

    if (!appState) return null

    const workspaces: Workspace[] = workspaceRows.map(row => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? 'Workspace'),
      modified: String(row.modified ?? new Date().toISOString()),
    }))

    const pages: PageMeta[] = pageRows.map(row => ({
      id: String(row.id ?? ''),
      workspaceId: String(row.workspace_id ?? ''),
      name: String(row.name ?? 'Untitled'),
      indexedPath: parseJson<string[]>(row.indexed_path, []),
      collections: parseJson<string[]>(row.collections_json, []),
      relatedIds: parseJson<string[]>(row.related_ids_json, []),
      modified: String(row.modified ?? new Date().toISOString()),
      order: Number(row.display_order ?? 0),
      isInitialized: Boolean(row.is_initialized),
    }))

    const contentById = Object.fromEntries(
      pageRows.map(row => [String(row.id ?? ''), parseJson<unknown[]>(row.content_json, [])]),
    )

    return {
      version: 2,
      workspaces,
      activeWorkspaceId: String(appState.active_workspace_id ?? workspaces[0]?.id ?? ''),
      pages,
      activeId: appState.active_page_id == null ? null : String(appState.active_page_id),
      openTabIds: parseJson<string[]>(appState.open_tab_ids, []),
      contentById,
      pageCounter: Number(appState.page_counter ?? pages.length),
      workspaceCounter: Number(appState.workspace_counter ?? workspaces.length),
    }
  }

  async saveSnapshot(snapshot: PersistedDocumentSnapshot): Promise<void> {
    this.db.run('BEGIN;')

    try {
      this.db.run('DELETE FROM pages;')
      this.db.run('DELETE FROM workspaces;')
      this.db.run('DELETE FROM app_state;')

      snapshot.workspaces.forEach(workspace => {
        this.db.run(
          'INSERT INTO workspaces (id, name, modified) VALUES (?, ?, ?);',
          [workspace.id, workspace.name, workspace.modified],
        )
      })

      snapshot.pages.forEach(page => {
        this.db.run(
          `
            INSERT INTO pages (
              id,
              workspace_id,
              name,
              indexed_path,
              collections_json,
              related_ids_json,
              modified,
              display_order,
              is_initialized,
              content_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
          `,
          [
            page.id,
            page.workspaceId,
            page.name,
            serializeJson(page.indexedPath),
            serializeJson(page.collections),
            serializeJson(page.relatedIds),
            page.modified,
            page.order,
            page.isInitialized ? 1 : 0,
            serializeJson(snapshot.contentById[page.id] ?? []),
          ],
        )
      })

      this.db.run(
        `
          INSERT INTO app_state (
            id,
            active_workspace_id,
            active_page_id,
            open_tab_ids,
            page_counter,
            workspace_counter
          ) VALUES (1, ?, ?, ?, ?, ?);
        `,
        [
          snapshot.activeWorkspaceId,
          snapshot.activeId,
          serializeJson(snapshot.openTabIds),
          snapshot.pageCounter,
          snapshot.workspaceCounter,
        ],
      )

      this.db.run('COMMIT;')
    } catch (error) {
      this.db.run('ROLLBACK;')
      throw error
    }

    await writeFile(this.filePath, Buffer.from(this.db.export()))
  }
}

async function getDatabase(): Promise<DocumentDatabase> {
  if (!databasePromise) {
    databasePromise = DocumentDatabase.open()
  }
  return databasePromise
}

export async function loadDocumentSnapshot(): Promise<PersistedDocumentSnapshot | null> {
  const database = await getDatabase()
  return database.loadSnapshot()
}

export async function saveDocumentSnapshot(snapshot: PersistedDocumentSnapshot): Promise<void> {
  const database = await getDatabase()
  await database.saveSnapshot(snapshot)
}
