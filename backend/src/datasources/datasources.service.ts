import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDataSourceDto, UpdateDataSourceDto } from './dto/datasources.dto';
import { Client as PgClient } from 'pg';
import * as mysql from 'mysql2/promise';
import oracledb from 'oracledb';

export type DbConnection = PgClient | mysql.Connection | oracledb.Connection;

@Injectable()
export class DataSourcesService {
  private connectionCache = new Map<string, DbConnection>();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

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
        password: dto.password, // TODO: 암호화
        schema: dto.schema || 'public',
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
        isActive: true,
        createdAt: true,
        _count: {
          select: { tables: true },
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

    return this.prisma.dataSource.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // 연결 캐시에서 제거
    this.connectionCache.delete(id);

    return this.prisma.dataSource.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async testConnection(config: CreateDataSourceDto): Promise<boolean> {
    try {
      if (config.type === 'postgresql') {
        const client = new PgClient({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
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

  async getConnection(dataSourceId: string): Promise<{ client: DbConnection; type: string }> {
    const cached = this.connectionCache.get(dataSourceId);
    if (cached) {
      const dataSource = await this.prisma.dataSource.findUnique({ where: { id: dataSourceId } });
      return { client: cached, type: dataSource?.type || 'unknown' };
    }

    const dataSource = await this.findOne(dataSourceId);

    if (dataSource.type === 'postgresql') {
      const client = new PgClient({
        host: dataSource.host,
        port: dataSource.port,
        database: dataSource.database,
        user: dataSource.username,
        password: dataSource.password,
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
        password: dataSource.password,
      });
      this.connectionCache.set(dataSourceId, connection);
      return { client: connection, type: 'mysql' };
    } else if (dataSource.type === 'oracle') {
      const connection = await oracledb.getConnection({
        user: dataSource.username,
        password: dataSource.password,
        connectString: `${dataSource.host}:${dataSource.port}/${dataSource.schema || dataSource.database}`,
      });
      this.connectionCache.set(dataSourceId, connection);
      return { client: connection, type: 'oracle' };
    }

    throw new BadRequestException(`지원하지 않는 데이터베이스 타입: ${dataSource.type}`);
  }
}
