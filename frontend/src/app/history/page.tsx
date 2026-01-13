'use client';

import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { Clock, CheckCircle, XCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import Link from 'next/link';

export default function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['queryHistory'],
    queryFn: async () => {
         const res: any = await api.getQueryHistory({ limit: 50 });
         return res;
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'BLOCKED':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SUCCESS': return '성공';
      case 'FAILED': return '실패';
      case 'BLOCKED': return '차단';
      case 'PENDING': return '대기';
      case 'EXECUTING': return '실행중';
      default: return status;
    }
  };

  return (
    <MainLayout>
      <div className="container max-w-5xl py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">질문 히스토리</h1>
          <p className="text-muted-foreground">이전에 했던 질문들을 확인하세요</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            로딩 중...
          </div>
        ) : data?.items?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">아직 질문 히스토리가 없습니다</p>
              <Link href="/query" className="text-primary hover:underline">
                첫 질문 하러 가기 →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {data?.items?.map((query: any) => (
              <Card key={query.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base font-medium">
                        {query.naturalQuery}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {query.dataSource?.name} · {new Date(query.createdAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(query.status)}
                      <span className="text-sm">{getStatusLabel(query.status)}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm bg-muted p-3 rounded-lg overflow-x-auto font-mono">
                    {query.generatedSql}
                  </pre>
                  {query.rowCount !== null && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {query.rowCount}개 결과 · {query.executionTime}ms
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
