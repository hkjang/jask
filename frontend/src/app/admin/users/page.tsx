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
  Users,
  Crown,
  Search,
  Loader2,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  BarChart3,
  RefreshCw,
  MoreVertical,
  UserCog,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  department?: string;
  createdAt: string;
  lastLoginAt?: string;
  preferences?: { department?: string };
  _count?: { queries: number };
}

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'USER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [confirmAction, setConfirmAction] = useState<{
    userId: string;
    action: 'role' | 'toggle' | 'delete';
    userName: string;
    currentRole?: string;
    isActive?: boolean;
  } | null>(null);

  // Create/Edit User Dialog
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'USER' as 'USER' | 'ADMIN',
    department: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const res: any = await api.getUsers(1, 100);
      return res;
    },
  });

  const users: User[] = usersData?.items || [];

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter(u => u.role === 'ADMIN').length;
    const active = users.filter(u => u.isActive).length;
    const totalQueries = users.reduce((sum, u) => sum + (u._count?.queries || 0), 0);
    return { total, admins, active, totalQueries };
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const dept = (user.preferences as any)?.department || user.department;
      const matchesSearch = !searchTerm || 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'ALL' || 
        (statusFilter === 'ACTIVE' && user.isActive) ||
        (statusFilter === 'INACTIVE' && !user.isActive);
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Role/Toggle Mutation
  const userMutation = useMutation({
    mutationFn: async ({ userId, action, data }: { userId: string; action: 'role' | 'toggle'; data?: any }) => {
      const endpoint = action === 'role' 
        ? `/api/admin/users/${userId}/role` 
        : `/api/admin/users/${userId}/toggle-active`;
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify(data || {}),
      });
      if (!response.ok) throw new Error('작업 실패');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      const actionMsg = variables.action === 'role' ? '권한이 변경' : '상태가 변경';
      toast({ title: `사용자 ${actionMsg}되었습니다` });
      setConfirmAction(null);
    },
    onError: () => {
      toast({ title: '작업 실패', variant: 'destructive' });
    },
  });

  // Create User Mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: typeof userForm) => {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || '생성 실패');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast({ title: '사용자가 생성되었습니다' });
      closeUserDialog();
    },
    onError: (err: Error) => {
      toast({ title: '생성 실패', description: err.message, variant: 'destructive' });
    },
  });

  // Update User Mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: Partial<typeof userForm> }) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('수정 실패');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast({ title: '사용자 정보가 수정되었습니다' });
      closeUserDialog();
    },
    onError: () => {
      toast({ title: '수정 실패', variant: 'destructive' });
    },
  });

  // Delete User Mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${api.getToken()}`,
        },
      });
      if (!response.ok) throw new Error('삭제 실패');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast({ title: '사용자가 삭제되었습니다' });
      setConfirmAction(null);
    },
    onError: () => {
      toast({ title: '삭제 실패', variant: 'destructive' });
    },
  });

  const openCreateDialog = () => {
    setEditingUser(null);
    setUserForm({ email: '', password: '', name: '', role: 'USER', department: '' });
    setShowPassword(false);
    setIsUserDialogOpen(true);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setUserForm({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      department: (user.preferences as any)?.department || user.department || '',
    });
    setIsUserDialogOpen(true);
  };

  const closeUserDialog = () => {
    setIsUserDialogOpen(false);
    setEditingUser(null);
    setUserForm({ email: '', password: '', name: '', role: 'USER', department: '' });
  };

  const handleUserSubmit = () => {
    if (editingUser) {
      updateUserMutation.mutate({
        userId: editingUser.id,
        data: { name: userForm.name, department: userForm.department, email: userForm.email },
      });
    } else {
      if (!userForm.email || !userForm.password || !userForm.name) {
        toast({ title: '필수 항목을 입력하세요', variant: 'destructive' });
        return;
      }
      createUserMutation.mutate(userForm);
    }
  };

  const handleAction = () => {
    if (!confirmAction) return;
    
    if (confirmAction.action === 'role') {
      userMutation.mutate({
        userId: confirmAction.userId,
        action: 'role',
        data: { role: confirmAction.currentRole === 'ADMIN' ? 'USER' : 'ADMIN' },
      });
    } else if (confirmAction.action === 'toggle') {
      userMutation.mutate({ userId: confirmAction.userId, action: 'toggle' });
    } else if (confirmAction.action === 'delete') {
      deleteUserMutation.mutate(confirmAction.userId);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isSubmitting = createUserMutation.isPending || updateUserMutation.isPending;

  return (
    <MainLayout>
      <div className="container max-w-7xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <UserCog className="h-8 w-8" />
              사용자 관리
            </h1>
            <p className="text-muted-foreground mt-1">
              시스템 사용자를 관리하고 권한을 설정합니다
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              새로고침
            </Button>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              사용자 추가
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-blue-500/10 text-blue-600">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">전체 사용자</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-amber-500/10 text-amber-600">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.admins}</p>
                  <p className="text-sm text-muted-foreground">관리자</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-green-500/10 text-green-600">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-sm text-muted-foreground">활성 사용자</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-purple-500/10 text-purple-600">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalQueries.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">총 쿼리 수</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[250px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="이름, 이메일, 부서로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="권한 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">모든 권한</SelectItem>
                  <SelectItem value="ADMIN">관리자</SelectItem>
                  <SelectItem value="USER">일반 사용자</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="상태 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">모든 상태</SelectItem>
                  <SelectItem value="ACTIVE">활성</SelectItem>
                  <SelectItem value="INACTIVE">비활성</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* User List */}
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                사용자 목록 ({filteredUsers.length}명)
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-50" />
                <p>검색 결과가 없습니다</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredUsers.map((user) => {
                  const dept = (user.preferences as any)?.department || user.department;
                  return (
                  <div 
                    key={user.id} 
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center justify-center h-12 w-12 rounded-full font-semibold text-lg ${
                        user.role === 'ADMIN' 
                          ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{user.name}</span>
                          {user.role === 'ADMIN' && (
                            <Badge variant="default" className="gap-1">
                              <Crown className="h-3 w-3" />
                              관리자
                            </Badge>
                          )}
                          {!user.isActive && (
                            <Badge variant="destructive">비활성</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {user.email}
                          </span>
                          {dept && (
                            <span>• {dept}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden md:block">
                        <div className="font-medium text-primary">
                          {(user._count?.queries || 0).toLocaleString()} 쿼리
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          <Calendar className="h-3 w-3" />
                          가입: {formatDate(user.createdAt)}
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(user)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            정보 수정
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setConfirmAction({
                              userId: user.id,
                              action: 'role',
                              userName: user.name,
                              currentRole: user.role,
                            })}
                          >
                            {user.role === 'ADMIN' ? (
                              <>
                                <ShieldOff className="h-4 w-4 mr-2" />
                                일반 사용자로 변경
                              </>
                            ) : (
                              <>
                                <Shield className="h-4 w-4 mr-2" />
                                관리자로 승격
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setConfirmAction({
                              userId: user.id,
                              action: 'toggle',
                              userName: user.name,
                              isActive: user.isActive,
                            })}
                            className={user.isActive ? 'text-orange-600' : 'text-green-600'}
                          >
                            {user.isActive ? (
                              <>
                                <UserX className="h-4 w-4 mr-2" />
                                계정 비활성화
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4 mr-2" />
                                계정 활성화
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setConfirmAction({
                              userId: user.id,
                              action: 'delete',
                              userName: user.name,
                            })}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            사용자 삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );})}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit User Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={(open) => !open && closeUserDialog()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? '사용자 정보 수정' : '새 사용자 추가'}</DialogTitle>
            <DialogDescription>
              {editingUser ? '사용자 정보를 수정합니다' : '새로운 사용자 계정을 생성합니다'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">이름 *</Label>
                <Input
                  id="name"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="홍길동"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">부서</Label>
                <Input
                  id="department"
                  value={userForm.department}
                  onChange={(e) => setUserForm({ ...userForm, department: e.target.value })}
                  placeholder="개발팀"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">이메일 *</Label>
              <Input
                id="email"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="user@example.com"
                disabled={!!editingUser}
              />
            </div>
            
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호 *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="비밀번호 입력"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}
            
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="role">권한</Label>
                <Select value={userForm.role} onValueChange={(v: 'USER' | 'ADMIN') => setUserForm({ ...userForm, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">일반 사용자</SelectItem>
                    <SelectItem value="ADMIN">관리자</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeUserDialog}>취소</Button>
            <Button onClick={handleUserSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingUser ? '저장' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === 'role' && '권한 변경 확인'}
              {confirmAction?.action === 'toggle' && '상태 변경 확인'}
              {confirmAction?.action === 'delete' && '사용자 삭제 확인'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === 'role' && (
                <>
                  <strong>{confirmAction?.userName}</strong> 사용자를 
                  <strong> {confirmAction?.currentRole === 'ADMIN' ? '일반 사용자' : '관리자'}</strong>로 
                  변경하시겠습니까?
                </>
              )}
              {confirmAction?.action === 'toggle' && (
                <>
                  <strong>{confirmAction?.userName}</strong> 계정을 
                  <strong> {confirmAction?.isActive ? '비활성화' : '활성화'}</strong>
                  하시겠습니까?
                  {confirmAction?.isActive && (
                    <span className="block mt-2 text-orange-600">
                      비활성화된 사용자는 로그인할 수 없습니다.
                    </span>
                  )}
                </>
              )}
              {confirmAction?.action === 'delete' && (
                <>
                  <strong>{confirmAction?.userName}</strong> 사용자를 완전히 삭제하시겠습니까?
                  <span className="block mt-2 text-destructive font-medium">
                    ⚠️ 이 작업은 되돌릴 수 없으며, 해당 사용자의 모든 데이터가 삭제됩니다.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAction} 
              disabled={userMutation.isPending || deleteUserMutation.isPending}
              className={confirmAction?.action === 'delete' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {(userMutation.isPending || deleteUserMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {confirmAction?.action === 'delete' ? '삭제' : '확인'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
