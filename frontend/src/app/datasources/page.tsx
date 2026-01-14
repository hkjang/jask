'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { Database, Plus, RefreshCw, CheckCircle, Loader2, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
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

export default function DataSourcesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    schema: 'public',
  });

  // Edit State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDataSource, setEditingDataSource] = useState<any>(null);
  const [editForm, setEditForm] = useState(formData);
  const [isTestingEdit, setIsTestingEdit] = useState(false);

  // Delete State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dataSourceToDelete, setDataSourceToDelete] = useState<any>(null);

  const { data: dataSources = [], isLoading } = useQuery({
    queryKey: ['dataSources'],
    queryFn: () => api.getDataSources(),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createDataSource(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dataSources'] });
      toast({ title: '데이터소스가 생성되었습니다' });
      setShowForm(false);
      setFormData({ name: '', type: 'postgresql', host: 'localhost', port: 5432, database: '', username: '', password: '', schema: 'public' });
    },
    onError: (error: Error) => {
      toast({ title: '생성 실패', description: error.message, variant: 'destructive' });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => api.syncMetadata(id),
    onSuccess: (data: any) => {
      toast({ title: '동기화 완료', description: `${data.tables}개 테이블, ${data.columns}개 컬럼` });
    },
    onError: (error: Error) => {
      toast({ title: '동기화 실패', description: error.message, variant: 'destructive' });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => api.testConnection(formData),
    onSuccess: () => {
      toast({ title: '연결 성공' });
    },
    onError: (error: Error) => {
      toast({ title: '연결 실패', description: error.message, variant: 'destructive' });
    },
  });

  // Edit Handlers
  const handleEditClick = (ds: any) => {
    setEditingDataSource(ds);
    setEditForm({
      name: ds.name,
      type: ds.type,
      host: ds.host,
      port: ds.port,
      database: ds.database,
      username: ds.username,
      password: '', // Don't show password
      schema: ds.schema || 'public',
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
      
      await api.updateDataSource(editingDataSource.id, updateData);
      toast({ title: '업데이트 성공' });
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['dataSources'] });
    } catch (error: any) {
      toast({ title: '업데이트 실패', description: error.message, variant: 'destructive' });
    }
  };

  // Delete Handlers
  const confirmDeleteClick = (ds: any) => {
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
    } catch (error: any) {
      toast({ title: '삭제 실패', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <MainLayout>
      <div className="container max-w-5xl py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">데이터소스</h1>
            <p className="text-muted-foreground">연결할 데이터베이스를 관리하세요</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            새 연결
          </Button>
        </div>

        {/* Create Form */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader><CardTitle>새 데이터소스 연결</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">이름</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Production DB"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">타입</label>
                  <select
                    value={formData.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      let newPort = formData.port;
                      if (newType === 'oracle') newPort = 1521;
                      else if (newType === 'postgresql') newPort = 5432;
                      else if (newType === 'mysql') newPort = 3306;
                      setFormData({ ...formData, type: newType, port: newPort });
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="postgresql">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="oracle">Oracle</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">호스트</label>
                  <Input
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">포트</label>
                  <Input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">데이터베이스</label>
                  <Input
                    value={formData.database}
                    onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{formData.type === 'oracle' ? '서비스 이름' : '스키마'}</label>
                  <Input
                    value={formData.schema}
                    onChange={(e) => setFormData({ ...formData, schema: e.target.value })}
                    placeholder={formData.type === 'oracle' ? 'ORCL' : 'public'}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">사용자</label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">비밀번호</label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                  {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  연결 테스트
                </Button>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  생성
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* DataSource List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">로딩 중...</div>
        ) : dataSources.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">연결된 데이터소스가 없습니다</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {dataSources.map((ds: any) => (
              <Card key={ds.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Database className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{ds.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {ds.type} · {ds.host}:{ds.port}/{ds.database} · {ds._count?.tables || 0}개 테이블
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncMutation.mutate(ds.id)}
                    disabled={syncMutation.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                    동기화
                  </Button>
                  
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
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => confirmDeleteClick(ds)}>
                              <Trash2 className="h-4 w-4 mr-2" /> 삭제
                          </DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
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
                      <Label>타입</Label>
                        <Select value={editForm.type} onValueChange={(val) => {
                          let newPort = editForm.port;
                          if (val === 'oracle') newPort = 1521;
                          else if (val === 'postgresql') newPort = 5432;
                          else if (val === 'mysql') newPort = 3306;
                          setEditForm({...editForm, type: val, port: newPort});
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder="타입 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                                <SelectItem value="mysql">MySQL</SelectItem>
                                <SelectItem value="oracle">Oracle</SelectItem>
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
                        placeholder={editForm.type === 'oracle' ? 'ORCL' : 'public'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>사용자</Label>
                      <Input
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>비밀번호</Label>
                      <Input
                        type="password"
                        placeholder="변경시에만 입력"
                        value={editForm.password}
                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      />
                    </div>
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

        {/* Delete Alert Dialog */}
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
    </MainLayout>
  );
}
