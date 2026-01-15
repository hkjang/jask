'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { 
  Database, 
  Plus, 
  RefreshCw, 
  CheckCircle, 
  Loader2, 
  Pencil, 
  Trash2, 
  MoreHorizontal,
  Activity,
  AlertTriangle,
  Server,
  Clock,
  BarChart3,
  Settings,
  ChevronRight,
  ChevronLeft,
  Shield,
  Zap,
  ExternalLink,
  Table2,
  HelpCircle,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// 데이터베이스 타입별 설정
const DB_CONFIG = {
  postgresql: { 
    label: 'PostgreSQL', 
    color: 'bg-blue-500', 
    textColor: 'text-blue-500',
    icon: '🐘',
    defaultPort: 5432,
    defaultSchema: 'public'
  },
  mysql: { 
    label: 'MySQL', 
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
    icon: '🐬',
    defaultPort: 3306,
    defaultSchema: 'mysql'
  },
  oracle: { 
    label: 'Oracle', 
    color: 'bg-red-500',
    textColor: 'text-red-500',
    icon: '🔴',
    defaultPort: 1521,
    defaultSchema: 'ORCL'
  },
};

const ENV_CONFIG = {
  production: { label: '운영', color: 'bg-red-500', badge: 'destructive' as const },
  staging: { label: '스테이징', color: 'bg-yellow-500', badge: 'secondary' as const },
  development: { label: '개발', color: 'bg-green-500', badge: 'outline' as const },
};

interface DataSource {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  schema?: string;
  description?: string;
  environment?: string;
  sslEnabled?: boolean;
  healthStatus: string;
  lastHealthCheck?: string;
  queryCount: number;
  avgResponseTime: number;
  lastActiveAt?: string;
  isActive: boolean;
  createdAt: string;
  _count?: { tables: number; queries: number };
}

// 초기 폼 상태
const initialFormState = {
  name: '',
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: '',
  username: '',
  password: '',
  schema: 'public',
  description: '',
  environment: 'development',
  sslEnabled: false,
  sslConfig: { mode: 'require' as string },
  poolConfig: { maxConnections: 10, connectionTimeout: 30000, idleTimeout: 60000 },
};

