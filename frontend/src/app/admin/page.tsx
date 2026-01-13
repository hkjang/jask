'use client';

import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import {
  Users,
  Database,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: async () => {
      const result: any = await api.getDashboard();
      return result;
    },
  });

  const stats = [
    { label: '총 사용자', value: data?.totalUsers || 0, icon: Users, color: 'text-blue-500' },
    { label: '총 질문', value: data?.totalQueries || 0, icon: MessageSquare, color: 'text-green-500' },
    { label: '데이터소스', value: data?.totalDataSources || 0, icon: Database, color: 'text-purple-500' },
  ];

  const queryStats = [
    { label: '성공', value: data?.queryStats?.SUCCESS || 0, icon: CheckCircle, color: 'bg-green-500' },
    { label: '실패', value: data?.queryStats?.FAILED || 0, icon: XCircle, color: 'bg-red-500' },
    { label: '차단', value: data?.queryStats?.BLOCKED || 0, icon: AlertTriangle, color: 'bg-yellow-500' },
  ];

  const chartData = queryStats.map(s => ({ name: s.label, value: s.value }));

  return (
    <MainLayout>
      <div className="container max-w-6xl py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">관리자 대시보드</h1>
          <p className="text-muted-foreground">서비스 현황을 확인하세요</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">로딩 중...</div>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {stats.map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="flex items-center gap-4 py-6">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-muted ${stat.color}`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Query Stats Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    쿼리 상태 분포
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Recent Queries */}
              <Card>
                <CardHeader>
                  <CardTitle>최근 질문</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data?.recentQueries?.slice(0, 5).map((q: any) => (
                      <div key={q.id} className="flex items-start justify-between text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{q.naturalQuery}</p>
                          <p className="text-muted-foreground text-xs">
                            {q.user?.name} · {new Date(q.createdAt).toLocaleString('ko-KR')}
                          </p>
                        </div>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                          q.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                          q.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {q.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
