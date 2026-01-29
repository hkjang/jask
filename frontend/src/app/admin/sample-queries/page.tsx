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
import { FileText, Plus, Edit2, Trash2, Search, Loader2, Sparkles, HelpCircle, Download, Upload } from 'lucide-react';
import { useState } from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-sql';
import 'prismjs/themes/prism.css';

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
    setExecutionResult(null);
    setExecutionError(null);
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



  // Execution & Fix State
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  const handleTestQuery = async () => {
    if (!formData.dataSourceId || !formData.sqlQuery) {
        toast({ title: '데이터소스와 SQL을 입력해주세요', variant: 'destructive' });
        return;
    }
    setIsExecuting(true);
    setExecutionError(null);
    setExecutionResult(null);
    try {
        const res: any = await api.testSampleQuery(formData.dataSourceId, formData.sqlQuery);
        setExecutionResult(res);
        toast({ title: '실행 성공', description: `${res.rowCount}개의 행이 반환되었습니다.` });
    } catch (e: any) {
        setExecutionError(e.message);
        toast({ title: '실행 실패', description: e.message, variant: 'destructive' });
    } finally {
        setIsExecuting(false);
    }
  };

  const handleFixQuery = async () => {
    if (!formData.dataSourceId || !formData.sqlQuery || !executionError) return;
    setIsFixing(true);
    try {
        const res = await api.fixSampleQuery(formData.dataSourceId, formData.sqlQuery, executionError);
        setFormData({ ...formData, sqlQuery: res.fixedSql });
        setExecutionError(null);
        setExecutionResult(null);
        toast({ title: '수정 완료', description: 'SQL이 수정되었습니다. 다시 실행해보세요.' });
    } catch (e: any) {
        toast({ title: '수정 실패', description: e.message, variant: 'destructive' });
    } finally {
        setIsFixing(false);
    }
  };

  // AI Generation State
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isAiTableSelectOpen, setIsAiTableSelectOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [aiDataSourceId, setAiDataSourceId] = useState<string>('');
  const [aiTableDataSourceId, setAiTableDataSourceId] = useState<string>('');
  const [tableList, setTableList] = useState<any[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [tableSearch, setTableSearch] = useState('');
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [aiCount, setAiCount] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQueries, setGeneratedQueries] = useState<any[]>([]);
  const [selectedGeneratedIndices, setSelectedGeneratedIndices] = useState<Set<number>>(new Set());

  const handleGenerateAI = async (dataSourceId?: string, tableNames?: string[]) => {
    const dsId = dataSourceId || aiDataSourceId;
    if (!dsId) {
        toast({ title: '데이터소스를 선택해주세요', variant: 'destructive' });
        return;
    }

    setIsGenerating(true);
    try {
      const res = await api.generateAISampleQueries(dsId, aiCount, tableNames);
      setGeneratedQueries(res.items);
      setSelectedGeneratedIndices(new Set(res.items.map((_, i) => i))); // Default select all 
    } catch (e: any) {
      toast({
        title: '생성 실패',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGenerated = async () => {
    const selected = generatedQueries.filter((_, i) => selectedGeneratedIndices.has(i));
    if (selected.length === 0) return;

    let successCount = 0;
    const targetDataSourceId = isAiTableSelectOpen ? aiTableDataSourceId : aiDataSourceId;

    if (!targetDataSourceId) {
        toast({ title: '데이터소스를 찾을 수 없습니다.', variant: 'destructive' });
        return;
    }

    try {
        const promises = selected.map(q => 
            api.createSampleQuery({
                dataSourceId: targetDataSourceId,
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
        setIsAiTableSelectOpen(false);
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
                        <div className="flex items-center gap-2">
                            <DialogTitle>AI 샘플 쿼리 자동 생성</DialogTitle>
                            <Button variant="ghost" size="icon" onClick={() => setIsGuideOpen(true)} className="h-6 w-6 rounded-full hover:bg-muted">
                                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </div>
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
                                <Button onClick={() => handleGenerateAI()} disabled={isGenerating || !aiDataSourceId}>
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

            <Button 
                onClick={() => {
                    setAiTableDataSourceId('');
                    setTableList([]);
                    setSelectedTables(new Set());
                    setIsAiTableSelectOpen(true);
                }}
                className="gap-2"
                variant="secondary"
            >
                <Sparkles className="h-4 w-4" />
                AI 생성 (테이블 선택)
            </Button>

            <Dialog open={isAiTableSelectOpen} onOpenChange={setIsAiTableSelectOpen}>
                <DialogContent className="sm:max-w-[1500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle>AI 샘플 쿼리 생성 (테이블 선택)</DialogTitle>
                             <Button variant="ghost" size="icon" onClick={() => setIsGuideOpen(true)} className="h-6 w-6 rounded-full hover:bg-muted">
                                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </Button>
                        </div>
                        <DialogDescription>
                            특정 테이블을 선택하여 해당 테이블과 연관된 질의를 집중적으로 생성합니다.
                        </DialogDescription>
                    </DialogHeader>

                     {!generatedQueries.length ? (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">데이터소스</label>
                                    <Select value={aiTableDataSourceId} onValueChange={async (val) => {
                                        setAiTableDataSourceId(val);
                                        setIsTableLoading(true);
                                        try {
                                            const tables = await api.getTables(val);
                                            setTableList(tables || []);
                                            setSelectedTables(new Set());
                                        } catch(e: any) {
                                            toast({ title: '테이블 로드 실패', description: String(e), variant: 'destructive' });
                                        } finally {
                                            setIsTableLoading(false);
                                        }
                                    }}>
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
                            </div>
                            
                            {aiTableDataSourceId && (
                                <div className="border rounded-md p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium text-sm">테이블 선택 ({selectedTables.size}개)</h4>
                                        <div className="relative w-64">
                                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                placeholder="테이블 검색..." 
                                                className="pl-8 h-9" 
                                                value={tableSearch}
                                                onChange={(e) => setTableSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="h-[300px] overflow-y-auto border rounded bg-background p-2">
                                        {isTableLoading ? (
                                            <div className="flex justify-center items-center h-full">
                                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded cursor-pointer border-b mb-1 pb-2">
                                                    <input 
                                                        type="checkbox" 
                                                        className="accent-primary h-4 w-4"
                                                        checked={selectedTables.size === tableList.length && tableList.length > 0}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedTables(new Set(tableList.map(t => t.tableName)));
                                                            else setSelectedTables(new Set());
                                                        }}
                                                    />
                                                    <span className="text-sm font-medium">전체 선택 / 해제</span>
                                                </div>
                                                {tableList
                                                    .filter(t => t.tableName.toLowerCase().includes(tableSearch.toLowerCase()) || (t.description || '').toLowerCase().includes(tableSearch.toLowerCase()))
                                                    .map((t) => (
                                                    <div 
                                                        key={t.id} 
                                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded cursor-pointer"
                                                        onClick={() => {
                                                            const next = new Set(selectedTables);
                                                            if (next.has(t.tableName)) next.delete(t.tableName);
                                                            else next.add(t.tableName);
                                                            setSelectedTables(next);
                                                        }}
                                                    >
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedTables.has(t.tableName)} 
                                                            readOnly 
                                                            className="accent-primary h-4 w-4 pointer-events-none" 
                                                        />
                                                        <div className="flex-1 overflow-hidden">
                                                            <div className="flex justify-between">
                                                                <span className="text-sm font-medium truncate" title={t.tableName}>{t.tableName}</span>
                                                                <span className="text-xs text-muted-foreground ml-2">{t.columns?.length || 0} cols</span>
                                                            </div>
                                                            {t.description && <p className="text-xs text-muted-foreground truncate" title={t.description}>{t.description}</p>}
                                                        </div>
                                                    </div>
                                                ))}
                                                {tableList.filter(t => t.tableName.toLowerCase().includes(tableSearch.toLowerCase())).length === 0 && (
                                                    <div className="text-center py-8 text-sm text-muted-foreground">
                                                        검색 결과가 없습니다.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                             <div className="pt-4 flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsAiTableSelectOpen(false)}>취소</Button>
                                <Button 
                                    onClick={() => handleGenerateAI(aiTableDataSourceId, Array.from(selectedTables))} 
                                    disabled={isGenerating || !aiTableDataSourceId || selectedTables.size === 0}
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            분석 및 생성 중...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4 mr-2" />
                                            생성 시작 ({selectedTables.size})
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        // Reuse same results UI
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-muted-foreground">{generatedQueries.length}개 생성됨</span>
                                <Button variant="ghost" size="sm" onClick={() => setGeneratedQueries([])}>다시 생성</Button>
                            </div>
                            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
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
                                        <Button variant="outline" onClick={() => setIsAiTableSelectOpen(false)}>닫기</Button>
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

            <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
                    <GuideContent />
                </DialogContent>
            </Dialog>

            <div className="flex gap-2 ml-4 border-l pl-4">
                <Button variant="outline" size="icon" onClick={async () => {
                    try {
                        const dsId = (!selectedDataSource || selectedDataSource === 'all') ? undefined : selectedDataSource;
                        const data = await api.exportSampleQueries(dsId);
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `sample-queries-${dsId || 'all'}-${new Date().toISOString().slice(0,10)}.json`;
                        a.click();
                        window.URL.revokeObjectURL(url);
                    } catch (e) {
                         toast({ title: '내보내기 실패', variant: 'destructive' });
                    }
                }} title="내보내기">
                    <Download className="h-4 w-4" />
                </Button>
                <div className="relative">
                    <input 
                        type="file" 
                        accept=".json" 
                        className="hidden" 
                        id="import-file"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = async (e) => {
                                try {
                                    const json = JSON.parse(e.target?.result as string);
                                    if (!Array.isArray(json)) throw new Error('Invalid format');
                                    if (!confirm(`${json.length}개의 쿼리를 가져오시겠습니까?`)) return;
                                    
                                    const res = await api.importSampleQueries(json);
                                    toast({ 
                                        title: '가져오기 완료', 
                                        description: `성공: ${res.success}, 건너뜀: ${res.skipped}, 실패: ${res.failed}` 
                                    });
                                    queryClient.invalidateQueries({ queryKey: ['sampleQueries'] });
                                } catch (err) {
                                    toast({ title: '가져오기 실패', description: '파일 형식이 올바르지 않습니다.', variant: 'destructive' });
                                }
                            };
                            reader.readAsText(file);
                            // Reset input
                            e.target.value = '';
                        }}
                    />
                    <Button variant="outline" size="icon" onClick={() => document.getElementById('import-file')?.click()} title="가져오기">
                        <Upload className="h-4 w-4" />
                    </Button>
                </div>
            </div>

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
              <DialogContent className="sm:max-w-[900px]">
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
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium">SQL 쿼리</label>
                        <div className="flex gap-2">
                            {executionError && (
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={handleFixQuery} 
                                    disabled={isFixing}
                                    className="h-7 text-xs border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                                >
                                    {isFixing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                                    AI로 수정
                                </Button>
                            )}
                            <Button 
                                size="sm" 
                                variant="secondary" 
                                onClick={handleTestQuery} 
                                disabled={isExecuting || !formData.sqlQuery}
                                className="h-7 text-xs"
                            >
                                {isExecuting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : 'Run'}
                            </Button>
                        </div>
                    </div>

                    <div className={`border rounded-md overflow-hidden ${executionError ? 'border-red-500' : ''}`}>
                        <Editor
                            value={formData.sqlQuery}
                            onValueChange={(code) => setFormData({ ...formData, sqlQuery: code })}
                            highlight={(code) => highlight(code, languages.sql, 'sql')}
                            padding={10}
                            style={{
                                fontFamily: '"Fira code", "Fira Mono", monospace',
                                fontSize: 13,
                                backgroundColor: '#f8f9fa',
                                minHeight: '120px'
                            }}
                            textareaClassName="focus:outline-none"
                        />
                    </div>
                    {executionResult && (
                        <div className="bg-muted p-2 rounded-md text-xs font-mono overflow-auto max-h-32 border border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20">
                            <div className="font-semibold text-green-700 dark:text-green-400 mb-1">
                                ✓ 실행 성공 ({executionResult.rowCount} rows, {executionResult.executionTime}ms)
                            </div>
                            {/* Simple preview of first row if exists */}
                            {executionResult.rows && executionResult.rows.length > 0 && (
                                <pre>{JSON.stringify(executionResult.rows[0], null, 2)}</pre>
                            )}
                        </div>
                    )}
                    {executionError && (
                        <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-md text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                            ⚠ {executionError}
                        </div>
                    )}
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
                                    <pre 
                                        className="text-sm font-mono text-muted-foreground whitespace-pre-wrap"
                                        dangerouslySetInnerHTML={{
                                            __html: highlight(query.sqlQuery, languages.sql, 'sql')
                                        }} 
                                    />
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

function GuideContent() {
  const [activeTab, setActiveTab] = useState<'guide' | 'prompt'>('guide');
  const [promptInfo, setPromptInfo] = useState<{ systemPrompt: string; userPromptTemplate: string } | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);

  const fetchPromptInfo = async () => {
    if (promptInfo) return;
    setIsLoadingPrompt(true);
    try {
      const res = await api.getSampleQueryPrompts();
      setPromptInfo(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            AI 생성 가이드
        </DialogTitle>
        <DialogDescription>
            AI가 샘플 쿼리를 생성하는 과정과 원리에 대해 설명합니다.
        </DialogDescription>
      </DialogHeader>

      <div className="flex border-b mb-4 mt-2">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'guide' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('guide')}
        >
          가이드
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'prompt' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => {
            setActiveTab('prompt');
            fetchPromptInfo();
          }}
        >
          프롬프트 정보
        </button>
      </div>

      {activeTab === 'guide' ? (
        <div className="space-y-6 py-2">
            <div className="flex gap-4">
                <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">1</div>
                <div>
                    <h4 className="font-semibold text-sm">데이터소스 선택</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                        분석할 데이터베이스를 선택합니다. AI가 선택된 DB의 테이블 구조와 컬럼 정보를 읽어옵니다.
                    </p>
                </div>
            </div>
            <div className="flex gap-4">
                <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">2</div>
                <div>
                    <h4 className="font-semibold text-sm">스키마 분석 및 생성</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                        선택한 데이터베이스의 테이블, 컬럼, 외래 키 관계를 <strong>심층 분석</strong>합니다. 
                        이를 기반으로 단순 조회뿐만 아니라 조인(JOIN), 집계(Aggregation) 등이 포함된 
                        <strong>실무 수준의 비즈니스 질의</strong>와 정확한 SQL 쿼리 쌍을 자동으로 생성합니다.
                    </p>
                </div>
            </div>
            <div className="flex gap-4">
                <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">3</div>
                <div>
                    <h4 className="font-semibold text-sm">검토 및 저장</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                        생성된 목록에서 원하는 항목을 선택하여 저장합니다. 저장된 쿼리는 나중에 NL2SQL의 학습 예제로 활용됩니다.
                    </p>
                </div>
            </div>
        </div>
      ) : (
        <div className="space-y-4 py-2">
            <div>
                <h4 className="font-semibold text-sm mb-2">시스템 프롬프트 (System Prompt)</h4>
                <p className="text-sm text-muted-foreground mb-3">
                    샘플 쿼리 생성 시 AI에게 부여되는 페르소나와 지침입니다.
                </p>
                {isLoadingPrompt ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="bg-muted p-3 rounded-md overflow-x-auto max-h-[250px] mb-4">
                        <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">
                            {promptInfo?.systemPrompt || '시스템 프롬프트 정보를 불러올 수 없습니다.'}
                        </pre>
                    </div>
                )}
            </div>

            <div>
                <h4 className="font-semibold text-sm mb-2">사용자 프롬프트 템플릿 (User Prompt Template)</h4>
                <p className="text-sm text-muted-foreground mb-3">
                    스키마 컨텍스트와 함께 AI에게 전달되는 실제 요청 포맷입니다.
                </p>
                {!isLoadingPrompt && (
                    <div className="bg-muted p-3 rounded-md overflow-x-auto max-h-[200px]">
                         <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">
                            {promptInfo?.userPromptTemplate || '사용자 프롬프트 정보를 불러올 수 없습니다.'}
                        </pre>
                    </div>
                )}
            </div>
        </div>
      )}

      <DialogFooter className="mt-4">
          <DialogTrigger asChild>
            {/* Close handled by parent dialog state, but trigger needed for accessible closing if button inside */}
          </DialogTrigger>
      </DialogFooter>
    </>
  );
}
