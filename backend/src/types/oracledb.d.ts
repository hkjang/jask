declare module 'oracledb' {
  // =============================================
  // Connection Interface
  // =============================================
  export interface Connection {
    execute<T = any>(
      sql: string,
      bindParams?: Record<string, any> | any[],
      options?: ExecuteOptions
    ): Promise<Result<T>>;
    close(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    break(): Promise<void>;
    ping(): Promise<void>;
  }

  export interface Result<T> {
    rows?: T[];
    metaData?: MetaData[];
    rowsAffected?: number;
    lastRowid?: string;
    outBinds?: any;
    implicitResults?: Result<any>[];
  }

  export interface MetaData {
    name: string;
    dbType: number;
    dbTypeName?: string;
    fetchType?: number;
    nullable?: boolean;
    precision?: number;
    scale?: number;
    byteSize?: number;
  }

  export interface ExecuteOptions {
    outFormat?: number;
    maxRows?: number;
    autoCommit?: boolean;
    fetchArraySize?: number;
    prefetchRows?: number;
    fetchInfo?: Record<string, { type: number }>;
  }

  // =============================================
  // Connection Pool Interface
  // =============================================
  export interface Pool {
    getConnection(): Promise<Connection>;
    close(drainTime?: number): Promise<void>;
    terminate(): Promise<void>;
    connectionsOpen: number;
    connectionsInUse: number;
    poolAlias?: string;
  }

  export interface PoolAttributes {
    user: string;
    password: string;
    connectString: string;
    poolMin?: number;
    poolMax?: number;
    poolIncrement?: number;
    poolTimeout?: number;
    poolPingInterval?: number;
    poolAlias?: string;
    stmtCacheSize?: number;
  }

  export interface ConnectionAttributes {
    user: string;
    password: string;
    connectString: string;
    stmtCacheSize?: number;
  }

  // =============================================
  // Functions
  // =============================================
  export function getConnection(attrs: ConnectionAttributes): Promise<Connection>;
  export function createPool(attrs: PoolAttributes): Promise<Pool>;
  export function getPool(poolAlias?: string): Pool;

  // =============================================
  // Constants - Output Format
  // =============================================
  export const OUT_FORMAT_ARRAY: number;
  export const OUT_FORMAT_OBJECT: number;

  // =============================================
  // Constants - Oracle Data Types (DB_TYPE_*)
  // =============================================
  // String Types
  export const DB_TYPE_VARCHAR: number;      // 1 - VARCHAR2
  export const DB_TYPE_CHAR: number;         // 96 - CHAR
  export const DB_TYPE_NVARCHAR: number;     // 1001 - NVARCHAR2
  export const DB_TYPE_NCHAR: number;        // 1096 - NCHAR
  export const DB_TYPE_LONG: number;         // 8 - LONG

  // Numeric Types
  export const DB_TYPE_NUMBER: number;       // 2 - NUMBER
  export const DB_TYPE_BINARY_INTEGER: number; // 3 - BINARY_INTEGER
  export const DB_TYPE_BINARY_FLOAT: number; // 100 - BINARY_FLOAT
  export const DB_TYPE_BINARY_DOUBLE: number; // 101 - BINARY_DOUBLE

  // Date/Time Types
  export const DB_TYPE_DATE: number;         // 12 - DATE
  export const DB_TYPE_TIMESTAMP: number;    // 180 - TIMESTAMP
  export const DB_TYPE_TIMESTAMP_TZ: number; // 181 - TIMESTAMP WITH TIME ZONE
  export const DB_TYPE_TIMESTAMP_LTZ: number; // 231 - TIMESTAMP WITH LOCAL TIME ZONE
  export const DB_TYPE_INTERVAL_YM: number;  // 182 - INTERVAL YEAR TO MONTH
  export const DB_TYPE_INTERVAL_DS: number;  // 183 - INTERVAL DAY TO SECOND

  // LOB Types
  export const DB_TYPE_CLOB: number;         // 112 - CLOB
  export const DB_TYPE_NCLOB: number;        // 1112 - NCLOB
  export const DB_TYPE_BLOB: number;         // 113 - BLOB
  export const DB_TYPE_BFILE: number;        // 114 - BFILE
  export const DB_TYPE_LONG_RAW: number;     // 24 - LONG RAW

  // Binary Types
  export const DB_TYPE_RAW: number;          // 23 - RAW
  export const DB_TYPE_ROWID: number;        // 104 - ROWID
  export const DB_TYPE_UROWID: number;       // 208 - UROWID

  // Other Types
  export const DB_TYPE_CURSOR: number;       // 102 - REF CURSOR
  export const DB_TYPE_BOOLEAN: number;      // 252 - BOOLEAN
  export const DB_TYPE_OBJECT: number;       // 108 - OBJECT
  export const DB_TYPE_JSON: number;         // 119 - JSON
  export const DB_TYPE_XMLTYPE: number;      // 109 - XMLTYPE

  // =============================================
  // Error Codes (ORA-XXXXX)
  // =============================================
  export interface OracleError extends Error {
    errorNum?: number;    // ORA-XXXXX number
    offset?: number;      // Position in SQL where error occurred
  }
}
