declare module 'sql.js' {
  export interface QueryExecResult {
    columns: string[]
    values: unknown[][]
  }

  export interface Database {
    exec(sql: string, params?: unknown[] | Record<string, unknown>): QueryExecResult[]
    run(sql: string, params?: unknown[] | Record<string, unknown>): Database
    export(): Uint8Array
    close(): void
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array | number[]) => Database
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string
  }): Promise<SqlJsStatic>
}
