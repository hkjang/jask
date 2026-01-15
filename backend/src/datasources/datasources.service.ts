import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { 
  CreateDataSourceDto, 
  UpdateDataSourceDto, 
  HealthCheckResponseDto,
  DataSourceStatisticsDto,
  DataSourceOverviewDto
} from './dto/datasources.dto';
import { Client as PgClient } from 'pg';
import * as mysql from 'mysql2/promise';
import oracledb from 'oracledb';
import * as crypto from 'crypto';

export type DbConnection = PgClient | mysql.Connection | oracledb.Connection;

// 암호화 설정
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'jask-datasource-encryption-key-32';
const IV_LENGTH = 16;

@Injectable()
export class DataSourcesService {
  private connectionCache = new Map<string, DbConnection>();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  // 비밀번호 암호화
  private encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } catch {
      return text; // 암호화 실패 시 원본 반환
    }
  }

  // 비밀번호 복호화
  private decrypt(text: string): string {
    try {
      const parts = text.split(':');
      if (parts.length !== 2) return text;
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return text; // 복호화 실패 시 원본 반환
    }
  }

  async create(dto: CreateDataSourceDto) {
    // 연결 테스트
    await this.testConnection(dto);

    return this.prisma.dataSource.create({
      data: {
        name: dto.name,
        type: dto.type,
        host: dto.host,
        port: dto.port,
        database: dto.database,
        username: dto.username,
        password: this.encrypt(dto.password),
        schema: dto.schema || 'public',
        description: dto.description,
        environment: dto.environment || 'development',
        sslEnabled: dto.sslEnabled || false,
        sslConfig: dto.sslConfig ? { ...dto.sslConfig } : undefined,
        poolConfig: dto.poolConfig ? { ...dto.poolConfig } : undefined,
        healthStatus: 'healthy',
        lastHealthCheck: new Date(),
      },
    });
  }

  async findAll() {
    return this.prisma.dataSource.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        type: true,
        host: true,
        port: true,
        database: true,
        schema: true,
        description: true,
        environment: true,
        sslEnabled: true,
        healthStatus: true,
        lastHealthCheck: true,
        queryCount: true,
        avgResponseTime: true,
        lastActiveAt: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: { tables: true, queries: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id },
      include: {
        tables: {
          where: { isExcluded: false },
          include: {
            columns: true,
          },
        },
      },
    });

    if (!dataSource) {
      throw new NotFoundException('데이터소스를 찾을 수 없습니다.');
    }

    return dataSource;
  }

  async update(id: string, dto: UpdateDataSourceDto) {
    await this.findOne(id);

    if (dto.host || dto.port || dto.database || dto.username || dto.password) {
      await this.testConnection({ ...dto } as CreateDataSourceDto);
    }

    const updateData: any = { ...dto };
    if (dto.password) {
      updateData.password = this.encrypt(dto.password);
    }

    return this.prisma.dataSource.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // 연결 캐시에서 제거
    const cached = this.connectionCache.get(id);
    if (cached) {
      try {
        const dataSource = await this.prisma.dataSource.findUnique({ where: { id } });
        if (dataSource?.type === 'oracle') {
          await (cached as oracledb.Connection).close();
        } else if (dataSource?.type === 'mysql') {
          await (cached as mysql.Connection).end();
        } else if (dataSource?.type === 'postgresql') {
          await (cached as PgClient).end();
        }
      } catch (error) {
        // Ignore close errors
      }
      this.connectionCache.delete(id);
    }

    return this.prisma.dataSource.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async testConnection(config: CreateDataSourceDto): Promise<boolean> {
    try {
      const sslOptions = config.sslEnabled ? this.buildSslOptions(config) : undefined;
      
      if (config.type === 'postgresql') {
        const client = new PgClient({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          ssl: sslOptions,
        });
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
      } else if (config.type === 'mysql') {
        const connection = await mysql.createConnection({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
          ssl: sslOptions,
        });
        await connection.query('SELECT 1');
        await connection.end();
      } else if (config.type === 'oracle') {
        const connection = await oracledb.getConnection({
          user: config.username,
          password: config.password,
          connectString: `${config.host}:${config.port}/${config.schema || config.database}`,
        });
        await connection.execute('SELECT 1 FROM DUAL');
        await connection.close();
      } else {
        throw new BadRequestException(`지원하지 않는 데이터베이스 타입: ${config.type}`);
      }
      return true;
    } catch (error) {
      throw new BadRequestException(`연결 실패: ${error.message}`);
    }
  }

  private buildSslOptions(config: CreateDataSourceDto): any {
    if (!config.sslEnabled) return undefined;
    
    const sslConfig = config.sslConfig || {};
    
    if (config.type === 'postgresql') {
      return {
        rejectUnauthorized: sslConfig.mode === 'verify-full' || sslConfig.mode === 'verify-ca',
        ca: sslConfig.ca,
        cert: sslConfig.cert,
        key: sslConfig.key,
      };
    } else if (config.type === 'mysql') {
      return {
        rejectUnauthorized: sslConfig.mode !== 'disable',
        ca: sslConfig.ca,
        cert: sslConfig.cert,
        key: sslConfig.key,
      };
    }
    return undefined;
  }

  // 헬스 체크
  async checkHealth(id: string): Promise<HealthCheckResponseDto> {
    const dataSource = await this.findOne(id);
    const startTime = Date.now();
    
    try {
      const password = this.decrypt(dataSource.password);
      await this.testConnection({
        ...dataSource,
        password,
      } as CreateDataSourceDto);

      const latency = Date.now() - startTime;

      await this.prisma.dataSource.update({
        where: { id },
        data: {
          healthStatus: 'healthy',
          lastHealthCheck: new Date(),
        },
      });

      return {
        isHealthy: true,
        status: 'healthy',
        latency,
        checkedAt: new Date(),
      };
    } catch (error) {
      await this.prisma.dataSource.update({
        where: { id },
        data: {
          healthStatus: 'unhealthy',
          lastHealthCheck: new Date(),
        },
      });

      return {
        isHealthy: false,
        status: 'unhealthy',
        latency: Date.now() - startTime,
        error: error.message,
        checkedAt: new Date(),
      };
    }
  }

  // 통계 조회
  async getStatistics(id: string): Promise<DataSourceStatisticsDto> {
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id },
      include: {
        tables: {
          include: {
            columns: true,
          },
        },
        queries: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            naturalQuery: true,
            status: true,
            executionTime: true,
            createdAt: true,
          },
        },
      },
    });

    if (!dataSource) {
      throw new NotFoundException('데이터소스를 찾을 수 없습니다.');
    }

    const columnCount = dataSource.tables.reduce(
      (sum, table) => sum + table.columns.length,
      0
    );

    return {
      queryCount: dataSource.queryCount,
      avgResponseTime: dataSource.avgResponseTime,
      lastActiveAt: dataSource.lastActiveAt || undefined,
      tableCount: dataSource.tables.length,
      columnCount,
      recentQueries: dataSource.queries,
    };
  }

  // 대시보드 개요
  async getOverview(): Promise<DataSourceOverviewDto> {
    const dataSources = await this.prisma.dataSource.findMany({
      where: { isActive: true },
      select: {
        type: true,
        environment: true,
        healthStatus: true,
      },
    });

    const byType: Record<string, number> = {};
    const byEnvironment: Record<string, number> = {};
    let healthy = 0;
    let unhealthy = 0;
    let unknown = 0;

    dataSources.forEach((ds) => {
      // 타입별 카운트
      byType[ds.type] = (byType[ds.type] || 0) + 1;
      
      // 환경별 카운트
      const env = ds.environment || 'development';
      byEnvironment[env] = (byEnvironment[env] || 0) + 1;
      
      // 상태별 카운트
      if (ds.healthStatus === 'healthy') healthy++;
      else if (ds.healthStatus === 'unhealthy') unhealthy++;
      else unknown++;
    });

    return {
      total: dataSources.length,
      healthy,
      unhealthy,
      unknown,
      byType,
      byEnvironment,
    };
  }

  // 연결 새로고침
  async refreshConnection(id: string): Promise<{ success: boolean; message: string }> {
    const cached = this.connectionCache.get(id);
    if (cached) {
      try {
        const dataSource = await this.prisma.dataSource.findUnique({ where: { id } });
        if (dataSource?.type === 'oracle') {
          await (cached as oracledb.Connection).close();
        } else if (dataSource?.type === 'mysql') {
          await (cached as mysql.Connection).end();
        } else if (dataSource?.type === 'postgresql') {
          await (cached as PgClient).end();
        }
      } catch {
        // Ignore
      }
      this.connectionCache.delete(id);
    }

    // 새 연결 생성 테스트
    const healthCheck = await this.checkHealth(id);
    
    return {
      success: healthCheck.isHealthy,
      message: healthCheck.isHealthy 
        ? '연결이 새로고침되었습니다.'
        : `연결 새로고침 실패: ${healthCheck.error}`,
    };
  }

  // 연결 템플릿
  getConnectionTemplates() {
    return [
      {
        id: 'postgresql-local',
        name: 'PostgreSQL (로컬)',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: 'postgres',
        schema: 'public',
      },
      {
        id: 'postgresql-docker',
        name: 'PostgreSQL (Docker)',
        type: 'postgresql',
        host: 'host.docker.internal',
        port: 5432,
        database: 'postgres',
        schema: 'public',
      },
      {
        id: 'mysql-local',
        name: 'MySQL (로컬)',
        type: 'mysql',
        host: 'localhost',
        port: 3306,
        database: 'mysql',
        schema: 'mysql',
      },
      {
        id: 'oracle-local',
        name: 'Oracle (로컬)',
        type: 'oracle',
        host: 'localhost',
        port: 1521,
        database: 'ORCL',
        schema: 'ORCL',
      },
    ];
  }

  async getConnection(dataSourceId: string): Promise<{ client: DbConnection; type: string }> {
    const cached = this.connectionCache.get(dataSourceId);
    if (cached) {
      const dataSource = await this.prisma.dataSource.findUnique({ where: { id: dataSourceId } });
      return { client: cached, type: dataSource?.type || 'unknown' };
    }

    const dataSource = await this.findOne(dataSourceId);
    const password = this.decrypt(dataSource.password);

    if (dataSource.type === 'postgresql') {
      const client = new PgClient({
        host: dataSource.host,
        port: dataSource.port,
        database: dataSource.database,
        user: dataSource.username,
        password: password,
      });
      await client.connect();
      this.connectionCache.set(dataSourceId, client);
      return { client, type: 'postgresql' };
    } else if (dataSource.type === 'mysql') {
      const connection = await mysql.createConnection({
        host: dataSource.host,
        port: dataSource.port,
        database: dataSource.database,
        user: dataSource.username,
        password: password,
      });
      this.connectionCache.set(dataSourceId, connection);
      return { client: connection, type: 'mysql' };
    } else if (dataSource.type === 'oracle') {
      const connection = await oracledb.getConnection({
        user: dataSource.username,
        password: password,
        connectString: `${dataSource.host}:${dataSource.port}/${dataSource.schema || dataSource.database}`,
      });
      this.connectionCache.set(dataSourceId, connection);
      return { client: connection, type: 'oracle' };
    }

    throw new BadRequestException(`지원하지 않는 데이터베이스 타입: ${dataSource.type}`);
  }

  // 쿼리 실행 통계 업데이트 (다른 서비스에서 호출)
  async updateQueryStats(dataSourceId: string, executionTime: number) {
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id: dataSourceId },
      select: { queryCount: true, avgResponseTime: true },
    });

    if (!dataSource) return;

    const newCount = dataSource.queryCount + 1;
    const newAvg = 
      (dataSource.avgResponseTime * dataSource.queryCount + executionTime) / newCount;

    await this.prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        queryCount: newCount,
        avgResponseTime: Math.round(newAvg * 100) / 100,
        lastActiveAt: new Date(),
      },
    });
  }
}
