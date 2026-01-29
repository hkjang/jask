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
import { FileText, Plus, Edit2, Trash2, Search, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface SampleQuery {
  id: string;
  naturalQuery: string;
  sqlQuery: string;
  category?: string;
  dataSourceId: string;
  createdAt: string;
  analysis?: {
    tables: string[];
    columns: string[];
  };
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

  // Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleBulkAction = async (action: 'DELETE' | 'ACTIVATE' | 'DEACTIVATE') => {
      if (selectedIds.size === 0) return;
      if (action === 'DELETE' && !confirm('선택한 항목을 삭제하시겠습니까?')) return;

      try {
          await api.bulkUpdateSampleQueries(Array.from(selectedIds), action);
          toast({ title: '일괄 작업이 완료되었습니다' });
          setSelectedIds(new Set());
          queryClient.invalidateQueries({ queryKey: ['sampleQueries'] });
      } catch (e) {
          toast({ title: '작업 실패', variant: 'destructive' });
      }
  };

  const toggleSelectAll = (checked: boolean) => {
      if (checked) {
          setSelectedIds(new Set(sampleQueries.map((q: SampleQuery) => q.id)));
      } else {
          setSelectedIds(new Set());
      }
  };


  // AI Generation State
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiDataSourceId, setAiDataSourceId] = useState<string>('');
  const [aiCount, setAiCount] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQueries, setGeneratedQueries] = useState<any[]>([]);
  const [selectedGeneratedIndices, setSelectedGeneratedIndices] = useState<Set<number>>(new Set());

  const handleGenerateAI = async () => {
    if (!aiDataSourceId) {
        toast({ title: '데이터소스를 선택해주세요', variant: 'destructive' });
        return;
    }
    setIsGenerating(true);
    try {
        const res = await api.generateAISampleQueries(aiDataSourceId, aiCount);
        setGeneratedQueries(res.items);
        setSelectedGeneratedIndices(new Set(res.items.map((_, i) => i))); // Select all by default
    } catch (e) {
        toast({ title: '생성 실패', description: 'AI 생성 중 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
        setIsGenerating(false);
    }
  };

  const handleSaveGenerated = async () => {
    const selected = generatedQueries.filter((_, i) => selectedGeneratedIndices.has(i));
    if (selected.length === 0) return;

    let successCount = 0;
    try {
        const promises = selected.map(q => 
            api.createSampleQuery({
                dataSourceId: aiDataSourceId,
                naturalQuery: q.naturalQuery,
                sqlQuery: q.sqlQuery,
                description: q.description,
                category: 'AI Generated'
            }).then(() => successCount++)
        );
        await Promise.all(promises);
        
        toast({ title: `${successCount}개의 쿼리가 저장되었습니다` });
        setGeneratedQueries([]);
        setIsAiDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['sampleQueries'] });
    } catch (e) {
        toast({ title: '저장 실패', variant: 'destructive' });
    }
  };


  return (
    <MainLayout>
      <div className="w-full px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8" />
              샘플 쿼리 관리
            </h1>
            <p className="text-muted-foreground">NL2SQL 학습 및 예시를 위한 샘플 쿼리를 관리합니다</p>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto items-center">
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 mr-4 bg-muted/50 px-3 py-1.5 rounded-md animate-in fade-in slide-in-from-right-5">
                    <span className="text-sm font-medium">{selectedIds.size}개 선택됨</span>
                    <div className="h-4 w-px bg-border mx-1" />
                    <Button variant="ghost" size="sm" onClick={() => handleBulkAction('ACTIVATE')} className="h-7 text-xs">활성화</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleBulkAction('DEACTIVATE')} className="h-7 text-xs">비활성화</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleBulkAction('DELETE')} className="h-7 text-xs text-destructive hover:text-destructive">삭제</Button>
                </div>
            )}

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

            <Dialog open={isAiDialogOpen} onOpenChange={(open) => {
                setIsAiDialogOpen(open);
                if (!open) {
                    setGeneratedQueries([]);
                    setIsGenerating(false);
                }
            }}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                        <Sparkles className="h-4 w-4 text-yellow-500" />
                        AI 생성
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>AI 샘플 쿼리 자동 생성</DialogTitle>
                        <DialogDescription>
                            데이터베이스 스키마를 분석하여 유의미한 질의-SQL 쌍을 자동으로 생성합니다.
                        </DialogDescription>
                    </DialogHeader>

                    {!generatedQueries.length ? (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">데이터소스</label>
                                <Select value={aiDataSourceId} onValueChange={setAiDataSourceId}>
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
                                <label className="text-sm font-medium">생성 개수 ({aiCount}개)</label>
                                <Input 
                                    type="range" 
                                    min="1" 
                                    max="10" 
                                    value={aiCount} 
                                    onChange={(e) => setAiCount(parseInt(e.target.value))} 
                                    className="cursor-pointer"
                                />
                            </div>
                             <div className="pt-4 flex justify-end">
                                <Button onClick={handleGenerateAI} disabled={isGenerating || !aiDataSourceId}>
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            분석 및 생성 중...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4 mr-2" />
                                            생성 시작
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-muted-foreground">{generatedQueries.length}개 생성됨</span>
                                <Button variant="ghost" size="sm" onClick={() => setGeneratedQueries([])}>다시 생성</Button>
                            </div>
                            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                                {generatedQueries.map((q, i) => (
                                    <Card key={i} className={`border cursor-pointer transition-colors ${selectedGeneratedIndices.has(i) ? 'border-primary bg-primary/5' : ''}`}
                                        onClick={() => {
                                            const next = new Set(selectedGeneratedIndices);
                                            if (next.has(i)) next.delete(i);
                                            else next.add(i);
                                            setSelectedGeneratedIndices(next);
                                        }}
                                    >
                                        <CardContent className="p-3">
                                            <div className="flex gap-3">
                                                <div className="mt-1">
                                                    <input type="checkbox" checked={selectedGeneratedIndices.has(i)} readOnly className="accent-primary h-4 w-4" />
                                                </div>
                                                <div className="space-y-1 flex-1">
                                                    <p className="font-medium text-sm">{q.naturalQuery}</p>
                                                    <code className="block text-xs bg-muted p-1.5 rounded font-mono text-muted-foreground break-all">
                                                        {q.sqlQuery}
                                                    </code>
                                                    {q.description && <p className="text-xs text-muted-foreground">{q.description}</p>}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            <DialogFooter>
                                <div className="flex justify-between w-full items-center">
                                    <span className="text-sm text-muted-foreground">
                                        {selectedGeneratedIndices.size}개 선택됨
                                    </span>
                                    <div className="flex gap-2">
                                        <Button variant="outline" onClick={() => setIsAiDialogOpen(false)}>취소</Button>
                                        <Button onClick={handleSaveGenerated} disabled={selectedGeneratedIndices.size === 0}>
                                            선택 항목 저장
                                        </Button>
                                    </div>
                                </div>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

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

                  {editingQuery && editingQuery.analysis && (
                      <div className="space-y-2 bg-muted/50 p-3 rounded-md">
                        <label className="text-sm font-medium">분석된 메타데이터</label>
                          {editingQuery.analysis.tables && editingQuery.analysis.tables.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 items-center text-xs">
                                  <span className="font-semibold text-muted-foreground mr-1">Tables:</span>
                                  {editingQuery.analysis.tables.map((table, idx) => (
                                      <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800">
                                          {table}
                                      </span>
                                  ))}
                              </div>
                          )}
                          {editingQuery.analysis.columns && editingQuery.analysis.columns.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 items-center text-xs">
                                  <span className="font-semibold text-muted-foreground mr-1">Columns:</span>
                                  {editingQuery.analysis.columns.map((col, idx) => (
                                      <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700">
                                          {col}
                                      </span>
                                  ))}
                              </div>
                          )}
                      </div>
                    )}
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
                                    <h3 
                                        className="font-semibold text-lg cursor-pointer hover:underline hover:text-primary transition-colors"
                                        onClick={() => openEdit(query)}
                                    >
                                        {query.naturalQuery}
                                    </h3>
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
                                {query.analysis && (
                                    <div className="mt-3 space-y-2">
                                        {query.analysis.tables && query.analysis.tables.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 items-center text-xs">
                                                <span className="font-semibold text-muted-foreground mr-1">Tables:</span>
                                                {query.analysis.tables.map((table, idx) => (
                                                    <span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800">
                                                        {table}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {query.analysis.columns && query.analysis.columns.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 items-center text-xs">
                                                <span className="font-semibold text-muted-foreground mr-1">Columns:</span>
                                                {query.analysis.columns.map((col, idx) => (
                                                    <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700">
                                                        {col}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
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
