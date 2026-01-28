'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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
  DialogFooter,
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
  Bell,
  BellRing,
  CheckCircle,
  XCircle,
  Eye,
  Gauge,
  Users,
  Activity,
  Zap,
  TrendingUp,
  Clock,
  Globe,
  Smartphone,
  Monitor,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  FileText,
  Database,
  HelpCircle,
  Key,
  UserCog,
  Server,
  Cpu,
  Lock,
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
  LineChart,
  Line,
} from 'recharts';

const SEVERITY_COLORS = {
  INFO: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  WARNING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  DANGER: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
  CRITICAL: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  INFO: <Info className="h-4 w-4" />,
  WARNING: <AlertTriangle className="h-4 w-4" />,
  DANGER: <AlertCircle className="h-4 w-4" />,
  CRITICAL: <ShieldAlert className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  AUTH: 'bg-purple-500/10 text-purple-500 border-purple-500/30',
  DATA: 'bg-green-500/10 text-green-500 border-green-500/30',
  ADMIN: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  SYSTEM: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  AI: 'bg-pink-500/10 text-pink-500 border-pink-500/30',
  QUERY: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30',
  SECURITY: 'bg-red-500/10 text-red-500 border-red-500/30',
};

const CATEGORY_LABELS: Record<string, string> = {
  AUTH: '인증',
  DATA: '데이터',
  ADMIN: '관리',
  SYSTEM: '시스템',
  AI: 'AI',
  QUERY: '쿼리',
  SECURITY: '보안',
};

const ALERT_STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-500/10 text-red-500 border-red-500/30',
  ACKNOWLEDGED: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
  RESOLVED: 'bg-green-500/10 text-green-500 border-green-500/30',
  DISMISSED: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
};

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

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
  AUTH_PASSWORD_CHANGE: '비밀번호 변경',
  AUTH_PASSWORD_RESET: '비밀번호 초기화',
  PERMISSION_GRANT: '권한 부여',
  PERMISSION_REVOKE: '권한 회수',
  ROLE_CHANGE: '역할 변경',
  USER_CREATE: '사용자 생성',
  USER_UPDATE: '사용자 수정',
  USER_DELETE: '사용자 삭제',
  USER_ACTIVATE: '사용자 활성화',
  USER_DEACTIVATE: '사용자 비활성화',
  SENSITIVE_DATA_ACCESS: '민감 데이터 접근',
  BULK_DATA_ACCESS: '대량 데이터 접근',
  DATA_EXPORT: '데이터 내보내기',
  DATA_IMPORT: '데이터 가져오기',
  SYSTEM_STARTUP: '시스템 시작',
  SYSTEM_SHUTDOWN: '시스템 종료',
  BACKUP_CREATE: '백업 생성',
  BACKUP_RESTORE: '백업 복원',
  API_KEY_CREATE: 'API 키 생성',
  API_KEY_REVOKE: 'API 키 폐기',
  RATE_LIMIT_EXCEEDED: '속도 제한 초과',
  UNAUTHORIZED_ACCESS: '비인가 접근',
  SESSION_TIMEOUT: '세션 만료',
  SESSION_HIJACK_ATTEMPT: '세션 하이재킹 시도',
  CONCURRENT_LOGIN: '동시 로그인',
  SESSION_TERMINATED: '세션 종료',
  CONFIG_CHANGE: '설정 변경',
  DATASOURCE_CREATE: '데이터소스 생성',
  DATASOURCE_UPDATE: '데이터소스 수정',
  DATASOURCE_DELETE: '데이터소스 삭제',
  METADATA_VIEW: '메타데이터 조회',
  METADATA_MODIFY: '메타데이터 수정',
  SCHEMA_SYNC: '스키마 동기화',
  FAVORITE_CREATE: '즐겨찾기 추가',
  FAVORITE_DELETE: '즐겨찾기 삭제',
  AI_QUERY_GENERATE: 'AI 쿼리 생성',
  AI_MODEL_CHANGE: 'AI 모델 변경',
  AI_PROMPT_MODIFY: 'AI 프롬프트 수정',
  DESTRUCTIVE_CONFIRM: '파괴적 작업 확인',
  DESTRUCTIVE_REJECT: '파괴적 작업 거부',
};

