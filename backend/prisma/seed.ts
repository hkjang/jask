import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. 관리자 사용자 생성
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jask.io' },
    update: {},
    create: {
      email: 'admin@jask.io',
      password: adminPassword,
      name: '관리자',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // 2. 테스트 사용자 생성
  const userPassword = await bcrypt.hash('user123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@jask.io' },
    update: {},
    create: {
      email: 'user@jask.io',
      password: userPassword,
      name: '테스트 사용자',
      role: 'USER',
    },
  });
  console.log('✅ Test user created:', user.email);

  // 3. 기본 LLM 프로바이더 설정
  const ollamaProvider = await prisma.lLMProvider.upsert({
    where: { name: 'ollama' },
    update: {
      embeddingModel: 'bona/bge-m3-korean',
      isEmbeddingDefault: true,
    },
    create: {
      name: 'ollama',
      baseUrl: 'http://localhost:11434',
      model: 'gpt-oss:20b',
      embeddingModel: 'bona/bge-m3-korean',
      isActive: true,
      isDefault: true,
      isEmbeddingDefault: true,
    },
  });
  console.log('✅ Ollama provider created:', ollamaProvider.name);

  const vllmProvider = await prisma.lLMProvider.upsert({
    where: { name: 'vllm' },
    update: {},
    create: {
      name: 'vllm',
      baseUrl: 'https://vllm.koreacb.com',
      model: 'gptoss',
      isActive: false,
      isDefault: false,
      isEmbeddingDefault: false,
    },
  });
  console.log('✅ vLLM provider created:', vllmProvider.name);

  // 4. 시스템 설정
  const settings = [
    { key: 'default_limit', value: 100, description: '기본 쿼리 결과 제한' },
    { key: 'max_limit', value: 1000, description: '최대 쿼리 결과 제한' },
    { key: 'query_timeout', value: 30000, description: '쿼리 타임아웃 (ms)' },
    { key: 'enable_sql_validation', value: true, description: 'SQL 검증 활성화' },
  ];

  for (const setting of settings) {
    await prisma.systemSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log('✅ System settings created');

  // 5. 데모 데이터소스 (Jask 내부 DB)
  const demoDataSource = await prisma.dataSource.upsert({
    where: { id: 'demo-jask-db' },
    update: {},
    create: {
      id: 'demo-jask-db',
      name: 'Jask Demo DB',
      type: 'Postgresql',
      host: 'localhost',
      port: 5432,
      database: 'jask',
      username: 'jask',
      password: 'jask_password',
      isActive: true,
    },
  });
  console.log('✅ Demo DataSource created:', demoDataSource.name);

  // Oracle XE 데이터소스
  const oracleDataSource = await prisma.dataSource.upsert({
    where: { id: 'oracle-xe-db' },
    update: {},
    create: {
      id: 'oracle-xe-db',
      name: 'Oracle XE',
      type: 'Oracle',
      host: 'localhost',
      port: 1521,
      schema: 'XE',
      database: 'XE',
      username: 'xe',
      password: 'xe',
      isActive: true,
    },
  });
  console.log('✅ Oracle XE DataSource created:', oracleDataSource.name);

  // 6. 데모 데이터소스 테이블 메타데이터 (Prisma 스키마 기반)
  const tables = [
    { name: 'User', description: '사용자 정보 테이블', columns: ['id', 'email', 'name', 'role', 'isActive', 'createdAt'] },
    { name: 'DataSource', description: '데이터소스 연결 정보', columns: ['id', 'name', 'type', 'host', 'port', 'database', 'isActive'] },
    { name: 'QueryHistory', description: '쿼리 실행 이력', columns: ['id', 'naturalQuery', 'generatedSQL', 'status', 'createdAt'] },
    { name: 'LLMProvider', description: 'LLM 프로바이더 설정', columns: ['id', 'name', 'baseUrl', 'model', 'isActive', 'isDefault'] },
  ];

  for (const table of tables) {
    const tableRecord = await prisma.tableMetadata.upsert({
      where: {
        dataSourceId_schemaName_tableName: {
          dataSourceId: demoDataSource.id,
          schemaName: 'public',
          tableName: table.name,
        },
      },
      update: { description: table.description },
      create: {
        dataSourceId: demoDataSource.id,
        schemaName: 'public',
        tableName: table.name,
        description: table.description,
      },
    });

    for (const col of table.columns) {
      await prisma.columnMetadata.upsert({
        where: {
          tableId_columnName: {
            tableId: tableRecord.id,
            columnName: col,
          },
        },
        update: {},
        create: {
          tableId: tableRecord.id,
          columnName: col,
          dataType: 'text',
          isNullable: true,
        },
      });
    }
  }
  console.log('✅ Demo table metadata created');

  console.log('\n🎉 Seeding completed!');
  console.log('\n📋 Test Accounts:');
  console.log('  Admin: admin@jask.io / admin123');
  console.log('  User:  user@jask.io / user123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
