'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield,
  Search,
  Download,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Database,
  User,
  Calendar,
  Clock,
  FileText,
  TrendingUp,
  Activity,
  Zap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const SEVERITY_COLORS = {
  INFO: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  WARNING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  DANGER: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  CRITICAL: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const SEVERITY_ICONS = {
  INFO: <Info className="h-4 w-4" />,
  WARNING: <AlertTriangle className="h-4 w-4" />,
  DANGER: <AlertCircle className="h-4 w-4" />,
  CRITICAL: <AlertCircle className="h-4 w-4" />,
};

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const ACTION_TYPE_LABELS: Record<string, string> = {
  DDL_CREATE: 'CREATE',
  DDL_ALTER: 'ALTER',
  DDL_DROP: 'DROP',
  DDL_TRUNCATE: 'TRUNCATE',
  DML_INSERT: 'INSERT',
  DML_UPDATE: 'UPDATE',
  DML_DELETE: 'DELETE',
  QUERY_EXECUTE: 'SELECT',
  AUTH_LOGIN: '로그인',
  AUTH_LOGOUT: '로그아웃',
  AUTH_FAILED: '인증 실패',
  CONFIG_CHANGE: '설정 변경',
  DATA_EXPORT: '데이터 내보내기',
  DESTRUCTIVE_CONFIRM: '파괴적 명령 확인',
};

export default function AuditLogsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  
  // Filters
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState<string>('all');
  const [severity, setSeverity] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'1d' | '7d' | '30d' | 'all'>('7d');

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const end = now.toISOString();
    let start: string | undefined;
    
    switch (dateRange) {
      case '1d':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      default:
        start = undefined;
    }
    
    return { startDate: start, endDate: dateRange !== 'all' ? end : undefined };
  }, [dateRange]);

  // Fetch audit logs
  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ['auditLogs', page, search, actionType, severity, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) params.append('search', search);
      if (actionType && actionType !== 'all') params.append('actionType', actionType);
      if (severity && severity !== 'all') params.append('severity', severity);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const res: any = await api.get(`/admin/audit?${params.toString()}`);
      return res;
    },
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['auditStats', dateRange],
    queryFn: async () => {
      const days = dateRange === '1d' ? 1 : dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 365;
      const res: any = await api.get(`/admin/audit/stats?days=${days}`);
      return res;
    },
  });

  // Fetch action types
  const { data: actionTypes = [] } = useQuery({
    queryKey: ['auditActionTypes'],
    queryFn: async () => {
      const res: any = await api.get('/admin/audit/action-types');
      return res;
    },
  });

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (actionType && actionType !== 'all') params.append('actionType', actionType);
      if (severity && severity !== 'all') params.append('severity', severity);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (search) params.append('search', search);
      
      window.open(`/api/admin/audit/export?${params.toString()}`, '_blank');
      toast({ title: 'CSV 내보내기 시작됨' });
    } catch (error) {
      toast({ title: '내보내기 실패', variant: 'destructive' });
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Stats charts data
  const severityChartData = statsData?.bySeverity?.map((s: any) => ({
    name: s.severity,
    value: s._count,
  })) || [];

  const actionTypeChartData = statsData?.byActionType?.map((a: any) => ({
    name: ACTION_TYPE_LABELS[a.actionType] || a.actionType,
    count: a._count,
  })) || [];

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">보안 감사 로그</h1>
              <p className="text-muted-foreground">모든 시스템 활동을 모니터링하고 추적합니다</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              새로고침
            </Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              CSV 내보내기
            </Button>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-500/20 text-blue-500">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">총 로그</p>
                  <p className="text-2xl font-bold">{logsData?.total || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-yellow-500/20 text-yellow-500">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">경고</p>
                  <p className="text-2xl font-bold">
                    {statsData?.bySeverity?.find((s: any) => s.severity === 'WARNING')?._count || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-500/20 text-orange-500">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">위험</p>
                  <p className="text-2xl font-bold">
                    {statsData?.bySeverity?.find((s: any) => s.severity === 'DANGER')?._count || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-red-500/20 text-red-500">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">치명적</p>
                  <p className="text-2xl font-bold">
                    {statsData?.bySeverity?.find((s: any) => s.severity === 'CRITICAL')?._count || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">작업 유형별 분포</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={actionTypeChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">심각도별 분포</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label
                    >
                      {severityChartData.map((_: any, index: number) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="SQL, 사용자, 테이블 검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                <SelectTrigger className="w-[140px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">최근 1일</SelectItem>
                  <SelectItem value="7d">최근 7일</SelectItem>
                  <SelectItem value="30d">최근 30일</SelectItem>
                  <SelectItem value="all">전체</SelectItem>
                </SelectContent>
              </Select>

              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="작업 유형" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {actionTypes.map((type: string) => (
                    <SelectItem key={type} value={type}>
                      {ACTION_TYPE_LABELS[type] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="심각도" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="INFO">정보</SelectItem>
                  <SelectItem value="WARNING">경고</SelectItem>
                  <SelectItem value="DANGER">위험</SelectItem>
                  <SelectItem value="CRITICAL">치명적</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">시간</TableHead>
                      <TableHead className="w-[100px]">심각도</TableHead>
                      <TableHead className="w-[120px]">작업</TableHead>
                      <TableHead>설명</TableHead>
                      <TableHead className="w-[150px]">사용자</TableHead>
                      <TableHead className="w-[120px]">데이터소스</TableHead>
                      <TableHead className="w-[80px]">결과</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsData?.items?.map((log: any) => (
                      <TableRow 
                        key={log.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedLog(log)}
                      >
                        <TableCell className="font-mono text-xs">
                          {formatDate(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge className={SEVERITY_COLORS[log.severity as keyof typeof SEVERITY_COLORS]}>
                            {SEVERITY_ICONS[log.severity as keyof typeof SEVERITY_ICONS]}
                            <span className="ml-1">{log.severity}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {ACTION_TYPE_LABELS[log.actionType] || log.actionType}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {log.description}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.userEmail || log.userName || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.dataSourceName || '-'}
                        </TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
                              성공
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-500 border-red-500/30">
                              실패
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {(!logsData?.items || logsData.items.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                          감사 로그가 없습니다
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {logsData && logsData.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      총 {logsData.total}개 중 {(page - 1) * 20 + 1}-{Math.min(page * 20, logsData.total)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        {page} / {logsData.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(logsData.totalPages, p + 1))}
                        disabled={page >= logsData.totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                감사 로그 상세
              </DialogTitle>
            </DialogHeader>
            
            {selectedLog && (
              <div className="space-y-4">
                {/* Meta Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">시간</p>
                    <p className="text-sm font-medium">{formatDate(selectedLog.createdAt)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">심각도</p>
                    <Badge className={SEVERITY_COLORS[selectedLog.severity as keyof typeof SEVERITY_COLORS]}>
                      {selectedLog.severity}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">작업 유형</p>
                    <Badge variant="outline">{ACTION_TYPE_LABELS[selectedLog.actionType] || selectedLog.actionType}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">결과</p>
                    <Badge className={selectedLog.success ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}>
                      {selectedLog.success ? '성공' : '실패'}
                    </Badge>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">설명</p>
                  <p className="text-sm">{selectedLog.description}</p>
                </div>

                {/* SQL Query */}
                {selectedLog.sqlQuery && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">SQL 쿼리</p>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto font-mono">
                      {selectedLog.sqlQuery}
                    </pre>
                  </div>
                )}

                {/* User Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">사용자</p>
                    <p className="text-sm">{selectedLog.userEmail || selectedLog.userName || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">IP 주소</p>
                    <p className="text-sm font-mono">{selectedLog.ipAddress || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">데이터소스</p>
                    <p className="text-sm">{selectedLog.dataSourceName || '-'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">영향받은 행</p>
                    <p className="text-sm">{selectedLog.affectedRows ?? '-'}</p>
                  </div>
                </div>

                {/* Error Message */}
                {selectedLog.errorMessage && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">에러 메시지</p>
                    <p className="text-sm text-red-500 bg-red-500/10 p-3 rounded-lg">
                      {selectedLog.errorMessage}
                    </p>
                  </div>
                )}

                {/* Execution Time */}
                {selectedLog.executionTime && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">실행 시간</p>
                    <p className="text-sm">{selectedLog.executionTime}ms</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
