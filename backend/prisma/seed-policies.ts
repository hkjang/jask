
import { PrismaClient, PolicyArea, ExecutionMethod } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Policy Rules...');

  // 1. Triggers
  // --------------------------------------------------------------------------
  const TRIGGERS = [
    {
      name: 'Low Utilization',
      metric: 'utilization_score',
      operator: 'LT',
      threshold: 20, // 20%
      windowSeconds: 604800, // 7 days
      description: 'Recent utilization dropped below 20%',
    },
    {
      name: 'High Error Rate',
      metric: 'error_rate',
      operator: 'GT',
      threshold: 5, // 5% (Example)
      windowSeconds: 3600,
      description: 'Error rate exceeded threshold',
    },
    {
      name: 'Low Trust',
      metric: 'trust_score',
      operator: 'LT',
      threshold: 50,
      windowSeconds: 86400,
      description: 'Trust score is low',
    },
    {
      name: 'High Trust',
      metric: 'trust_score',
      operator: 'GT',
      threshold: 90,
      windowSeconds: 86400,
      description: 'Trust score is verified high',
    },
    {
      name: 'High Rework',
      metric: 'rework_index',
      operator: 'GT',
      threshold: 3, // 3 consecutive reworks
      windowSeconds: 3600,
      description: 'Frequent modifications by user',
    }
  ];

  const triggerMap = new Map();

  for (const t of TRIGGERS) {
    // Check existing or create
    const trigger = await prisma.policyTrigger.create({
      data: {
        name: t.name,
        metric: t.metric,
        operator: t.operator,
        threshold: t.threshold,
        windowSeconds: t.windowSeconds,
        description: t.description
      }
    });
    triggerMap.set(t.name, trigger.id);
    console.log(`Created Trigger: ${t.name}`);
  }

  // 2. Rules (Matrix)
  // --------------------------------------------------------------------------
  /*
    조건 조합	적용 룰	조정 내용
    낮은 활용도 + 높은 오류	안정화 룰	자동 실행 비활성화
    높은 신뢰도 + 낮은 오류	자동화 강화 룰	무확인 실행 허용
    낮은 숙련도 + 높은 재작업	가이드 강화 룰	설명형 응답 우선
    높은 숙련도 + 빠른 세션	효율화 룰	요약 응답 기본
    빈번한 검색 실패	탐색 개선 룰	메타 추천 강화
  */

  const RULES = [
    {
      name: 'Stabilization Rule',
      area: PolicyArea.OPERATION,
      triggerNames: ['Low Utilization', 'High Error Rate'], 
      targetParameter: 'auto_execute_enabled',
      adjustmentValue: { value: false }, // Disable auto execution
      method: ExecutionMethod.IMMEDIATE,
    },
    {
      name: 'Automation Enhancement Rule',
      area: PolicyArea.AI,
      triggerNames: ['High Trust'], // Simplified for seed (Assumption: Low Error is implied or we'd need composite trigger logic which is complex for now)
      targetParameter: 'require_confirmation',
      adjustmentValue: { value: false }, // Allow no-confirm
      method: ExecutionMethod.PHASED,
    },
    {
      name: 'Guide Enhancement Rule',
      area: PolicyArea.UX,
      triggerNames: ['High Rework'], 
      targetParameter: 'response_verbosity',
      adjustmentValue: { value: 'VERBOSE' }, // Explain more
      method: ExecutionMethod.IMMEDIATE,
    }
  ];

  for (const r of RULES) {
    const connectedTriggers = r.triggerNames
      .map(name => triggerMap.get(name))
      .filter(id => !!id)
      .map(id => ({ id }));

    if (connectedTriggers.length === 0) {
        console.warn(`skipping rule ${r.name}, no triggers found`);
        continue;
    }

    await prisma.policyAdjustmentRule.create({
      data: {
        name: r.name,
        area: r.area,
        targetParameter: r.targetParameter,
        adjustmentValue: r.adjustmentValue,
        method: r.method,
        triggers: {
            connect: connectedTriggers
        }
      }
    });
    console.log(`Created Rule: ${r.name}`);
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
