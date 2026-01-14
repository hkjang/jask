declare module 'oracledb' {
  export interface Connection {
    execute<T = any>(
      sql: string,
      bindParams?: any,
      options?: ExecuteOptions
    ): Promise<Result<T>>;
    close(): Promise<void>;
  }

  export interface Result<T> {
    rows?: T[];
    metaData?: MetaData[];
    rowsAffected?: number;
  }

  export interface MetaData {
    name: string;
    dbType: number;
    fetchType?: number;
    nullable?: boolean;
  }

  export interface ExecuteOptions {
    outFormat?: number;
    maxRows?: number;
    autoCommit?: boolean;
    fetchArraySize?: number;
  }

  export interface ConnectionAttributes {
    user: string;
    password: string;
    connectString: string;
  }

  export function getConnection(attrs: ConnectionAttributes): Promise<Connection>;

  export const OUT_FORMAT_OBJECT: number;
  export const OUT_FORMAT_ARRAY: number;
}
