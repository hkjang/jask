'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/api';
import {
  Database,
  Search,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Edit3,
  Crown,
  Users,
  Plus,
  RefreshCw,
  Calendar,
  Clock,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DataSource {
  id: string;
  name: string;
  type: string;
  database: string;
  environment: string;
  isActive: boolean;
  healthStatus: string;
}

interface UserAccess {
  id: string;
  role: 'VIEWER' | 'EDITOR' | 'ADMIN';
  grantedAt: string;
  expiresAt: string | null;
  grantedByName: string | null;
  note: string | null;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    department: string | null;
    isActive: boolean;
  };
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  department?: string;
}

const ROLE_CONFIG = {
  VIEWER: { label: '조회자', icon: Eye, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  EDITOR: { label: '편집자', icon: Edit3, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
  ADMIN: { label: '관리자', icon: Crown, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
};

export default function DataSourceAccessPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ userId: string; userName: string } | null>(null);
  
  const [grantForm, setGrantForm] = useState({
    userId: '',
    role: 'VIEWER' as 'VIEWER' | 'EDITOR' | 'ADMIN',
    note: '',
    expiresAt: '',
  });

  // Fetch data sources
  const { data: dataSources = [], isLoading: dsLoading } = useQuery({
    queryKey: ['dataSources'],
    queryFn: () => api.getDataSources() as Promise<DataSource[]>,
  });

  // Fetch users for grant dialog
  const { data: usersData } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const res: any = await api.getUsers(1, 200);
      return res.items as User[];
    },
    enabled: grantDialogOpen,
  });

  // Fetch access list for selected data source
  const { data: accessList = [], isLoading: accessLoading, refetch: refetchAccess } = useQuery({
    queryKey: ['dataSourceAccess', selectedDataSource],
    queryFn: () => api.getDataSourceUsers(selectedDataSource) as Promise<UserAccess[]>,
    enabled: !!selectedDataSource,
  });

  // Grant access mutation
  const grantMutation = useMutation({
    mutationFn: (data: { userId: string; role: string; note?: string; expiresAt?: string }) => 
      api.grantDataSourceAccess(selectedDataSource, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataSourceAccess', selectedDataSource] });
      toast({ title: '접근 권한이 부여되었습니다' });
      setGrantDialogOpen(false);
      setGrantForm({ userId: '', role: 'VIEWER', note: '', expiresAt: '' });
    },
    onError: (err: Error) => {
      toast({ title: '권한 부여 실패', description: err.message, variant: 'destructive' });
    },
  });

  // Update access mutation
  const updateMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'VIEWER' | 'EDITOR' | 'ADMIN' }) =>
      api.updateDataSourceAccess(selectedDataSource, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataSourceAccess', selectedDataSource] });
      toast({ title: '역할이 변경되었습니다' });
    },
    onError: () => {
      toast({ title: '역할 변경 실패', variant: 'destructive' });
    },
  });

  // Revoke access mutation
  const revokeMutation = useMutation({
    mutationFn: (userId: string) => api.revokeDataSourceAccess(selectedDataSource, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataSourceAccess', selectedDataSource] });
      toast({ title: '접근 권한이 회수되었습니다' });
      setRevokeTarget(null);
    },
    onError: () => {
      toast({ title: '권한 회수 실패', variant: 'destructive' });
    },
  });

  // Filter users who don't already have access
  const availableUsers = useMemo(() => {
    if (!usersData) return [];
    const existingUserIds = new Set(accessList.map(a => a.user.id));
    return usersData.filter(u => !existingUserIds.has(u.id) && u.isActive && u.role !== 'ADMIN');
  }, [usersData, accessList]);

  // Filtered access list
  const filteredAccess = useMemo(() => {
    if (!searchTerm) return accessList;
    const term = searchTerm.toLowerCase();
    return accessList.filter(a => 
      a.user.name.toLowerCase().includes(term) ||
      a.user.email.toLowerCase().includes(term) ||
      a.user.department?.toLowerCase().includes(term)
    );
  }, [accessList, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const viewers = accessList.filter(a => a.role === 'VIEWER').length;
    const editors = accessList.filter(a => a.role === 'EDITOR').length;
    const admins = accessList.filter(a => a.role === 'ADMIN').length;
    const expiringSoon = accessList.filter(a => {
      if (!a.expiresAt) return false;
      const days = (new Date(a.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return days <= 7 && days > 0;
    }).length;
    return { total: accessList.length, viewers, editors, admins, expiringSoon };
  }, [accessList]);

  const selectedDs = dataSources.find(d => d.id === selectedDataSource);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <MainLayout>
      <div className="container max-w-7xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldCheck className="h-8 w-8" />
              데이터소스 접근 관리
            </h1>
            <p className="text-muted-foreground mt-1">
              사용자별 데이터소스 접근 권한을 관리합니다
            </p>
          </div>
        </div>

        {/* Data Source Selector */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="mb-2 block">데이터소스 선택</Label>
                <Select value={selectedDataSource} onValueChange={setSelectedDataSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="관리할 데이터소스를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {dataSources.map(ds => (
                      <SelectItem key={ds.id} value={ds.id}>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          <span>{ds.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {ds.type}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedDataSource && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => refetchAccess()} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    새로고침
                  </Button>
                  <Button onClick={() => setGrantDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    권한 부여
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedDataSource && (
          <>
            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.total}</p>
                      <p className="text-xs text-muted-foreground">전체 사용자</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-500/10 text-blue-600">
                      <Eye className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.viewers}</p>
                      <p className="text-xs text-muted-foreground">조회자</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-500/10 text-green-600">
                      <Edit3 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.editors}</p>
                      <p className="text-xs text-muted-foreground">편집자</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600">
                      <Crown className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.admins}</p>
                      <p className="text-xs text-muted-foreground">관리자</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-500/10 text-orange-600">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.expiringSoon}</p>
                      <p className="text-xs text-muted-foreground">만료 예정</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Access List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      접근 권한 목록
                      {selectedDs && (
                        <Badge variant="outline">{selectedDs.name}</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      이 데이터소스에 접근 가능한 사용자 목록입니다. 시스템 관리자는 자동으로 모든 데이터소스에 접근할 수 있습니다.
                    </CardDescription>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="이름, 이메일로 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {accessLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredAccess.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Shield className="h-12 w-12 mb-4 opacity-50" />
                    <p>접근 권한이 부여된 사용자가 없습니다</p>
                    <Button variant="link" onClick={() => setGrantDialogOpen(true)}>
                      권한 부여하기
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>사용자</TableHead>
                        <TableHead>역할</TableHead>
                        <TableHead>부여일</TableHead>
                        <TableHead>만료일</TableHead>
                        <TableHead>부여자</TableHead>
                        <TableHead className="text-right">작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAccess.map((access) => {
                        const RoleIcon = ROLE_CONFIG[access.role].icon;
                        return (
                          <TableRow key={access.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted font-medium">
                                  {access.user.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium">{access.user.name}</div>
                                  <div className="text-sm text-muted-foreground">{access.user.email}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={access.role}
                                onValueChange={(v: 'VIEWER' | 'EDITOR' | 'ADMIN') => {
                                  updateMutation.mutate({ userId: access.user.id, role: v });
                                }}
                              >
                                <SelectTrigger className={`w-32 ${ROLE_CONFIG[access.role].color}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="VIEWER">
                                    <div className="flex items-center gap-2">
                                      <Eye className="h-4 w-4" />
                                      조회자
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="EDITOR">
                                    <div className="flex items-center gap-2">
                                      <Edit3 className="h-4 w-4" />
                                      편집자
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="ADMIN">
                                    <div className="flex items-center gap-2">
                                      <Crown className="h-4 w-4" />
                                      관리자
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDate(access.grantedAt)}
                              </div>
                            </TableCell>
                            <TableCell>
                              {access.expiresAt ? (
                                <div className={`flex items-center gap-1 text-sm ${
                                  new Date(access.expiresAt) < new Date() ? 'text-destructive' :
                                  (new Date(access.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 7 
                                    ? 'text-orange-600' : 'text-muted-foreground'
                                }`}>
                                  <Clock className="h-3.5 w-3.5" />
                                  {formatDate(access.expiresAt)}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">무기한</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {access.grantedByName || '-'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setRevokeTarget({ userId: access.user.id, userName: access.user.name })}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Grant Dialog */}
        <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>접근 권한 부여</DialogTitle>
              <DialogDescription>
                {selectedDs?.name}에 대한 접근 권한을 부여합니다
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>사용자 *</Label>
                <Select value={grantForm.userId} onValueChange={(v) => setGrantForm({ ...grantForm, userId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="사용자를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <span>{user.name}</span>
                          <span className="text-muted-foreground">({user.email})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    모든 사용자에게 이미 권한이 부여되어 있습니다
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>역할 *</Label>
                <Select value={grantForm.role} onValueChange={(v: any) => setGrantForm({ ...grantForm, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIEWER">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        조회자 - 데이터소스 조회만 가능
                      </div>
                    </SelectItem>
                    <SelectItem value="EDITOR">
                      <div className="flex items-center gap-2">
                        <Edit3 className="h-4 w-4" />
                        편집자 - 쿼리 실행 및 결과 내보내기 가능
                      </div>
                    </SelectItem>
                    <SelectItem value="ADMIN">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4" />
                        관리자 - 메타데이터 수정 및 권한 관리 가능
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>만료일 (선택)</Label>
                <Input
                  type="date"
                  value={grantForm.expiresAt}
                  onChange={(e) => setGrantForm({ ...grantForm, expiresAt: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div className="space-y-2">
                <Label>메모 (선택)</Label>
                <Input
                  value={grantForm.note}
                  onChange={(e) => setGrantForm({ ...grantForm, note: e.target.value })}
                  placeholder="권한 부여 사유 등"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGrantDialogOpen(false)}>취소</Button>
              <Button 
                onClick={() => grantMutation.mutate({
                  userId: grantForm.userId,
                  role: grantForm.role,
                  note: grantForm.note || undefined,
                  expiresAt: grantForm.expiresAt || undefined,
                })}
                disabled={!grantForm.userId || grantMutation.isPending}
              >
                {grantMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                권한 부여
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Revoke Confirmation */}
        <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>접근 권한 회수</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{revokeTarget?.userName}</strong> 사용자의 <strong>{selectedDs?.name}</strong> 접근 권한을 회수하시겠습니까?
                <span className="block mt-2 text-orange-600">
                  이 사용자는 더 이상 해당 데이터소스에 접근할 수 없습니다.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget.userId)}
                disabled={revokeMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {revokeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                권한 회수
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