export default function DataSourcesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // 마법사 상태
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [formData, setFormData] = useState(initialFormState);
  const [showPassword, setShowPassword] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<'success' | 'failed' | null>(null);

  // 상세보기 상태
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);
  const [detailsTab, setDetailsTab] = useState('overview');

  // 수정 상태
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null);
  const [editForm, setEditForm] = useState(initialFormState);
  const [isTestingEdit, setIsTestingEdit] = useState(false);

  // 삭제 상태
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dataSourceToDelete, setDataSourceToDelete] = useState<DataSource | null>(null);

  // 필터 상태
  const [environmentFilter, setEnvironmentFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 데이터 조회
  const { data: dataSources = [], isLoading } = useQuery<DataSource[]>({
    queryKey: ['dataSources'],
    queryFn: () => api.getDataSources(),
  });

  const { data: overview } = useQuery({
    queryKey: ['dataSourcesOverview'],
    queryFn: () => api.getDataSourcesOverview(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['connectionTemplates'],
    queryFn: () => api.getConnectionTemplates(),
  });

  const { data: statistics } = useQuery({
    queryKey: ['dataSourceStatistics', selectedDataSource?.id],
    queryFn: () => selectedDataSource ? api.getDataSourceStatistics(selectedDataSource.id) : null,
    enabled: !!selectedDataSource && detailsTab === 'statistics',
  });

  // 필터링된 데이터소스
  const filteredDataSources = dataSources.filter((ds) => {
    if (environmentFilter !== 'all' && ds.environment !== environmentFilter) return false;
    if (typeFilter !== 'all' && ds.type !== typeFilter) return false;
    if (statusFilter !== 'all' && ds.healthStatus !== statusFilter) return false;
    return true;
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: () => api.createDataSource(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataSources'] });
      queryClient.invalidateQueries({ queryKey: ['dataSourcesOverview'] });
      toast({ title: '데이터소스가 생성되었습니다' });
      setWizardOpen(false);
      setWizardStep(1);
      setFormData(initialFormState);
      setConnectionTestResult(null);
    },
    onError: (error: Error) => {
      toast({ title: '생성 실패', description: error.message, variant: 'destructive' });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => api.syncMetadata(id),
    onSuccess: (data: any) => {
      toast({ title: '동기화 완료', description: `${data.tables}개 테이블, ${data.columns}개 컬럼` });
      queryClient.invalidateQueries({ queryKey: ['dataSources'] });
    },
    onError: (error: Error) => {
      toast({ title: '동기화 실패', description: error.message, variant: 'destructive' });
    },
  });

  const healthCheckMutation = useMutation({
    mutationFn: (id: string) => api.getDataSourceHealth(id),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['dataSources'] });
      if (data.isHealthy) {
        toast({ title: '연결 정상', description: `응답 시간: ${data.latency}ms` });
      } else {
        toast({ title: '연결 실패', description: data.error, variant: 'destructive' });
      }
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (id: string) => api.refreshDataSourceConnection(id),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['dataSources'] });
      toast({ 
        title: data.success ? '연결 새로고침 완료' : '연결 새로고침 실패', 
        description: data.message,
        variant: data.success ? 'default' : 'destructive'
      });
    },
  });

  // 연결 테스트
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionTestResult(null);
    try {
      await api.testConnection(formData);
      setConnectionTestResult('success');
      toast({ title: '연결 성공!' });
    } catch (error: any) {
      setConnectionTestResult('failed');
      toast({ title: '연결 실패', description: error.message, variant: 'destructive' });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // 수정 핸들러
  const handleEditClick = (ds: DataSource) => {
    setEditingDataSource(ds);
    setEditForm({
      name: ds.name,
      type: ds.type,
      host: ds.host,
      port: ds.port,
      database: ds.database,
      username: '',
      password: '',
      schema: ds.schema || 'public',
      description: ds.description || '',
      environment: ds.environment || 'development',
      sslEnabled: ds.sslEnabled || false,
      sslConfig: { mode: 'require' },
      poolConfig: { maxConnections: 10, connectionTimeout: 30000, idleTimeout: 60000 },
    });
    setEditDialogOpen(true);
  };

  const handleTestEditConnection = async () => {
    setIsTestingEdit(true);
    try {
      await api.testConnection(editForm);
      toast({ title: '연결 성공' });
    } catch (error: any) {
      toast({ title: '연결 실패', description: error.message, variant: 'destructive' });
    } finally {
      setIsTestingEdit(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingDataSource) return;
    try {
      const updateData: any = { ...editForm };
      if (!updateData.password) delete updateData.password;
      if (!updateData.username) delete updateData.username;
      
      await api.updateDataSource(editingDataSource.id, updateData);
      toast({ title: '업데이트 성공' });
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['dataSources'] });
    } catch (error: any) {
      toast({ title: '업데이트 실패', description: error.message, variant: 'destructive' });
    }
  };

  // 삭제 핸들러
  const confirmDeleteClick = (ds: DataSource) => {
    setDataSourceToDelete(ds);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!dataSourceToDelete) return;
    try {
      await api.deleteDataSource(dataSourceToDelete.id);
      toast({ title: '삭제 완료' });
      setDeleteDialogOpen(false);
      setDataSourceToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['dataSources'] });
      queryClient.invalidateQueries({ queryKey: ['dataSourcesOverview'] });
    } catch (error: any) {
      toast({ title: '삭제 실패', description: error.message, variant: 'destructive' });
    }
  };

  // 템플릿 적용
  const applyTemplate = (template: any) => {
    setFormData((prev) => ({
      ...prev,
      type: template.type,
      host: template.host,
      port: template.port,
      database: template.database,
      schema: template.schema,
    }));
  };

  // 타입 변경 시 포트 자동 설정
  const handleTypeChange = (type: string) => {
    const config = DB_CONFIG[type as keyof typeof DB_CONFIG];
    setFormData((prev) => ({
      ...prev,
      type,
      port: config?.defaultPort || prev.port,
      schema: config?.defaultSchema || prev.schema,
    }));
  };

  // 상태 배지 렌더링
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="h-3 w-3 mr-1" /> 정상</Badge>;
      case 'unhealthy':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> 장애</Badge>;
      default:
        return <Badge variant="secondary"><HelpCircle className="h-3 w-3 mr-1" /> 미확인</Badge>;
    }
  };

  // 상대 시간 포맷
  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  // 마법사 단계별 콘텐츠
  const renderWizardStep = () => {
    switch (wizardStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-base font-semibold">연결 이름 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: Production Database"
                className="text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">설명</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="데이터소스에 대한 설명을 입력하세요..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-base font-semibold">환경 *</Label>
                <Select value={formData.environment} onValueChange={(val) => setFormData({ ...formData, environment: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ENV_CONFIG).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-base font-semibold">데이터베이스 타입 *</Label>
                <Select value={formData.type} onValueChange={handleTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DB_CONFIG).map(([key, { label, icon }]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">{icon} {label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {templates.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">빠른 시작 템플릿</Label>
                <div className="flex flex-wrap gap-2">
                  {templates.map((t: any) => (
                    <Button key={t.id} variant="outline" size="sm" onClick={() => applyTemplate(t)}>
                      {DB_CONFIG[t.type as keyof typeof DB_CONFIG]?.icon} {t.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label className="text-base font-semibold">호스트 *</Label>
                <Input
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="localhost"
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label className="text-base font-semibold">포트 *</Label>
                <Input
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">데이터베이스 이름 *</Label>
              <Input
                value={formData.database}
                onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                placeholder="mydb"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                {formData.type === 'oracle' ? '서비스 이름' : '스키마'}
              </Label>
              <Input
                value={formData.schema}
                onChange={(e) => setFormData({ ...formData, schema: e.target.value })}
                placeholder={formData.type === 'oracle' ? 'ORCL' : 'public'}
              />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-base font-semibold">사용자 이름 *</Label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="postgres"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-semibold">비밀번호 *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">SSL/TLS 암호화</p>
                  <p className="text-sm text-muted-foreground">암호화된 연결 사용</p>
                </div>
              </div>
              <Switch 
                checked={formData.sslEnabled} 
                onCheckedChange={(checked) => setFormData({ ...formData, sslEnabled: checked })}
              />
            </div>
            {formData.sslEnabled && (
              <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
                <Label>SSL 모드</Label>
                <Select 
                  value={formData.sslConfig.mode} 
                  onValueChange={(val) => setFormData({ ...formData, sslConfig: { ...formData.sslConfig, mode: val } })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="require">Require</SelectItem>
                    <SelectItem value="verify-ca">Verify CA</SelectItem>
                    <SelectItem value="verify-full">Verify Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-4 p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">연결 풀 설정</p>
                  <p className="text-sm text-muted-foreground">성능 최적화 옵션</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">최대 연결</Label>
                  <Input
                    type="number"
                    value={formData.poolConfig.maxConnections}
                    onChange={(e) => setFormData({
                      ...formData,
                      poolConfig: { ...formData.poolConfig, maxConnections: parseInt(e.target.value) || 10 }
                    })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">연결 타임아웃 (ms)</Label>
                  <Input
                    type="number"
                    value={formData.poolConfig.connectionTimeout}
                    onChange={(e) => setFormData({
                      ...formData,
                      poolConfig: { ...formData.poolConfig, connectionTimeout: parseInt(e.target.value) || 30000 }
                    })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">유휴 타임아웃 (ms)</Label>
                  <Input
                    type="number"
                    value={formData.poolConfig.idleTimeout}
                    onChange={(e) => setFormData({
                      ...formData,
                      poolConfig: { ...formData.poolConfig, idleTimeout: parseInt(e.target.value) || 60000 }
                    })}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <div className="rounded-lg border p-6 space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                {DB_CONFIG[formData.type as keyof typeof DB_CONFIG]?.icon}
                {formData.name || '새 데이터소스'}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">타입:</span>
                  <span className="ml-2 font-medium">{DB_CONFIG[formData.type as keyof typeof DB_CONFIG]?.label}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">환경:</span>
                  <Badge variant={ENV_CONFIG[formData.environment as keyof typeof ENV_CONFIG]?.badge} className="ml-2">
                    {ENV_CONFIG[formData.environment as keyof typeof ENV_CONFIG]?.label}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">호스트:</span>
                  <span className="ml-2 font-medium">{formData.host}:{formData.port}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">데이터베이스:</span>
                  <span className="ml-2 font-medium">{formData.database}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">스키마:</span>
                  <span className="ml-2 font-medium">{formData.schema}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">SSL:</span>
                  <span className="ml-2">{formData.sslEnabled ? '활성화' : '비활성화'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="flex-1"
              >
                {isTestingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : connectionTestResult === 'success' ? (
                  <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                ) : connectionTestResult === 'failed' ? (
                  <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                ) : (
                  <Activity className="h-4 w-4 mr-2" />
                )}
                연결 테스트
              </Button>
              {connectionTestResult === 'success' && (
                <span className="text-green-500 text-sm font-medium">✓ 연결 성공</span>
              )}
              {connectionTestResult === 'failed' && (
                <span className="text-red-500 text-sm font-medium">✗ 연결 실패</span>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const wizardSteps = [
    { step: 1, title: '기본 정보' },
    { step: 2, title: '연결 정보' },
    { step: 3, title: '인증' },
    { step: 4, title: '고급 옵션' },
    { step: 5, title: '확인 및 테스트' },
  ];

  return (
    <MainLayout>
      <TooltipProvider>
        <div className="container max-w-7xl py-8">
          {/* 헤더 */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Database className="h-8 w-8" />
                데이터소스 관리
              </h1>
              <p className="text-muted-foreground mt-1">데이터베이스 연결을 관리하고 모니터링합니다</p>
            </div>
            <Button onClick={() => setWizardOpen(true)} size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              새 연결 추가
            </Button>
          </div>

          {/* 대시보드 요약 */}
          {overview && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">전체</p>
                      <p className="text-3xl font-bold">{overview.total}</p>
                    </div>
                    <Server className="h-10 w-10 text-blue-500 opacity-80" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">정상</p>
                      <p className="text-3xl font-bold text-green-500">{overview.healthy}</p>
                    </div>
                    <CheckCircle className="h-10 w-10 text-green-500 opacity-80" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">장애</p>
                      <p className="text-3xl font-bold text-red-500">{overview.unhealthy}</p>
                    </div>
                    <AlertTriangle className="h-10 w-10 text-red-500 opacity-80" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-gray-500/10 to-gray-500/5 border-gray-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">미확인</p>
                      <p className="text-3xl font-bold text-muted-foreground">{overview.unknown}</p>
                    </div>
                    <HelpCircle className="h-10 w-10 text-muted-foreground opacity-80" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 필터 */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Select value={environmentFilter} onValueChange={setEnvironmentFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="환경" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 환경</SelectItem>
                {Object.entries(ENV_CONFIG).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="타입" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 타입</SelectItem>
                {Object.entries(DB_CONFIG).map(([key, { label, icon }]) => (
                  <SelectItem key={key} value={key}>{icon} {label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 상태</SelectItem>
                <SelectItem value="healthy">정상</SelectItem>
                <SelectItem value="unhealthy">장애</SelectItem>
                <SelectItem value="unknown">미확인</SelectItem>
              </SelectContent>
            </Select>
            {(environmentFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setEnvironmentFilter('all'); setTypeFilter('all'); setStatusFilter('all'); }}
              >
                필터 초기화
              </Button>
            )}
          </div>

          {/* 데이터소스 목록 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDataSources.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Database className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-xl font-medium text-muted-foreground mb-2">
                  {dataSources.length === 0 ? '연결된 데이터소스가 없습니다' : '필터 조건에 맞는 데이터소스가 없습니다'}
                </p>
                <p className="text-muted-foreground mb-6">새 연결을 추가하여 시작하세요</p>
                <Button onClick={() => setWizardOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  새 연결 추가
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredDataSources.map((ds) => {
                const dbConfig = DB_CONFIG[ds.type as keyof typeof DB_CONFIG];
                const envConfig = ENV_CONFIG[(ds.environment || 'development') as keyof typeof ENV_CONFIG];
                
                return (
                  <Card 
                    key={ds.id} 
                    className={cn(
                      "transition-all hover:shadow-md cursor-pointer",
                      ds.healthStatus === 'unhealthy' && "border-red-500/50"
                    )}
                    onClick={() => { setSelectedDataSource(ds); setDetailsOpen(true); }}
                  >
                    <CardContent className="py-5">
                      <div className="flex items-center gap-4">
                        {/* 아이콘 */}
                        <div className={cn(
                          "flex h-14 w-14 items-center justify-center rounded-xl text-2xl",
                          dbConfig?.color + "/10"
                        )}>
                          {dbConfig?.icon || '📦'}
                        </div>
                        
                        {/* 정보 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg truncate">{ds.name}</h3>
                            <Badge variant={envConfig?.badge}>{envConfig?.label}</Badge>
                            {renderStatusBadge(ds.healthStatus)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {dbConfig?.label} · {ds.host}:{ds.port}/{ds.database}
                            {ds.schema && ds.schema !== 'public' && ` (${ds.schema})`}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Table2 className="h-3 w-3" />
                              {ds._count?.tables || 0} 테이블
                            </span>
                            <span className="flex items-center gap-1">
                              <BarChart3 className="h-3 w-3" />
                              {ds.queryCount} 쿼리
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(ds.lastActiveAt || ds.lastHealthCheck)}
                            </span>
                          </div>
                        </div>

                        {/* 액션 버튼 */}
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => healthCheckMutation.mutate(ds.id)}
                                disabled={healthCheckMutation.isPending}
                              >
                                <Activity className={cn("h-4 w-4", healthCheckMutation.isPending && "animate-pulse")} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>헬스 체크</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => syncMutation.mutate(ds.id)}
                                disabled={syncMutation.isPending}
                              >
                                <RefreshCw className={cn("h-4 w-4", syncMutation.isPending && "animate-spin")} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>메타데이터 동기화</TooltipContent>
                          </Tooltip>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditClick(ds)}>
                                <Pencil className="h-4 w-4 mr-2" /> 수정
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => refreshMutation.mutate(ds.id)}>
                                <RefreshCw className="h-4 w-4 mr-2" /> 연결 새로고침
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive" 
                                onClick={() => confirmDeleteClick(ds)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> 삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* 연결 마법사 다이얼로그 */}
          <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">새 데이터소스 연결</DialogTitle>
                <DialogDescription>단계별로 데이터베이스 연결을 설정합니다.</DialogDescription>
              </DialogHeader>

              {/* 단계 인디케이터 */}
              <div className="flex items-center justify-between mb-6">
                {wizardSteps.map(({ step, title }, idx) => (
                  <div key={step} className="flex items-center">
                    <div 
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                        wizardStep === step 
                          ? "bg-primary text-primary-foreground" 
                          : wizardStep > step 
                            ? "bg-green-500 text-white"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {wizardStep > step ? <CheckCircle className="h-4 w-4" /> : step}
                    </div>
                    <span className={cn(
                      "ml-2 text-sm hidden sm:inline",
                      wizardStep === step ? "font-medium" : "text-muted-foreground"
                    )}>
                      {title}
                    </span>
                    {idx < wizardSteps.length - 1 && (
                      <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground hidden sm:inline" />
                    )}
                  </div>
                ))}
              </div>

              {/* 단계별 콘텐츠 */}
              <div className="min-h-[300px]">
                {renderWizardStep()}
              </div>

              <DialogFooter className="flex justify-between mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => wizardStep > 1 ? setWizardStep(wizardStep - 1) : setWizardOpen(false)}
                >
                  {wizardStep === 1 ? '취소' : <><ChevronLeft className="h-4 w-4 mr-1" /> 이전</>}
                </Button>
                {wizardStep < 5 ? (
                  <Button onClick={() => setWizardStep(wizardStep + 1)}>
                    다음 <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    연결 생성
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 상세보기 다이얼로그 */}
          <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              {selectedDataSource && (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {DB_CONFIG[selectedDataSource.type as keyof typeof DB_CONFIG]?.icon}
                      </span>
                      <div>
                        <DialogTitle className="text-xl">{selectedDataSource.name}</DialogTitle>
                        <DialogDescription>
                          {selectedDataSource.host}:{selectedDataSource.port}/{selectedDataSource.database}
                        </DialogDescription>
                      </div>
                      {renderStatusBadge(selectedDataSource.healthStatus)}
                    </div>
                  </DialogHeader>

                  <Tabs value={detailsTab} onValueChange={setDetailsTab} className="mt-4">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="overview">개요</TabsTrigger>
                      <TabsTrigger value="tables">테이블</TabsTrigger>
                      <TabsTrigger value="statistics">통계</TabsTrigger>
                      <TabsTrigger value="settings">설정</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg border">
                          <p className="text-sm text-muted-foreground">타입</p>
                          <p className="font-medium flex items-center gap-2 mt-1">
                            {DB_CONFIG[selectedDataSource.type as keyof typeof DB_CONFIG]?.icon}
                            {DB_CONFIG[selectedDataSource.type as keyof typeof DB_CONFIG]?.label}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg border">
                          <p className="text-sm text-muted-foreground">환경</p>
                          <Badge variant={ENV_CONFIG[(selectedDataSource.environment || 'development') as keyof typeof ENV_CONFIG]?.badge} className="mt-1">
                            {ENV_CONFIG[(selectedDataSource.environment || 'development') as keyof typeof ENV_CONFIG]?.label}
                          </Badge>
                        </div>
                        <div className="p-4 rounded-lg border">
                          <p className="text-sm text-muted-foreground">테이블 수</p>
                          <p className="font-medium text-2xl mt-1">{selectedDataSource._count?.tables || 0}</p>
                        </div>
                        <div className="p-4 rounded-lg border">
                          <p className="text-sm text-muted-foreground">쿼리 수</p>
                          <p className="font-medium text-2xl mt-1">{selectedDataSource.queryCount}</p>
                        </div>
                      </div>
                      {selectedDataSource.description && (
                        <div className="p-4 rounded-lg border">
                          <p className="text-sm text-muted-foreground mb-1">설명</p>
                          <p>{selectedDataSource.description}</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="tables" className="mt-4">
                      <div className="text-center text-muted-foreground py-8">
                        <Table2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>테이블 목록은 메타데이터 빌더에서 확인하세요</p>
                        <Button variant="link" className="mt-2">
                          메타데이터 빌더 열기 <ExternalLink className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="statistics" className="mt-4 space-y-4">
                      {statistics ? (
                        <>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 rounded-lg border text-center">
                              <p className="text-sm text-muted-foreground">총 쿼리</p>
                              <p className="font-bold text-3xl mt-1">{statistics.queryCount}</p>
                            </div>
                            <div className="p-4 rounded-lg border text-center">
                              <p className="text-sm text-muted-foreground">평균 응답 시간</p>
                              <p className="font-bold text-3xl mt-1">{statistics.avgResponseTime}ms</p>
                            </div>
                            <div className="p-4 rounded-lg border text-center">
                              <p className="text-sm text-muted-foreground">컬럼 수</p>
                              <p className="font-bold text-3xl mt-1">{statistics.columnCount}</p>
                            </div>
                          </div>
                          {statistics.recentQueries && statistics.recentQueries.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-3">최근 쿼리</h4>
                              <div className="space-y-2">
                                {statistics.recentQueries.slice(0, 5).map((q: any) => (
                                  <div key={q.id} className="p-3 rounded border text-sm flex items-center justify-between">
                                    <span className="truncate flex-1">{q.naturalQuery}</span>
                                    <span className="text-muted-foreground ml-4">
                                      {q.executionTime ? `${q.executionTime}ms` : '-'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="settings" className="mt-4 space-y-4">
                      <div className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">SSL/TLS</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedDataSource.sslEnabled ? '활성화됨' : '비활성화됨'}
                            </p>
                          </div>
                          <Shield className={cn(
                            "h-5 w-5",
                            selectedDataSource.sslEnabled ? "text-green-500" : "text-muted-foreground"
                          )} />
                        </div>
                      </div>
                      <div className="p-4 rounded-lg border">
                        <p className="font-medium mb-2">연결 정보</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <span className="text-muted-foreground">호스트:</span>
                          <span>{selectedDataSource.host}</span>
                          <span className="text-muted-foreground">포트:</span>
                          <span>{selectedDataSource.port}</span>
                          <span className="text-muted-foreground">스키마:</span>
                          <span>{selectedDataSource.schema || 'public'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => { setDetailsOpen(false); handleEditClick(selectedDataSource); }}>
                          <Pencil className="h-4 w-4 mr-2" /> 설정 수정
                        </Button>
                        <Button variant="outline" onClick={() => refreshMutation.mutate(selectedDataSource.id)}>
                          <RefreshCw className="h-4 w-4 mr-2" /> 연결 새로고침
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* 수정 다이얼로그 */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>데이터소스 수정</DialogTitle>
                <DialogDescription>연결 정보를 수정합니다.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>이름</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>환경</Label>
                    <Select value={editForm.environment} onValueChange={(val) => setEditForm({ ...editForm, environment: val })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ENV_CONFIG).map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>호스트</Label>
                    <Input
                      value={editForm.host}
                      onChange={(e) => setEditForm({ ...editForm, host: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>포트</Label>
                    <Input
                      type="number"
                      value={editForm.port}
                      onChange={(e) => setEditForm({ ...editForm, port: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>데이터베이스</Label>
                    <Input
                      value={editForm.database}
                      onChange={(e) => setEditForm({ ...editForm, database: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{editForm.type === 'oracle' ? '서비스 이름' : '스키마'}</Label>
                    <Input
                      value={editForm.schema}
                      onChange={(e) => setEditForm({ ...editForm, schema: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>사용자 (변경시에만)</Label>
                    <Input
                      placeholder="변경하지 않으려면 비워두세요"
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>비밀번호 (변경시에만)</Label>
                    <Input
                      type="password"
                      placeholder="변경하지 않으려면 비워두세요"
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>설명</Label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={handleTestEditConnection} disabled={isTestingEdit} className="mr-auto">
                  {isTestingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  연결 테스트
                </Button>
                <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>취소</Button>
                <Button onClick={handleSaveEdit}>저장</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 삭제 확인 다이얼로그 */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  이 작업은 되돌릴 수 없습니다. 데이터소스 
                  <span className="font-semibold text-foreground"> {dataSourceToDelete?.name} </span>
                  및 관련 메타데이터가 영구적으로 삭제됩니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  삭제
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TooltipProvider>
    </MainLayout>
  );
}
