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
import { Checkbox } from '@/components/ui/checkbox';
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
  CheckSquare,
  Square,
  MoreHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  Tag,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

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

interface DocumentItem {
  id: string;
  name: string;
  title?: string;
  description?: string;
  mimeType: string;
  fileSize: number;
  content: string;
  chunkCount: number;
  chunkSize: number;
  chunkOverlap: number;
  dataSourceId?: string;
  tags: string[];
  category?: string;
  isActive: boolean;
  isProcessed: boolean;
  createdAt: string;
}

export default function EmbeddingManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog states
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isSampleDialogOpen, setIsSampleDialogOpen] = useState(false); // For Sample Query
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<string>('TABLE');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  
  // Pagination and search state
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsPageSize, setItemsPageSize] = useState(50);
  const [itemsSearch, setItemsSearch] = useState('');
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

  // Column alias management state
  const [isColumnDialogOpen, setIsColumnDialogOpen] = useState(false);
  const [selectedColumnItem, setSelectedColumnItem] = useState<any>(null);
  const [columnAliases, setColumnAliases] = useState<string[]>([]);
  const [newAlias, setNewAlias] = useState('');

  // Document management state
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [documentForm, setDocumentForm] = useState({
    title: '',
    description: '',
    dataSourceId: '',
    tags: [] as string[],
    category: '',
  });
  const [newTag, setNewTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch data
  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ['embeddingConfigs'],
    queryFn: () => api.getEmbeddingConfigs(),
  });

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['embeddableItems', selectedType, itemsPage, itemsPageSize, itemsSearch],
    queryFn: () => api.getEmbeddableItems({ 
      limit: itemsPageSize, 
      offset: (itemsPage - 1) * itemsPageSize,
      type: selectedType as 'TABLE' | 'COLUMN' | 'SAMPLE_QUERY' | 'DOCUMENT' | 'CUSTOM',
      search: itemsSearch || undefined,
    }),
  });

  // Reset page when type or search changes
  useEffect(() => {
    setItemsPage(1);
  }, [selectedType, itemsSearch]);

  const { data: dataSources = [] } = useQuery({
    queryKey: ['dataSources'],
    queryFn: () => api.getDataSources(),
  });

  // Documents query (for DOCUMENT tab)
  const { data: documentsData, isLoading: documentsLoading, refetch: refetchDocuments } = useQuery({
    queryKey: ['documents', itemsSearch],
    queryFn: () => api.getDocuments({ search: itemsSearch || undefined, limit: 100 }),
    enabled: selectedType === 'DOCUMENT',
  });

  const items = itemsData?.items || [];
  const totalItems = itemsData?.total || 0;
  const totalPages = Math.ceil(totalItems / itemsPageSize);

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

  // Column alias mutation
  const updateColumnAliasesMutation = useMutation({
    mutationFn: async ({ columnId, aliases }: { columnId: string; aliases: string[] }) => {
      return api.updateColumnAliases(columnId, aliases);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embeddableItems'] });
      toast({ title: '컬럼 동의어가 업데이트되었습니다' });
      setIsColumnDialogOpen(false);
      setSelectedColumnItem(null);
      setColumnAliases([]);
    },
    onError: () => toast({ title: '동의어 업데이트 실패', variant: 'destructive' }),
  });

  const syncDataSourceColumnsMutation = useMutation({
    mutationFn: async (dataSourceId: string) => {
      return api.syncDataSourceColumnsEmbeddings(dataSourceId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['embeddableItems'] });
      toast({
        title: '컬럼 임베딩 동기화 완료',
        description: `동기화: ${data.synced}건, 오류: ${data.errors}건`,
      });
    },
    onError: () => toast({ title: '동기화 실패', variant: 'destructive' }),
  });

  // Document mutations
  const uploadDocumentMutation = useMutation({
    mutationFn: async (params: { file: File; options: any }) => {
      return api.uploadDocument(params.file, params.options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['embeddableItems'] });
      toast({ title: '문서가 업로드되었습니다' });
      setIsDocumentDialogOpen(false);
      resetDocumentForm();
    },
    onError: (error: any) => toast({ title: error.message || '업로드 실패', variant: 'destructive' }),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.deleteDocument(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['embeddableItems'] });
      toast({ title: '문서가 삭제되었습니다' });
      setSelectedDocument(null);
    },
    onError: () => toast({ title: '삭제 실패', variant: 'destructive' }),
  });

  const syncDocumentEmbeddingsMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.syncDocumentEmbeddings(id);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['embeddableItems'] });
      toast({
        title: '문서 임베딩 재생성 완료',
        description: `${data.synced}개 청크 생성`,
      });
    },
    onError: () => toast({ title: '임베딩 재생성 실패', variant: 'destructive' }),
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

  const resetDocumentForm = () => {
    setDocumentForm({
      title: '',
      description: '',
      dataSourceId: '',
      tags: [],
      category: '',
    });
    setNewTag('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Column alias dialog handlers
  const openColumnAliasDialog = (item: any) => {
    setSelectedColumnItem(item);
    setColumnAliases(item.metadata?.aliases || []);
    setNewAlias('');
    setIsColumnDialogOpen(true);
  };

  const handleAddAlias = () => {
    if (newAlias.trim() && !columnAliases.includes(newAlias.trim())) {
      setColumnAliases([...columnAliases, newAlias.trim()]);
      setNewAlias('');
    }
  };

  const handleRemoveAlias = (index: number) => {
    setColumnAliases(columnAliases.filter((_, i) => i !== index));
  };

  const handleSaveColumnAliases = () => {
    if (!selectedColumnItem?.sourceId) return;
    updateColumnAliasesMutation.mutate({
      columnId: selectedColumnItem.sourceId,
      aliases: columnAliases,
    });
  };

  // Document handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedExtensions = ['.txt', '.md', '.csv'];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(ext)) {
      toast({ title: '지원되지 않는 파일 형식입니다', description: '.txt, .md, .csv 파일만 업로드 가능합니다', variant: 'destructive' });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: '파일 크기 초과', description: '최대 5MB까지 업로드 가능합니다', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    uploadDocumentMutation.mutate({
      file,
      options: {
        title: documentForm.title || undefined,
        description: documentForm.description || undefined,
        dataSourceId: documentForm.dataSourceId || undefined,
        tags: documentForm.tags.length > 0 ? documentForm.tags : undefined,
        category: documentForm.category || undefined,
      },
    }, {
      onSettled: () => setIsUploading(false),
    });
  };

  const handleAddTag = () => {
    if (newTag.trim() && !documentForm.tags.includes(newTag.trim())) {
      setDocumentForm({ ...documentForm, tags: [...documentForm.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const handleRemoveTag = (index: number) => {
    setDocumentForm({
      ...documentForm,
      tags: documentForm.tags.filter((_, i) => i !== index),
    });
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

  // Bulk Actions
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItemIds(new Set(items.map(item => item.id)));
    } else {
      setSelectedItemIds(new Set());
    }
  };

  const toggleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedItemIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItemIds(newSelected);
  };

  const handleBulkAction = async (action: 'INCLUDE' | 'EXCLUDE' | 'EMBED') => {
    if (selectedItemIds.size === 0) return;
    
    setIsBulkProcessing(true);
    const ids = Array.from(selectedItemIds);
    let successCount = 0;
    let failCount = 0;

    try {
      if (action === 'EMBED') {
        const promises = ids.map(id => 
          api.generateItemEmbedding(id)
            .then(() => { successCount++; })
            .catch(() => { failCount++; })
        );
        await Promise.all(promises);
      } else {
        const isActive = action === 'INCLUDE';
        const promises = ids.map(id => 
          api.updateEmbeddableItem(id, { isActive })
            .then(() => { successCount++; })
            .catch(() => { failCount++; })
        );
        await Promise.all(promises);
      }

      queryClient.invalidateQueries({ queryKey: ['embeddableItems'] });
      setSelectedItemIds(new Set());
      toast({
        title: '일괄 작업 완료',
        description: `성공: ${successCount}건, 실패: ${failCount}건`,
      });
    } catch (error) {
      toast({ title: '일괄 작업 중 오류 발생', variant: 'destructive' });
    } finally {
      setIsBulkProcessing(false);
    }
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
                  {selectedType === 'COLUMN' && (
                    <Select
                      onValueChange={(dsId) => {
                        if (dsId) syncDataSourceColumnsMutation.mutate(dsId);
                      }}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="컬럼 임베딩 동기화" />
                      </SelectTrigger>
                      <SelectContent>
                        {dataSources.map((ds: any) => (
                          <SelectItem key={ds.id} value={ds.id}>
                            {ds.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedType === 'DOCUMENT' && (
                    <Button onClick={() => setIsDocumentDialogOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      문서 업로드
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

              {/* Search and Page Size Controls */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="검색어 입력..."
                    value={itemsSearch}
                    onChange={(e) => setItemsSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">페이지당:</span>
                  <Select
                    value={String(itemsPageSize)}
                    onValueChange={(val) => {
                      setItemsPageSize(Number(val));
                      setItemsPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* DOCUMENT 탭 전용 UI */}
            {selectedType === 'DOCUMENT' ? (
              documentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (documentsData?.items || []).length === 0 ? (
                <Card className="py-12">
                  <CardContent className="flex flex-col items-center justify-center text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold">업로드된 문서가 없습니다</h3>
                    <p className="text-muted-foreground mb-4">
                      문서를 업로드하여 임베딩을 생성하세요
                    </p>
                    <Button onClick={() => setIsDocumentDialogOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      문서 업로드
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-2">
                  {(documentsData?.items || []).map((doc: DocumentItem) => (
                    <Card
                      key={doc.id}
                      className="py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedDocument(doc)}
                    >
                      <CardContent className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-500/10 text-purple-500">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{doc.title || doc.name}</p>
                              {doc.isProcessed ? (
                                <Badge variant="success" className="text-xs">임베딩됨</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">대기중</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span>{(doc.fileSize / 1024).toFixed(1)} KB</span>
                              <span>{doc.chunkCount}개 청크</span>
                              {doc.tags && doc.tags.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Tag className="h-3 w-3" />
                                  {doc.tags.length}
                                </span>
                              )}
                              <span>{new Date(doc.createdAt).toLocaleDateString('ko-KR')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="임베딩 재생성"
                            onClick={(e) => {
                              e.stopPropagation();
                              syncDocumentEmbeddingsMutation.mutate(doc.id);
                            }}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDocument(doc);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            ) : itemsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <Card className="py-12">
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <Database className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">임베딩 항목이 없습니다</h3>
                  <p className="text-muted-foreground">
                    {selectedType === 'COLUMN'
                      ? '데이터소스를 선택하여 컬럼 임베딩을 동기화하세요'
                      : '메타데이터 동기화 시 자동으로 추가됩니다'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                 {/* Bulk Action Bar */}
                 {selectedItemIds.size > 0 && (
                  <div className="sticky top-0 z-10 bg-background border rounded-lg p-2 mb-4 flex items-center justify-between shadow-sm animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-4 px-2">
                      <span className="font-medium text-sm">
                        {selectedItemIds.size}개 선택됨
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedItemIds(new Set())}>
                        <X className="h-4 w-4 mr-1" /> 선택 취소
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button 
                         variant="outline" 
                         size="sm"
                         disabled={isBulkProcessing}
                         onClick={() => handleBulkAction('INCLUDE')}
                       >
                         <CheckSquare className="h-4 w-4 mr-2" /> 선택 포함
                       </Button>
                       <Button 
                         variant="outline" 
                         size="sm"
                         disabled={isBulkProcessing}
                         onClick={() => handleBulkAction('EXCLUDE')}
                       >
                         <Square className="h-4 w-4 mr-2" /> 선택 제외
                       </Button>
                       <Button 
                         size="sm"
                         disabled={isBulkProcessing}
                         onClick={() => handleBulkAction('EMBED')}
                       >
                         {isBulkProcessing ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                         ) : (
                            <Play className="h-4 w-4 mr-2" />
                         )}
                         선택 임베딩
                       </Button>
                    </div>
                  </div>
                )}
                
               <div className="flex items-center gap-2 mb-2 px-1">
                 <Checkbox 
                    checked={items.length > 0 && selectedItemIds.size === items.length}
                    onCheckedChange={(checked) => toggleSelectAll(checked as boolean)}
                 />
                 <span className="text-sm text-muted-foreground">전체 선택</span>
               </div>

              <div className="grid gap-2">
                {items.map((item: EmbeddableItem) => (
                  <Card 
                    key={item.id} 
                    className={`py-2 cursor-pointer transition-colors ${selectedItemIds.has(item.id) ? 'bg-muted/50 border-primary' : 'hover:bg-muted/50'}`}
                    onClick={() => toggleSelectItem(item.id, !selectedItemIds.has(item.id))}
                  >
                    <CardContent className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3 mr-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={selectedItemIds.has(item.id)}
                          onCheckedChange={(checked) => toggleSelectItem(item.id, checked as boolean)}
                        />
                      </div>
                      <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => setSelectedItem(item)}>

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

                        {item.type === 'COLUMN' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="동의어 관리"
                            onClick={(e) => {
                              e.stopPropagation();
                              openColumnAliasDialog(item);
                            }}
                          >
                            <Tag className="h-4 w-4" />
                          </Button>
                        )}

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
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    {((itemsPage - 1) * itemsPageSize) + 1} - {Math.min(itemsPage * itemsPageSize, totalItems)}개 / 총 {totalItems}개
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setItemsPage(1)}
                      disabled={itemsPage === 1}
                    >
                      처음
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setItemsPage(p => Math.max(1, p - 1))}
                      disabled={itemsPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm px-2">
                      {itemsPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setItemsPage(p => Math.min(totalPages, p + 1))}
                      disabled={itemsPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setItemsPage(totalPages)}
                      disabled={itemsPage === totalPages}
                    >
                      마지막
                    </Button>
                  </div>
                </div>
              )}
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
                {/* 기본 정보 카드 */}
                {selectedItem.metadata && (
                  <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3">기본 정보</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {selectedItem.metadata.tableName && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">테이블명:</span>
                          <span className="font-medium">{selectedItem.metadata.tableName}</span>
                        </div>
                      )}
                      {selectedItem.metadata.schemaName && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">스키마:</span>
                          <span className="font-medium">{selectedItem.metadata.schemaName}</span>
                        </div>
                      )}
                      {selectedItem.metadata.tableType && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">타입:</span>
                          <Badge variant="outline">{selectedItem.metadata.tableType}</Badge>
                        </div>
                      )}
                      {selectedItem.metadata.columnName && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">컬럼명:</span>
                          <span className="font-medium">{selectedItem.metadata.columnName}</span>
                        </div>
                      )}
                      {selectedItem.metadata.dataType && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">데이터 타입:</span>
                          <code className="px-1.5 py-0.5 bg-muted rounded text-xs">{selectedItem.metadata.dataType}</code>
                        </div>
                      )}
                      {/* 샘플 쿼리 메타데이터 */}
                      {selectedItem.metadata.question && (
                        <div className="col-span-2 flex items-start gap-2">
                          <span className="text-muted-foreground whitespace-nowrap">질문:</span>
                          <span className="font-medium">{selectedItem.metadata.question}</span>
                        </div>
                      )}
                      {selectedItem.metadata.description && (
                        <div className="col-span-2 flex items-start gap-2">
                          <span className="text-muted-foreground whitespace-nowrap">설명:</span>
                          <span className="">{selectedItem.metadata.description}</span>
                        </div>
                      )}
                      {selectedItem.metadata.sql && (
                        <div className="col-span-2 space-y-1">
                          <span className="text-muted-foreground">SQL:</span>
                          <pre className="p-2 bg-slate-900 text-slate-100 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                            {selectedItem.metadata.sql}
                          </pre>
                        </div>
                      )}
                      {selectedItem.metadata.tags && selectedItem.metadata.tags.length > 0 && (
                        <div className="col-span-2 flex items-center gap-2 flex-wrap">
                          <span className="text-muted-foreground">태그:</span>
                          {selectedItem.metadata.tags.map((tag: string, idx: number) => (
                            <Badge key={idx} variant="secondary">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

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

                {/* 임베딩 콘텐츠 - 원본 텍스트 그대로 표시 */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">임베딩 콘텐츠</label>
                  <div className="p-4 bg-muted rounded-md whitespace-pre-wrap text-sm max-h-[400px] overflow-y-auto">
                    {selectedItem.content}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2 p-3 bg-muted/20 rounded-lg">
                    {selectedItem.tokenCount !== undefined && <span>토큰 수: {selectedItem.tokenCount}</span>}
                    {selectedItem.lastEmbeddedAt && <span>마지막 임베딩: {new Date(selectedItem.lastEmbeddedAt).toLocaleString('ko-KR')}</span>}
                    {selectedItem.dataSourceId && <span>데이터소스 ID: {selectedItem.dataSourceId}</span>}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setSelectedItem(null)}>닫기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Column Alias Dialog */}
        <Dialog open={isColumnDialogOpen} onOpenChange={setIsColumnDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                컬럼 동의어 관리
              </DialogTitle>
              <DialogDescription>
                NL2SQL 정확도 향상을 위한 컬럼 동의어(별칭)를 관리합니다.
              </DialogDescription>
            </DialogHeader>

            {selectedColumnItem && (
              <div className="space-y-4 py-4">
                {/* Column Info */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedColumnItem.metadata?.tableName && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">테이블:</span>
                        <span className="font-medium">{selectedColumnItem.metadata.tableName}</span>
                      </div>
                    )}
                    {selectedColumnItem.metadata?.columnName && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">컬럼:</span>
                        <span className="font-medium">{selectedColumnItem.metadata.columnName}</span>
                      </div>
                    )}
                    {selectedColumnItem.metadata?.dataType && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">타입:</span>
                        <code className="px-1.5 py-0.5 bg-background rounded text-xs">{selectedColumnItem.metadata.dataType}</code>
                      </div>
                    )}
                    {selectedColumnItem.metadata?.semanticName && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">시맨틱명:</span>
                        <span className="font-medium">{selectedColumnItem.metadata.semanticName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Aliases Management */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">동의어/별칭</label>
                  <div className="flex gap-2">
                    <Input
                      value={newAlias}
                      onChange={(e) => setNewAlias(e.target.value)}
                      placeholder="새 동의어 입력 (예: 고객번호, customer_no)"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAlias();
                        }
                      }}
                    />
                    <Button onClick={handleAddAlias} disabled={!newAlias.trim()}>
                      추가
                    </Button>
                  </div>

                  {columnAliases.length > 0 ? (
                    <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg min-h-[60px]">
                      {columnAliases.map((alias, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="gap-1 py-1.5 px-3 text-sm"
                        >
                          {alias}
                          <X
                            className="h-3 w-3 cursor-pointer hover:text-destructive"
                            onClick={() => handleRemoveAlias(idx)}
                          />
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg text-center">
                      등록된 동의어가 없습니다
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    동의어를 추가하면 사용자가 다양한 표현으로 질문해도 해당 컬럼을 찾을 수 있습니다.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsColumnDialogOpen(false)}>
                취소
              </Button>
              <Button
                onClick={handleSaveColumnAliases}
                disabled={updateColumnAliasesMutation.isPending}
              >
                {updateColumnAliasesMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                저장 및 임베딩 갱신
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Document Upload Dialog */}
        <Dialog open={isDocumentDialogOpen} onOpenChange={(open) => {
          setIsDocumentDialogOpen(open);
          if (!open) resetDocumentForm();
        }}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                문서 업로드
              </DialogTitle>
              <DialogDescription>
                텍스트 기반 문서(.txt, .md, .csv)를 업로드하여 임베딩을 생성합니다.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* File Upload Area */}
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm font-medium">
                  클릭하거나 파일을 선택하여 업로드
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  .txt, .md, .csv 파일 지원 (최대 5MB)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">제목 (선택)</label>
                  <Input
                    value={documentForm.title}
                    onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })}
                    placeholder="문서 제목"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">데이터소스 연결 (선택)</label>
                  <Select
                    value={documentForm.dataSourceId || 'NONE'}
                    onValueChange={(val) => setDocumentForm({ ...documentForm, dataSourceId: val === 'NONE' ? '' : val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="연결할 데이터소스" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">없음 (전역)</SelectItem>
                      {dataSources.map((ds: any) => (
                        <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">설명 (선택)</label>
                <Textarea
                  value={documentForm.description}
                  onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })}
                  placeholder="문서에 대한 설명"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">태그 (선택)</label>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="태그 입력 후 Enter"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <Button variant="outline" onClick={handleAddTag} disabled={!newTag.trim()}>
                    추가
                  </Button>
                </div>
                {documentForm.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {documentForm.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1">
                        {tag}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => handleRemoveTag(idx)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDocumentDialogOpen(false)}>
                취소
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Document Detail Dialog */}
        <Dialog open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                문서 상세
              </DialogTitle>
              <DialogDescription>
                {selectedDocument?.name}
              </DialogDescription>
            </DialogHeader>

            {selectedDocument && (
              <div className="space-y-4 py-4">
                {/* Document Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">파일명:</span>
                    <span className="font-medium text-sm">{selectedDocument.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">크기:</span>
                    <span className="font-medium text-sm">{(selectedDocument.fileSize / 1024).toFixed(1)} KB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">청크 수:</span>
                    <span className="font-medium text-sm">{selectedDocument.chunkCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">상태:</span>
                    {selectedDocument.isProcessed ? (
                      <Badge variant="success">임베딩됨</Badge>
                    ) : (
                      <Badge variant="outline">대기중</Badge>
                    )}
                  </div>
                  {selectedDocument.title && (
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">제목:</span>
                      <span className="font-medium text-sm">{selectedDocument.title}</span>
                    </div>
                  )}
                  {selectedDocument.description && (
                    <div className="col-span-2 flex items-start gap-2">
                      <span className="text-muted-foreground text-sm">설명:</span>
                      <span className="text-sm">{selectedDocument.description}</span>
                    </div>
                  )}
                  {selectedDocument.tags && selectedDocument.tags.length > 0 && (
                    <div className="col-span-2 flex items-center gap-2 flex-wrap">
                      <span className="text-muted-foreground text-sm">태그:</span>
                      {selectedDocument.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Document Content Preview */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">문서 내용 (미리보기)</label>
                  <div className="p-4 bg-muted rounded-md whitespace-pre-wrap text-sm max-h-[300px] overflow-y-auto font-mono">
                    {selectedDocument.content.slice(0, 3000)}
                    {selectedDocument.content.length > 3000 && (
                      <span className="text-muted-foreground">... (총 {selectedDocument.content.length.toLocaleString()}자)</span>
                    )}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  생성일: {new Date(selectedDocument.createdAt).toLocaleString('ko-KR')}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>문서 삭제</AlertDialogTitle>
                    <AlertDialogDescription>
                      정말 이 문서를 삭제하시겠습니까? 관련 임베딩도 함께 삭제됩니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => selectedDocument && deleteDocumentMutation.mutate(selectedDocument.id)}
                    >
                      삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="outline"
                onClick={() => selectedDocument && syncDocumentEmbeddingsMutation.mutate(selectedDocument.id)}
                disabled={syncDocumentEmbeddingsMutation.isPending}
              >
                {syncDocumentEmbeddingsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                임베딩 재생성
              </Button>
              <Button onClick={() => setSelectedDocument(null)}>닫기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
