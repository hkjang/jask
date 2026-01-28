'use client';

import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { Clock, CheckCircle, XCircle, AlertTriangle, ArrowLeft, Copy, Play } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

export default function QueryHistoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params?.id as string;

  const { data: query, isLoading, error } = useQuery({
    queryKey: ['queryHistoryDetail', id],
    queryFn: async () => {
      const res: any = await api.getQueryById(id);
      return res;
    },
    enabled: !!id,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'BLOCKED':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SUCCESS': return '성공';
      case 'FAILED': return '실패';
      case 'BLOCKED': return '차단됨';
      case 'PENDING': return '대기 중';
      case 'EXECUTING': return '실행 중';
      default: return status;
    }
  };

  const copySQL = (sql: string) => {
    navigator.clipboard.writeText(sql);
    toast({ title: 'SQL이 복사되었습니다' });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container max-w-4xl py-8">
           <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">쿼리 상세 정보</h1>
          </div>
          <div className="text-center py-12 text-muted-foreground">
            로딩 중...
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error || !query) {
    return (
      <MainLayout>
        <div className="container max-w-4xl py-8">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">쿼리 상세 정보</h1>
          </div>
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
            <CardContent className="py-12 text-center text-red-600 dark:text-red-400">
              <XCircle className="h-12 w-12 mx-auto mb-4" />
              <p>쿼리 정보를 불러오는데 실패했습니다.</p>
              <p className="text-sm mt-2 opacity-80">{(error as Error)?.message || '알 수 없는 오류'}</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-4xl py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">쿼리 상세 정보</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(query.createdAt).toLocaleString('ko-KR')} · {query.dataSource?.name || '알 수 없는 데이터소스'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
             <Badge variant={query.status === 'SUCCESS' ? 'default' : query.status === 'FAILED' ? 'destructive' : 'secondary'} className="flex gap-1 items-center">
                {getStatusIcon(query.status)}
                {getStatusLabel(query.status)}
             </Badge>
          </div>
        </div>

        <div className="space-y-6">
          {/* Natural Query */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">질문</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">{query.naturalQuery}</p>
            </CardContent>
          </Card>

          {/* Generated SQL */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">생성된 SQL</CardTitle>
              <Button variant="outline" size="sm" onClick={() => copySQL(query.generatedSql)}>
                <Copy className="h-4 w-4 mr-2" />
                복사
              </Button>
            </CardHeader>
            <CardContent>
               <div className="rounded-md overflow-hidden border">
                <SyntaxHighlighter
                  language="sql"
                  style={vscDarkPlus}
                  customStyle={{ margin: 0, borderRadius: 0 }}
                  showLineNumbers
                >
                  {query.generatedSql}
                </SyntaxHighlighter>
              </div>
            </CardContent>
          </Card>

           {/* Result Summary */}
           {(query.rowCount !== null || query.executionTime) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">실행 결과</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {query.rowCount !== null && (
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">결과 행 수</span>
                    <span className="text-2xl font-semibold">{query.rowCount.toLocaleString()}행</span>
                  </div>
                )}
                {query.executionTime && (
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">실행 시간</span>
                    <span className="text-2xl font-semibold">{query.executionTime}ms</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Error Message if Failed */}
          {query.status === 'FAILED' && query.errorMessage && (
             <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
              <CardHeader>
                <CardTitle className="text-lg text-red-600 dark:text-red-400">오류 메시지</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono">
                  {query.errorMessage}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
