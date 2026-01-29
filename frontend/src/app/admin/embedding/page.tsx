'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import {
  Search,
  Settings2,
  Database,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Sparkles,
  Zap,
  Clock,
  Hash,
  BarChart3,
  Play,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { useState } from 'react';

interface EmbeddingConfig {
  id: string;
  name: string;
  description?: string;
  topK: number;
  searchMethod: 'DENSE' | 'SPARSE' | 'HYBRID';
  denseWeight: number;
  sparseWeight: number;
  rrfK: number;
  embeddingModel?: string;
  dimensions: number;
  isActive: boolean;
  dataSourceId?: string;
  createdAt: string;
}

interface EmbeddableItem {
  id: string;
  type: string;
  sourceId?: string;
  content: string;
  tokenCount: number;
  isActive: boolean;
  lastEmbeddedAt?: string;
  dataSourceId?: string;
  metadata?: any;
}

interface SearchResult {
  id: string;
  content: string;
  type: string;
  denseScore?: number;
  sparseScore?: number;
  hybridScore?: number;
  metadata?: any;
}

export default function EmbeddingManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog states
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isSampleDialogOpen, setIsSampleDialogOpen] = useState(false); // For Sample Query
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<string>('TABLE'); // 'TABLE' | 'SAMPLE_QUERY'
  const [editingConfig, setEditingConfig] = useState<EmbeddingConfig | null>(null);
  const [configForm, setConfigForm] = useState({
    name: '',
    description: '',
    topK: 10,
    searchMethod: 'HYBRID' as 'DENSE' | 'SPARSE' | 'HYBRID',
    denseWeight: 0.7,
    sparseWeight: 0.3,
    rrfK: 60,
    embeddingModel: '',
    dimensions: 768,
    dataSourceId: '',
  });

  // Search test state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMethod, setSearchMethod] = useState<'DENSE' | 'SPARSE' | 'HYBRID'>('HYBRID');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTiming, setSearchTiming] = useState<any>(null);

  // Fetch data
  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ['embeddingConfigs'],
    queryFn: () => api.getEmbeddingConfigs(),
  });

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['embeddableItems', selectedType],
    queryFn: () => api.getEmbeddableItems({ limit: 50, type: selectedType }),
  });

  const { data: dataSources = [] } = useQuery({
    queryKey: ['dataSources'],
    queryFn: () => api.getDataSources(),
  });

  const items = itemsData?.items || [];
  const totalItems = itemsData?.total || 0;

  // Mutations
  const configMutation = useMutation({
    mutationFn: async ({ method, id, data }: { method: 'POST' | 'PUT' | 'DELETE'; id?: string; data?: any }) => {
      if (method === 'DELETE') return api.deleteEmbeddingConfig(id!);
      if (method === 'PUT') return api.updateEmbeddingConfig(id!, data);
      return api.createEmbeddingConfig(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['embeddingConfigs'] });
      const action = variables.method === 'POST' ? '생성' : variables.method === 'PUT' ? '수정' : '삭제';
      toast({ title: `설정이 ${action}되었습니다` });
      setIsConfigDialogOpen(false);
      resetConfigForm();
    },
    onError: () => toast({ title: '작업 실패', variant: 'destructive' }),
  });

  const syncMetadataMutation = useMutation({
    mutationFn: () => api.syncAllEmbeddings(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['embeddableItems'] });
      toast({
        title: '메타데이터 동기화 완료',
        description: `동기화: ${data.synced}건, 오류: ${data.errors}건`,
      });
    },
    onError: () => toast({ title: '동기화 실패', variant: 'destructive' }),
  });

  const batchEmbedMutation = useMutation({
    mutationFn: (options?: { dataSourceId?: string; forceRegenerate?: boolean }) =>
      api.batchGenerateEmbeddings(options),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['embeddableItems'] });
      toast({
        title: '배치 임베딩 완료',
        description: `성공: ${data.success}, 실패: ${data.failed}, 스킵: ${data.skipped}`,
      });
    },
    onError: () => toast({ title: '배치 작업 실패', variant: 'destructive' }),
  });

  const searchMutation = useMutation({
    mutationFn: (data: { query: string; searchMethod: string }) =>
      api.embeddingSearch({ query: data.query, searchMethod: data.searchMethod as any }),
    onSuccess: (data) => {
      setSearchResults(data.results);
      setSearchTiming(data.timing);
    },
    onError: () => toast({ title: '검색 실패', variant: 'destructive' }),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return api.updateEmbeddableItem(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embeddableItems'] });
      toast({ title: '항목이 수정되었습니다' });
    },
    onError: () => toast({ title: '수정 실패', variant: 'destructive' }),
  });

  const generateEmbeddingMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.generateItemEmbedding(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embeddableItems'] });
      toast({ title: '임베딩이 생성되었습니다' });
    },
    onError: () => toast({ title: '임베딩 생성 실패', variant: 'destructive' }),
  });

  const resetConfigForm = () => {
    setConfigForm({
      name: '',
      description: '',
      topK: 10,
      searchMethod: 'HYBRID',
      denseWeight: 0.7,
      sparseWeight: 0.3,
      rrfK: 60,
      embeddingModel: '',
      dimensions: 768,
      dataSourceId: '',
    });
    setEditingConfig(null);
  };

  const openEditConfig = (config: EmbeddingConfig) => {
    setEditingConfig(config);
    setConfigForm({
      name: config.name,
      description: config.description || '',
      topK: config.topK,
      searchMethod: config.searchMethod,
      denseWeight: config.denseWeight,
      sparseWeight: config.sparseWeight,
      rrfK: config.rrfK,
      embeddingModel: config.embeddingModel || '',
      dimensions: config.dimensions,
      dataSourceId: config.dataSourceId || '',
    });
    setIsConfigDialogOpen(true);
  };

  const handleConfigSubmit = () => {
    if (editingConfig) {
      configMutation.mutate({ method: 'PUT', id: editingConfig.id, data: configForm });
    } else {
      configMutation.mutate({ method: 'POST', data: configForm });
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    searchMutation.mutate({ query: searchQuery, searchMethod });
  };

  const getSearchMethodBadge = (method: string) => {
    switch (method) {
      case 'DENSE':
        return <Badge variant="default">Dense (벡터)</Badge>;
      case 'SPARSE':
        return <Badge variant="secondary">Sparse (BM25)</Badge>;
      case 'HYBRID':
        return <Badge className="bg-gradient-to-r from-blue-500 to-purple-500">Hybrid</Badge>;
      default:
        return <Badge variant="outline">{method}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      TABLE: 'bg-blue-500/10 text-blue-600',
      COLUMN: 'bg-green-500/10 text-green-600',
      SAMPLE_QUERY: 'bg-yellow-500/10 text-yellow-600',
      DOCUMENT: 'bg-purple-500/10 text-purple-600',
      CUSTOM: 'bg-gray-500/10 text-gray-600',
    };
    return (
      <Badge variant="outline" className={colors[type] || ''}>
        {type}
      </Badge>
    );
  };

  return (
    <MainLayout>
      <div className="w-full px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8" />
            임베딩 관리
          </h1>
          <p className="text-muted-foreground">
            임베딩 설정 및 하이브리드 검색 (Dense + BM25) 관리
          </p>
        </div>

        <Tabs defaultValue="configs" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="configs" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              검색 설정
            </TabsTrigger>
            <TabsTrigger value="items" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              임베딩 항목
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              검색 테스트
            </TabsTrigger>
          </TabsList>

          {/* Configs Tab */}
          <TabsContent value="configs" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">검색 설정</h2>
                <p className="text-sm text-muted-foreground">
                  top-k, 검색 방법, 가중치 등을 관리합니다
                </p>
              </div>
              <Dialog
                open={isConfigDialogOpen}
                onOpenChange={(open) => {
                  setIsConfigDialogOpen(open);
                  if (!open) resetConfigForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    설정 추가
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingConfig ? '검색 설정 수정' : '새 검색 설정'}
                    </DialogTitle>
                    <DialogDescription>
                      하이브리드 검색 파라미터를 설정하세요
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">설정 이름</label>
                        <Input
                          value={configForm.name}
                          onChange={(e) =>
                            setConfigForm({ ...configForm, name: e.target.value })
                          }
                          placeholder="default-config"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">데이터소스</label>
                        <Select
                          value={configForm.dataSourceId || 'ALL'}
                          onValueChange={(value) =>
                            setConfigForm({
                              ...configForm,
                              dataSourceId: value === 'ALL' ? '' : value,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="전체 (선택사항)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">전체</SelectItem>
                            {dataSources.map((ds: any) => (
                              <SelectItem key={ds.id} value={ds.id}>
                                {ds.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">설명</label>
                      <Textarea
                        value={configForm.description}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, description: e.target.value })
                        }
                        placeholder="설정에 대한 설명 (선택사항)"
                        rows={2}
                      />
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold mb-3">검색 파라미터</h4>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">검색 방법</label>
                          <Select
                            value={configForm.searchMethod}
                            onValueChange={(value: any) =>
                              setConfigForm({ ...configForm, searchMethod: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="HYBRID">Hybrid (Dense + BM25)</SelectItem>
                              <SelectItem value="DENSE">Dense (벡터 유사도)</SelectItem>
                              <SelectItem value="SPARSE">Sparse (BM25 키워드)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Top-K</label>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={configForm.topK}
                            onChange={(e) =>
                              setConfigForm({
                                ...configForm,
                                topK: parseInt(e.target.value) || 10,
                              })
                            }
                          />
                        </div>
                      </div>

                      {configForm.searchMethod === 'HYBRID' && (
                        <div className="mt-4 space-y-4">
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <label className="text-sm font-medium">
                                Dense 가중치: {configForm.denseWeight.toFixed(2)}
                              </label>
                              <label className="text-sm font-medium">
                                Sparse 가중치: {configForm.sparseWeight.toFixed(2)}
                              </label>
                            </div>
                            <Slider
                              value={[configForm.denseWeight * 100]}
                              min={0}
                              max={100}
                              step={5}
                              onValueChange={([value]) => {
                                const dense = value / 100;
                                setConfigForm({
                                  ...configForm,
                                  denseWeight: dense,
                                  sparseWeight: 1 - dense,
                                });
                              }}
                            />
                            <p className="text-xs text-muted-foreground">
                              Dense(벡터)와 Sparse(BM25) 검색 결과 결합 비율
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">RRF k 파라미터</label>
                            <Input
                              type="number"
                              min={1}
                              value={configForm.rrfK}
                              onChange={(e) =>
                                setConfigForm({
                                  ...configForm,
                                  rrfK: parseInt(e.target.value) || 60,
                                })
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              Reciprocal Rank Fusion의 k 값 (기본: 60)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold mb-3">임베딩 설정</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">임베딩 모델 (선택)</label>
                          <Input
                            value={configForm.embeddingModel}
                            onChange={(e) =>
                              setConfigForm({
                                ...configForm,
                                embeddingModel: e.target.value,
                              })
                            }
                            placeholder="nomic-embed-text"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">임베딩 차원</label>
                          <Input
                            type="number"
                            value={configForm.dimensions}
                            onChange={(e) =>
                              setConfigForm({
                                ...configForm,
                                dimensions: parseInt(e.target.value) || 768,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
                      취소
                    </Button>
                    <Button onClick={handleConfigSubmit} disabled={configMutation.isPending}>
                      {configMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {editingConfig ? '수정' : '생성'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {configsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : configs.length === 0 ? (
              <Card className="py-12">
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <Settings2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">검색 설정이 없습니다</h3>
                  <p className="text-muted-foreground">
                    새 설정을 추가하여 검색 파라미터를 관리하세요
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {configs.map((config: EmbeddingConfig) => (
                  <Card
                    key={config.id}
                    className={`transition-all ${!config.isActive ? 'opacity-50' : ''}`}
                  >
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-500/10 text-purple-500">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{config.name}</p>
                            {getSearchMethodBadge(config.searchMethod)}
                            {config.isActive ? (
                              <Badge variant="success">활성</Badge>
                            ) : (
                              <Badge variant="secondary">비활성</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              Top-K: {config.topK}
                            </span>
                            {config.searchMethod === 'HYBRID' && (
                              <>
                                <span>Dense: {(config.denseWeight * 100).toFixed(0)}%</span>
                                <span>Sparse: {(config.sparseWeight * 100).toFixed(0)}%</span>
                              </>
                            )}
                            {config.description && (
                              <span className="text-xs">{config.description}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditConfig(config)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>설정 삭제</AlertDialogTitle>
                              <AlertDialogDescription>
                                정말 <strong>{config.name}</strong> 설정을 삭제하시겠습니까?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() =>
                                  configMutation.mutate({ method: 'DELETE', id: config.id })
                                }
                              >
                                삭제
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">임베딩 항목</h2>
                  <p className="text-sm text-muted-foreground">
                    임베딩된 항목 {totalItems}개
                  </p>
                </div>
                <div className="flex gap-2">
                  {selectedType === 'SAMPLE_QUERY' && (
                    <Button onClick={() => window.location.href = '/admin/sample-queries'}>
                        <Plus className="h-4 w-4 mr-2" />
                        샘플 쿼리 관리 이동
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => syncMetadataMutation.mutate()}
                    disabled={syncMetadataMutation.isPending}
                  >
                    {syncMetadataMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4 mr-2" />
                    )}
                    메타데이터 동기화
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => batchEmbedMutation.mutate({})}
                    disabled={batchEmbedMutation.isPending}
                  >
                    {batchEmbedMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    배치 임베딩
                  </Button>
                </div>
              </div>

              <Tabs value={selectedType} onValueChange={(val) => setSelectedType(val)} className="w-full">
                <TabsList className="grid w-full grid-cols-4 max-w-2xl">
                  <TabsTrigger value="TABLE">테이블</TabsTrigger>
                  <TabsTrigger value="COLUMN">컬럼</TabsTrigger>
                  <TabsTrigger value="SAMPLE_QUERY">샘플 쿼리</TabsTrigger>
                  <TabsTrigger value="DOCUMENT">문서</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {itemsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <Card className="py-12">
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <Database className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">임베딩 항목이 없습니다</h3>
                  <p className="text-muted-foreground">
                    메타데이터 동기화 시 자동으로 추가됩니다
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2">
                {items.map((item: EmbeddableItem) => (
                  <Card 
                    key={item.id} 
                    className="py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedItem(item)}
                  >
                    <CardContent className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getTypeBadge(item.type)}
                        <p className="text-sm truncate flex-1">{item.content.slice(0, 100)}...</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {item.tokenCount} 토큰
                          </span>
                          {item.lastEmbeddedAt ? (
                            <Badge variant="success" className="text-xs">
                              임베딩됨
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              대기중
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 mx-4">
                          <Switch
                            checked={item.isActive}
                            onCheckedChange={(checked) => {
                              updateItemMutation.mutate({
                                id: item.id,
                                data: { isActive: checked }
                              });
                            }}
                          />
                          <span className="text-xs text-muted-foreground w-12">
                            {item.isActive ? '포함' : '제외'}
                          </span>
                        </div>

                        <Button 
                          variant="ghost" 
                          size="icon"
                          title="임베딩 생성"
                          disabled={generateEmbeddingMutation.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            generateEmbeddingMutation.mutate(item.id);
                          }}
                        >
                          {generateEmbeddingMutation.isPending && selectedItem?.id === item.id ? (
                             <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                             <Play className="h-4 w-4" />
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  검색 테스트
                </CardTitle>
                <CardDescription>
                  하이브리드 검색을 테스트하고 결과를 비교합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Input
                    placeholder="검색어를 입력하세요..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearch();
                    }}
                    className="flex-1"
                  />
                  <Select
                    value={searchMethod}
                    onValueChange={(value: any) => setSearchMethod(value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HYBRID">Hybrid</SelectItem>
                      <SelectItem value="DENSE">Dense (벡터)</SelectItem>
                      <SelectItem value="SPARSE">Sparse (BM25)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleSearch} disabled={searchMutation.isPending}>
                    {searchMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {searchTiming && (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      총 {searchTiming.totalTimeMs}ms
                    </span>
                    {searchTiming.denseTimeMs && (
                      <span>Dense: {searchTiming.denseTimeMs}ms</span>
                    )}
                    {searchTiming.sparseTimeMs && (
                      <span>Sparse: {searchTiming.sparseTimeMs}ms</span>
                    )}
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      {searchResults.length}개 결과
                    </span>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {searchResults.map((result, idx) => (
                      <Card 
                        key={result.id} 
                        className="py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedItem(result)}
                      >
                        <CardContent className="py-2">
                          <div className="flex items-start gap-3">
                            <span className="text-sm font-bold text-muted-foreground">
                              #{idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {getTypeBadge(result.type)}
                                <div className="flex gap-2 text-xs">
                                  {result.denseScore !== undefined && (
                                    <Badge variant="outline">
                                      Dense: {result.denseScore.toFixed(4)}
                                    </Badge>
                                  )}
                                  {result.sparseScore !== undefined && (
                                    <Badge variant="outline">
                                      BM25: {result.sparseScore.toFixed(4)}
                                    </Badge>
                                  )}
                                  {result.hybridScore !== undefined && (
                                    <Badge className="bg-gradient-to-r from-blue-500 to-purple-500">
                                      Hybrid: {result.hybridScore.toFixed(6)}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {result.content}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(result);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Detail Dialog */}
        <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedItem && getTypeBadge(selectedItem.type)}
                <span className="truncate">항목 상세 정보</span>
              </DialogTitle>
              <DialogDescription>
                ID: {selectedItem?.id}
                {selectedItem?.sourceId && ` / Source ID: ${selectedItem.sourceId}`}
              </DialogDescription>
            </DialogHeader>

            {selectedItem && (
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 border rounded-lg bg-background">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">상태:</span>
                    <Switch
                        checked={selectedItem.isActive}
                        onCheckedChange={(checked) => {
                          updateItemMutation.mutate({
                            id: selectedItem.id,
                            data: { isActive: checked }
                          });
                          setSelectedItem((prev: any) => ({ ...prev, isActive: checked }));
                        }}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {selectedItem.isActive ? '포함' : '제외'}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-border" />
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-2"
                    disabled={generateEmbeddingMutation.isPending}
                    onClick={() => {
                        generateEmbeddingMutation.mutate(selectedItem.id);
                    }}
                  >
                    {generateEmbeddingMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Play className="h-4 w-4" />
                    )}
                    임베딩 생성
                  </Button>
                </div>
                {/* 점수 정보 (검색 결과인 경우) */}
                {(selectedItem.denseScore !== undefined || selectedItem.sparseScore !== undefined) && (
                  <div className="flex gap-4 p-4 bg-muted rounded-lg">
                    {selectedItem.hybridScore !== undefined && (
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Hybrid Score</span>
                        <span className="font-bold text-lg text-primary">
                          {selectedItem.hybridScore.toFixed(6)}
                        </span>
                      </div>
                    )}
                    {selectedItem.denseScore !== undefined && (
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Dense Score</span>
                        <span className="font-mono">{selectedItem.denseScore.toFixed(4)}</span>
                      </div>
                    )}
                    {selectedItem.sparseScore !== undefined && (
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Sparse Score</span>
                        <span className="font-mono">{selectedItem.sparseScore.toFixed(4)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">전체 콘텐츠</label>
                  <div className="p-4 bg-muted rounded-md whitespace-pre-wrap text-sm max-h-[300px] overflow-y-auto font-mono">
                    {selectedItem.content}
                  </div>
                </div>

                {selectedItem.metadata && Object.keys(selectedItem.metadata).length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">메타데이터</label>
                    <div className="p-4 bg-slate-950 text-slate-50 rounded-md whitespace-pre overflow-x-auto text-xs font-mono">
                      {JSON.stringify(selectedItem.metadata, null, 2)}
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2">
                    {selectedItem.tokenCount !== undefined && <span>Token Count: {selectedItem.tokenCount}</span>}
                    {selectedItem.lastEmbeddedAt && <span>Last Embedded: {selectedItem.lastEmbeddedAt}</span>}
                    {selectedItem.dataSourceId && <span>DataSource: {selectedItem.dataSourceId}</span>}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setSelectedItem(null)}>닫기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