function RiskScoreBadge({ score }: { score: number }) {
  let color = 'bg-green-500/10 text-green-500';
  let icon = <ShieldCheck className="h-3 w-3" />;
  
  if (score >= 80) {
    color = 'bg-red-500/10 text-red-500';
    icon = <ShieldAlert className="h-3 w-3" />;
  } else if (score >= 50) {
    color = 'bg-orange-500/10 text-orange-500';
    icon = <AlertTriangle className="h-3 w-3" />;
  } else if (score >= 25) {
    color = 'bg-yellow-500/10 text-yellow-500';
    icon = <AlertCircle className="h-3 w-3" />;
  }
  
  return (
    <Badge className={`${color} gap-1`}>
      {icon}
      <span>{score}</span>
    </Badge>
  );
}

export default function AuditLogsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('logs');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);
  const [resolveDialog, setResolveDialog] = useState(false);
  const [resolution, setResolution] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  
  // Filters
  const [search, setSearch] = useState('');
  const [actionType, setActionType] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [severity, setSeverity] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'1d' | '7d' | '30d' | 'all'>('7d');
  const [minRiskScore, setMinRiskScore] = useState<string>('0');

  // Alert Filters
  const [alertPage, setAlertPage] = useState(1);
  const [alertStatus, setAlertStatus] = useState<string>('all');

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
    queryKey: ['auditLogs', page, search, actionType, category, severity, startDate, endDate, minRiskScore],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) params.append('search', search);
      if (actionType && actionType !== 'all') params.append('actionType', actionType);
      if (category && category !== 'all') params.append('category', category);
      if (severity && severity !== 'all') params.append('severity', severity);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (minRiskScore && parseInt(minRiskScore) > 0) params.append('minRiskScore', minRiskScore);
      
      const res: any = await api.get(`/admin/audit?${params.toString()}`);
      return res;
    },
  });

  // Fetch security alerts
  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['securityAlerts', alertPage, alertStatus, severity, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: alertPage.toString(),
        limit: '20',
      });
      if (alertStatus && alertStatus !== 'all') params.append('status', alertStatus);
      if (severity && severity !== 'all') params.append('severity', severity);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const res: any = await api.get(`/admin/audit/security-alerts?${params.toString()}`);
      return res;
    },
    enabled: activeTab === 'alerts',
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

  // Fetch anomalies
  const { data: anomaliesData } = useQuery({
    queryKey: ['auditAnomalies', dateRange],
    queryFn: async () => {
      const days = dateRange === '1d' ? 1 : dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 365;
      const res: any = await api.get(`/admin/audit/anomalies?days=${days}`);
      return res;
    },
    enabled: activeTab === 'anomalies',
  });

  // Fetch action types
  const { data: actionTypes = [] } = useQuery({
    queryKey: ['auditActionTypes'],
    queryFn: async () => {
      const res: any = await api.get('/admin/audit/action-types');
      return res;
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['auditCategories'],
    queryFn: async () => {
      const res: any = await api.get('/admin/audit/categories');
      return res;
    },
  });

  // Alert mutations
  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => api.put(`/admin/audit/security-alerts/${alertId}/acknowledge`),
    onSuccess: () => {
      toast({ title: '경고가 확인되었습니다' });
      queryClient.invalidateQueries({ queryKey: ['securityAlerts'] });
      setSelectedAlert(null);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: ({ alertId, resolution }: { alertId: string; resolution: string }) =>
      api.put(`/admin/audit/security-alerts/${alertId}/resolve`, { resolution }),
    onSuccess: () => {
      toast({ title: '경고가 해결되었습니다' });
      queryClient.invalidateQueries({ queryKey: ['securityAlerts'] });
      setResolveDialog(false);
      setSelectedAlert(null);
      setResolution('');
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (alertId: string) => api.put(`/admin/audit/security-alerts/${alertId}/dismiss`),
    onSuccess: () => {
      toast({ title: '경고가 무시되었습니다' });
      queryClient.invalidateQueries({ queryKey: ['securityAlerts'] });
      setSelectedAlert(null);
    },
  });

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (actionType && actionType !== 'all') params.append('actionType', actionType);
      if (category && category !== 'all') params.append('category', category);
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

  const categoryChartData = statsData?.byCategory?.map((c: any) => ({
    name: CATEGORY_LABELS[c.category] || c.category,
    count: c._count,
  })) || [];

  const actionTypeChartData = statsData?.byActionType?.slice(0, 10).map((a: any) => ({
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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">보안 감사 로그</h1>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setHelpOpen(true)}
                >
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                </Button>
              </div>
              <p className="text-muted-foreground">시스템 활동 모니터링 및 보안 감사</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {statsData?.openAlerts > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setActiveTab('alerts')}
                className="gap-2"
              >
                <BellRing className="h-4 w-4" />
                미해결 경고 {statsData.openAlerts}건
              </Button>
            )}
            <Button variant="outline" onClick={() => { refetch(); refetchAlerts(); }}>
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
        <div className="grid gap-4 md:grid-cols-5">
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

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-500/20 text-purple-500">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">미해결 경고</p>
                  <p className="text-2xl font-bold">{statsData?.openAlerts || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="logs" className="gap-2">
              <FileText className="h-4 w-4" />
              감사 로그
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Bell className="h-4 w-4" />
              보안 경고
              {statsData?.openAlerts > 0 && (
                <Badge className="ml-1 bg-red-500 text-white">{statsData.openAlerts}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="gap-2">
              <ShieldAlert className="h-4 w-4" />
              이상 탐지
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              분석
            </TabsTrigger>
          </TabsList>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
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
                      <Clock className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1d">최근 1일</SelectItem>
                      <SelectItem value="7d">최근 7일</SelectItem>
                      <SelectItem value="30d">최근 30일</SelectItem>
                      <SelectItem value="all">전체</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="카테고리" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {categories.map((cat: string) => (
                        <SelectItem key={cat} value={cat}>
                          {CATEGORY_LABELS[cat] || cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={actionType} onValueChange={setActionType}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="작업 유형" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="all">전체</SelectItem>
                      {actionTypes.map((type: string) => (
                        <SelectItem key={type} value={type}>
                          {ACTION_TYPE_LABELS[type] || type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger className="w-[130px]">
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

                  <Select value={minRiskScore} onValueChange={setMinRiskScore}>
                    <SelectTrigger className="w-[140px]">
                      <Gauge className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="최소 위험도" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">전체</SelectItem>
                      <SelectItem value="25">25점 이상</SelectItem>
                      <SelectItem value="50">50점 이상</SelectItem>
                      <SelectItem value="75">75점 이상</SelectItem>
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
                          <TableHead className="w-[160px]">시간</TableHead>
                          <TableHead className="w-[80px]">심각도</TableHead>
                          <TableHead className="w-[80px]">카테고리</TableHead>
                          <TableHead className="w-[120px]">작업</TableHead>
                          <TableHead>설명</TableHead>
                          <TableHead className="w-[130px]">사용자</TableHead>
                          <TableHead className="w-[70px]">위험도</TableHead>
                          <TableHead className="w-[70px]">결과</TableHead>
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
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={CATEGORY_COLORS[log.category as keyof typeof CATEGORY_COLORS] || 'bg-gray-500/10'}>
                                {CATEGORY_LABELS[log.category] || log.category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {ACTION_TYPE_LABELS[log.actionType] || log.actionType}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[250px] truncate text-sm">
                              {log.description}
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.userEmail || log.userName || '-'}
                            </TableCell>
                            <TableCell>
                              <RiskScoreBadge score={log.riskScore} />
                            </TableCell>
                            <TableCell>
                              {log.success ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        
                        {(!logsData?.items || logsData.items.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
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
          </TabsContent>

          {/* Security Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Select value={alertStatus} onValueChange={setAlertStatus}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="상태" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="OPEN">미해결</SelectItem>
                      <SelectItem value="ACKNOWLEDGED">확인됨</SelectItem>
                      <SelectItem value="RESOLVED">해결됨</SelectItem>
                      <SelectItem value="DISMISSED">무시됨</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                {alertsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[160px]">시간</TableHead>
                        <TableHead className="w-[80px]">심각도</TableHead>
                        <TableHead className="w-[120px]">유형</TableHead>
                        <TableHead>제목</TableHead>
                        <TableHead className="w-[130px]">사용자</TableHead>
                        <TableHead className="w-[100px]">상태</TableHead>
                        <TableHead className="w-[100px]">작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alertsData?.items?.map((alert: any) => (
                        <TableRow key={alert.id}>
                          <TableCell className="font-mono text-xs">
                            {formatDate(alert.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge className={SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS]}>
                              {SEVERITY_ICONS[alert.severity as keyof typeof SEVERITY_ICONS]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{alert.alertType}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[250px] truncate">
                            {alert.title}
                          </TableCell>
                          <TableCell className="text-sm">
                            {alert.userEmail || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={ALERT_STATUS_COLORS[alert.status]}>
                              {alert.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setSelectedAlert(alert)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {alert.status === 'OPEN' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => acknowledgeMutation.mutate(alert.id)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {(!alertsData?.items || alertsData.items.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                            보안 경고가 없습니다
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}

                {/* Alert Pagination */}
                {alertsData && alertsData.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      총 {alertsData.total}개 중 {(alertPage - 1) * 20 + 1}-{Math.min(alertPage * 20, alertsData.total)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAlertPage(p => Math.max(1, p - 1))}
                        disabled={alertPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        {alertPage} / {alertsData.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAlertPage(p => Math.min(alertsData.totalPages, p + 1))}
                        disabled={alertPage >= alertsData.totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Anomalies Tab */}
          <TabsContent value="anomalies" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Brute Force Attempts */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldX className="h-5 w-5 text-red-500" />
                    로그인 시도 실패 (IP별)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {anomaliesData?.bruteForceAttempts?.length > 0 ? (
                    <div className="space-y-2">
                      {anomaliesData.bruteForceAttempts.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-red-500/5 rounded-lg">
                          <span className="font-mono text-sm">{item.ipAddress || 'Unknown'}</span>
                          <Badge className="bg-red-500/10 text-red-500">{item._count}회 실패</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">의심스러운 활동 없음</p>
                  )}
                </CardContent>
              </Card>

              {/* Bulk Data Access */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-5 w-5 text-orange-500" />
                    대량 데이터 접근
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {anomaliesData?.bulkDataAccess?.length > 0 ? (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {anomaliesData.bulkDataAccess.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-orange-500/5 rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{item.userEmail || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{item.tableName}</p>
                          </div>
                          <Badge className="bg-orange-500/10 text-orange-500">{item.affectedRows} 행</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">대량 데이터 접근 없음</p>
                  )}
                </CardContent>
              </Card>

              {/* Permission Changes */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-500" />
                    최근 권한 변경
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {anomaliesData?.permissionChanges?.length > 0 ? (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {anomaliesData.permissionChanges.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-purple-500/5 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{ACTION_TYPE_LABELS[item.actionType]}</Badge>
                            <span className="text-sm">{item.description}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">권한 변경 없음</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">카테고리별 분포</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryChartData}>
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
                  <div className="h-[250px]">
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

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">작업 유형별 분포 (상위 10개)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={actionTypeChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="name" type="category" fontSize={11} width={100} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Top Risky Users */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    고위험 사용자 (누적 위험 점수)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statsData?.topRiskyUsers?.length > 0 ? (
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {statsData.topRiskyUsers.map((user: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{user.userEmail || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{user._count}건의 활동</p>
                          </div>
                          <RiskScoreBadge score={user._sum?.riskScore || 0} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">데이터 없음</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Log Detail Dialog */}
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
                    <p className="text-xs text-muted-foreground">카테고리</p>
                    <Badge className={CATEGORY_COLORS[selectedLog.category] || 'bg-gray-500/10'}>
                      {CATEGORY_LABELS[selectedLog.category] || selectedLog.category}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">작업 유형</p>
                    <Badge variant="outline">{ACTION_TYPE_LABELS[selectedLog.actionType] || selectedLog.actionType}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">위험도 점수</p>
                    <RiskScoreBadge score={selectedLog.riskScore} />
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

                {/* API Info */}
                {(selectedLog.apiEndpoint || selectedLog.httpMethod) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">API 엔드포인트</p>
                      <p className="text-sm font-mono">{selectedLog.apiEndpoint || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">HTTP 메서드</p>
                      <Badge variant="outline">{selectedLog.httpMethod || '-'}</Badge>
                    </div>
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

                {/* Client Info */}
                {selectedLog.clientInfo && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">클라이언트 정보</p>
                    <div className="flex items-center gap-2">
                      {selectedLog.clientInfo.isMobile ? (
                        <Smartphone className="h-4 w-4" />
                      ) : (
                        <Monitor className="h-4 w-4" />
                      )}
                      <span className="text-sm">
                        {selectedLog.clientInfo.browser} / {selectedLog.clientInfo.os}
                      </span>
                    </div>
                  </div>
                )}

                {/* Geo Info */}
                {selectedLog.geoInfo && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">위치 정보</p>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span className="text-sm">
                        {selectedLog.geoInfo.city}, {selectedLog.geoInfo.country}
                      </span>
                    </div>
                  </div>
                )}

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

        {/* Alert Detail Dialog */}
        <Dialog open={!!selectedAlert && !resolveDialog} onOpenChange={() => setSelectedAlert(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5" />
                보안 경고 상세
              </DialogTitle>
            </DialogHeader>
            
            {selectedAlert && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">유형</p>
                    <Badge variant="outline">{selectedAlert.alertType}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">심각도</p>
                    <Badge className={SEVERITY_COLORS[selectedAlert.severity as keyof typeof SEVERITY_COLORS]}>
                      {selectedAlert.severity}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">상태</p>
                    <Badge className={ALERT_STATUS_COLORS[selectedAlert.status]}>
                      {selectedAlert.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">발생 시간</p>
                    <p className="text-sm">{formatDate(selectedAlert.createdAt)}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">제목</p>
                  <p className="text-sm font-medium">{selectedAlert.title}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">설명</p>
                  <p className="text-sm">{selectedAlert.description}</p>
                </div>

                {selectedAlert.userEmail && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">관련 사용자</p>
                    <p className="text-sm">{selectedAlert.userEmail}</p>
                  </div>
                )}

                {selectedAlert.ipAddress && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">IP 주소</p>
                    <p className="text-sm font-mono">{selectedAlert.ipAddress}</p>
                  </div>
                )}

                {selectedAlert.resolution && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">해결 내용</p>
                    <p className="text-sm bg-green-500/10 p-3 rounded-lg">{selectedAlert.resolution}</p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
              {selectedAlert?.status === 'OPEN' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => dismissMutation.mutate(selectedAlert.id)}
                  >
                    무시
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => acknowledgeMutation.mutate(selectedAlert.id)}
                  >
                    확인됨으로 표시
                  </Button>
                  <Button onClick={() => setResolveDialog(true)}>
                    해결 처리
                  </Button>
                </>
              )}
              {selectedAlert?.status === 'ACKNOWLEDGED' && (
                <Button onClick={() => setResolveDialog(true)}>
                  해결 처리
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Resolve Dialog */}
        <Dialog open={resolveDialog} onOpenChange={setResolveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>보안 경고 해결</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">해결 방법을 입력해주세요</p>
                <Textarea
                  placeholder="취한 조치, 해결 방법 등을 기록하세요..."
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveDialog(false)}>
                취소
              </Button>
              <Button
                onClick={() => selectedAlert && resolveMutation.mutate({ alertId: selectedAlert.id, resolution })}
                disabled={!resolution.trim()}
              >
                해결 완료
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Help Dialog */}
        <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                감사 로그 도움말
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              <p className="text-muted-foreground">
                보안 감사 로그는 시스템의 모든 중요한 활동을 자동으로 기록합니다. 
                각 로그에는 업 유형, 사용자, 시간, IP 주소 등이 포함되며 위험도 점수가 자동 계산됩니다.
              </p>

              {/* AUTH */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple-500/20 text-purple-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold">인증 (AUTH)</h3>
                </div>
                <div className="ml-10 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">AUTH_LOGIN</Badge>
                    <span>사용자가 시스템에 로그인할 때</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">AUTH_LOGOUT</Badge>
                    <span>사용자가 로그아웃할 때</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">AUTH_FAILED</Badge>
                    <span>로그인 시도가 실패할 때 (잘못된 비밀번호 등)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">PASSWORD_CHANGE</Badge>
                    <span>사용자가 비밀번호를 변경할 때</span>
                  </div>
                </div>
              </div>

              {/* ADMIN */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-500/20 text-blue-500">
                    <UserCog className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold">관리 작업 (ADMIN)</h3>
                </div>
                <div className="ml-10 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">USER_CREATE/UPDATE/DELETE</Badge>
                    <span>사용자 계정을 생성, 수정, 삭제할 때</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">ROLE_CHANGE</Badge>
                    <span>사용자 역할(권한)을 변경할 때</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">CONFIG_CHANGE</Badge>
                    <span>시스템 설정을 변경할 때</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">DATASOURCE_*</Badge>
                    <span>데이터소스를 추가, 수정, 삭제할 때</span>
                  </div>
                </div>
              </div>

              {/* DATA */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-green-500/20 text-green-500">
                    <Database className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold">데이터 작업 (DATA)</h3>
                </div>
                <div className="ml-10 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">DDL_*</Badge>
                    <span>CREATE, ALTER, DROP, TRUNCATE 등 스키마 변경 SQL 실행 시</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">DML_*</Badge>
                    <span>INSERT, UPDATE, DELETE 등 데이터 변경 SQL 실행 시</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">DATA_EXPORT</Badge>
                    <span>쿼리 결과를 CSV 등으로 내보낼 때</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">BULK_DATA_ACCESS</Badge>
                    <span>대량의 데이터(1000건 이상)를 조회할 때</span>
                  </div>
                </div>
              </div>

              {/* QUERY */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-cyan-500/20 text-cyan-500">
                    <FileText className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold">쿼리 실행 (QUERY)</h3>
                </div>
                <div className="ml-10 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">QUERY_EXECUTE</Badge>
                    <span>SQL 쿼리를 실행할 때 (SELECT 포함)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">DESTRUCTIVE_CONFIRM</Badge>
                    <span>파괴적 쿼리(DELETE, DROP 등) 실행을 확인할 때</span>
                  </div>
                </div>
              </div>

              {/* AI */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-pink-500/20 text-pink-500">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold">AI 관련 (AI)</h3>
                </div>
                <div className="ml-10 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">AI_QUERY_GENERATE</Badge>
                    <span>AI가 자연어로부터 SQL을 생성할 때</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">AI_MODEL_CHANGE</Badge>
                    <span>AI 모델 설정을 변경할 때</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">AI_PROMPT_MODIFY</Badge>
                    <span>프롬프트 템플릿을 수정할 때</span>
                  </div>
                </div>
              </div>

              {/* SECURITY */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-red-500/20 text-red-500">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold">보안 이벤트 (SECURITY)</h3>
                </div>
                <div className="ml-10 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">UNAUTHORIZED_ACCESS</Badge>
                    <span>권한 없는 리소스에 접근 시도할 때</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">SESSION_HIJACK_ATTEMPT</Badge>
                    <span>세션 탈취 시도가 감지될 때</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">RATE_LIMIT_EXCEEDED</Badge>
                    <span>API 호출 제한을 초과할 때</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">CONCURRENT_LOGIN</Badge>
                    <span>동일 계정으로 여러 곳에서 동시 로그인할 때</span>
                  </div>
                </div>
              </div>

              {/* SYSTEM */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gray-500/20 text-gray-400">
                    <Server className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold">시스템 이벤트 (SYSTEM)</h3>
                </div>
                <div className="ml-10 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">SYSTEM_STARTUP/SHUTDOWN</Badge>
                    <span>시스템이 시작되거나 종료될 때</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">BACKUP_CREATE/RESTORE</Badge>
                    <span>백업을 생성하거나 복원할 때</span>
                  </div>
                </div>
              </div>

              {/* Risk Score */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  <h3 className="font-semibold">위험도 점수</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  각 로그에는 0-100의 위험도 점수가 자동으로 계산됩니다:
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500/10 text-green-500">0-24</Badge>
                    <span>정상 (INFO)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-500/10 text-yellow-500">25-49</Badge>
                    <span>주의 (WARNING)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-500/10 text-orange-500">50-74</Badge>
                    <span>위험 (DANGER)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-500/10 text-red-500">75-100</Badge>
                    <span>치명적 (CRITICAL)</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  * 업무 외 시간, 주말, 대량 데이터 접근 시 추가 가중치가 적용됩니다.
                </p>
                <p className="text-xs text-muted-foreground">
                  * 위험도 80점 이상 활동은 자동으로 보안 경고가 생성됩니다.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setHelpOpen(false)}>닫기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
