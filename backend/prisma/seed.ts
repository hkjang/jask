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

  // 7. 샘플 쿼리 시드 데이터 (EmbeddableItem 동기화 포함)
  const sampleQueries = [
    {
      question: '활성 사용자 수는 몇 명인가요?',
      sql: 'SELECT count(*) FROM "User" WHERE "isActive" = true',
      description: 'Find count of active users',
    },
    {
      question: '어제 실행된 쿼리 중 실패한 것은 무엇인가요?',
      sql: "SELECT * FROM \"QueryHistory\" WHERE \"status\" = 'FAILED' AND \"createdAt\" >= NOW() - INTERVAL '1 DAY'",
      description: 'Recent failed queries from last 24h',
    },
    {
      question: 'PostgreSQL 타입의 데이터소스 목록을 보여주세요.',
      sql: "SELECT name, host, port FROM \"DataSource\" WHERE type = 'Postgresql'",
      description: 'List PostgreSQL data sources',
    },
    {
      question: '평균 응답 속도가 1초(1000ms) 이상인 느린 쿼리를 찾아줘.',
      sql: 'SELECT * FROM "QueryHistory" WHERE "executionTime" >= 1000',
      description: 'Slow queries exceeding 1000ms',
    },
    {
      question: '관리자 권한을 가진 사용자 목록은?',
      sql: "SELECT email, name FROM \"User\" WHERE role = 'ADMIN'",
      description: 'List usage with ADMIN role',
    },
    // New 10 Queries
    {
      question: '현재 시스템의 기본 쿼리 제한(limit) 설정값은 얼마인가요?',
      sql: "SELECT value FROM \"SystemSettings\" WHERE key = 'default_limit'",
      description: 'Get default query limit setting',
    },
    {
      question: '비활성화 상태인 데이터소스가 있나요?',
      sql: "SELECT name, type FROM \"DataSource\" WHERE \"isActive\" = false",
      description: 'Find inactive data sources',
    },
    {
      question: '위험도가 높음(HIGH) 이상으로 감지된 쿼리 내역을 보여주세요.',
      sql: "SELECT * FROM \"QueryHistory\" WHERE \"riskLevel\" IN ('HIGH', 'CRITICAL') ORDER BY \"createdAt\" DESC",
      description: 'High risk queries',
    },
    {
      question: '사용자들에게 긍정적인 피드백을 받은 쿼리는 무엇인가요?',
      sql: "SELECT \"naturalQuery\", \"generatedSql\" FROM \"QueryHistory\" WHERE feedback = 'POSITIVE'",
      description: 'Positive feedback queries',
    },
    {
      question: '현재 기본으로 설정된 임베딩 모델 정보',
      sql: "SELECT name, \"embeddingModel\" FROM \"LLMProvider\" WHERE \"isEmbeddingDefault\" = true",
      description: 'Default embedding model info',
    },
    {
      question: '가장 많이 사용된 즐겨찾기 쿼리 Top 3를 알려줘.',
      sql: "SELECT name, \"useCount\" FROM \"FavoriteQuery\" ORDER BY \"useCount\" DESC LIMIT 3",
      description: 'Top 3 favorite queries',
    },
    {
      question: '데이터소스별 평균 응답 속도가 가장 느린 곳은 어디인가요?',
      sql: "SELECT name, type, \"avgResponseTime\" FROM \"DataSource\" ORDER BY \"avgResponseTime\" DESC LIMIT 1",
      description: 'Slowest data source by average response time',
    },
    {
      question: '아직 임베딩 벡터가 생성되지 않은 항목은 몇 개나 되나요?',
      sql: "SELECT count(*) FROM \"EmbeddableItem\" WHERE embedding IS NULL AND \"isActive\" = true",
      description: 'Count of items pending embedding',
    },
    {
      question: '최근 발생한 쿼리 에러 메시지 5개를 확인하고 싶어요.',
      sql: "SELECT \"errorMessage\", \"createdAt\" FROM \"QueryHistory\" WHERE status = 'FAILED' ORDER BY \"createdAt\" DESC LIMIT 5",
      description: 'Recent query errors',
    },
    {
      question: '지난 달에 가입한 사용자 중 관리자가 아닌 사람은 누구인가요?',
      sql: "SELECT email, name, \"createdAt\" FROM \"User\" WHERE role = 'USER' AND \"createdAt\" >= NOW() - INTERVAL '1 MONTH'",
      description: 'New normal users from last month',
    }
  ];

  console.log('🌱 Seeding Sample Queries...');

  for (const sample of sampleQueries) {
      // 1. Create SampleQuery
      const createdSample = await prisma.sampleQuery.create({
          data: {
              dataSourceId: demoDataSource.id,
              naturalQuery: sample.question,
              sqlQuery: sample.sql,
              description: sample.description,
              isVerified: true
          }
      });

      // 2. Create EmbeddableItem (Manual Sync for Seed)
      // Note: We cannot generate vectors here easily without calling the LLM Service,
      // so we leave them empty. Use "Batch Embedding" in Admin UI to generate vectors.
      await prisma.embeddableItem.create({
          data: {
              type: 'SAMPLE_QUERY',
              sourceId: createdSample.id,
              content: sample.question, // Optimize for similarity: Use ONLY the question
              dataSourceId: demoDataSource.id,
              metadata: {
                  sql: sample.sql,
                  question: sample.question,
                  description: sample.description
              },
              isActive: true
          }
      });
  }
  console.log(`✅ Created ${sampleQueries.length} Sample Queries (Need Batch Embedding in UI)`);

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
