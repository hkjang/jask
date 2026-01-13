'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Plus, Edit2, Trash2, Search, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface SampleQuery {
  id: string;
  naturalQuery: string;
  sqlQuery: string;
  category?: string;
  dataSourceId: string;
  createdAt: string;
}

interface DataSource {
  id: string;
  name: string;
  type: string;
}

export default function AdminSampleQueriesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedDataSource, setSelectedDataSource] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuery, setEditingQuery] = useState<SampleQuery | null>(null);
  
  const [formData, setFormData] = useState({
    naturalQuery: '',
    sqlQuery: '',
    dataSourceId: '',
    category: '',
  });

  // Fetch DataSources
  const { data: dataSources = [] } = useQuery({
    queryKey: ['datasources'],
    queryFn: async () => {
        const res: any = await api.getDataSources();
        return res as DataSource[];
    },
  });

  // Fetch Sample Queries
  const { data: sampleQueries = [], isLoading } = useQuery({
    queryKey: ['sampleQueries', selectedDataSource],
    queryFn: async () => {
      const dataSourceId = selectedDataSource === 'all' ? undefined : selectedDataSource;
      const res: any = await api.getSampleQueries(dataSourceId);
      return res as SampleQuery[];
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ method, id, data }: { method: 'POST' | 'PUT' | 'DELETE'; id?: string; data?: any }) => {
      if (method === 'DELETE') return api.deleteSampleQuery(id!);
      if (method === 'PUT') return api.updateSampleQuery(id!, data);
      return api.createSampleQuery(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sampleQueries'] });
      const action = variables.method === 'POST' ? '생성' : variables.method === 'PUT' ? '수정' : '삭제';
      toast({ title: `샘플 쿼리가 ${action}되었습니다` });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => toast({ title: '작업 실패', variant: 'destructive' }),
  });

  const resetForm = () => {
    setFormData({ naturalQuery: '', sqlQuery: '', dataSourceId: '', category: '' });
    setEditingQuery(null);
  };

  const openEdit = (query: SampleQuery) => {
    setEditingQuery(query);
    setFormData({
      naturalQuery: query.naturalQuery,
      sqlQuery: query.sqlQuery,
      dataSourceId: query.dataSourceId,
      category: query.category || '',
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.dataSourceId) {
      toast({ title: '데이터소스를 선택해주세요', variant: 'destructive' });
      return;
    }
    if (editingQuery) {
      mutation.mutate({ method: 'PUT', id: editingQuery.id, data: formData });
    } else {
      mutation.mutate({ method: 'POST', data: formData });
    }
  };

  return (
    <MainLayout>
      <div className="container max-w-6xl py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8" />
              샘플 쿼리 관리
            </h1>
            <p className="text-muted-foreground">NL2SQL 학습 및 예시를 위한 샘플 쿼리를 관리합니다</p>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <Select value={selectedDataSource} onValueChange={setSelectedDataSource}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="데이터소스 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 데이터소스</SelectItem>
                {dataSources.map((ds: DataSource) => (
                  <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  쿼리 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>{editingQuery ? '샘플 쿼리 수정' : '새 샘플 쿼리'}</DialogTitle>
                  <DialogDescription>
                    자연어 질문과 그에 해당하는 SQL 쿼리를 입력하세요.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">데이터소스</label>
                        <Select 
                            value={formData.dataSourceId} 
                            onValueChange={(val) => setFormData({ ...formData, dataSourceId: val })}
                        >
                        <SelectTrigger>
                            <SelectValue placeholder="선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                            {dataSources.map((ds: DataSource) => (
                            <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">카테고리</label>
                        <Input
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            placeholder="예: Sales, Users"
                        />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">자연어 질문</label>
                    <Input
                      value={formData.naturalQuery}
                      onChange={(e) => setFormData({ ...formData, naturalQuery: e.target.value })}
                      placeholder="예: 이번 달 가입자 수는?"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">SQL 쿼리</label>
                    <Textarea
                      value={formData.sqlQuery}
                      onChange={(e) => setFormData({ ...formData, sqlQuery: e.target.value })}
                      placeholder="SELECT count(*) FROM users WHERE ..."
                      rows={5}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
                  <Button onClick={handleSubmit} disabled={mutation.isPending}>
                    {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    저장
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
           <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4">
            {sampleQueries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg">
                    등록된 샘플 쿼리가 없습니다.
                </div>
            ) : (
                sampleQueries.map((query: SampleQuery) => (
                    <Card key={query.id}>
                        <CardContent className="flex items-start justify-between p-6">
                            <div className="space-y-2 flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-lg">{query.naturalQuery}</h3>
                                    {query.category && (
                                        <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                                            {query.category}
                                        </span>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                        • {dataSources.find(d => d.id === query.dataSourceId)?.name || 'Unknown DB'}
                                    </span>
                                </div>
                                <div className="bg-muted p-3 rounded-md overflow-x-auto">
                                    <code className="text-sm font-mono text-muted-foreground whitespace-pre-wrap">
                                        {query.sqlQuery}
                                    </code>
                                </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(query)}>
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>샘플 쿼리 삭제</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        이 샘플 쿼리를 삭제하시겠습니까?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>취소</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => mutation.mutate({ method: 'DELETE', id: query.id })}
                                      >
                                        삭제
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardContent>
                    </Card>
                ))
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
