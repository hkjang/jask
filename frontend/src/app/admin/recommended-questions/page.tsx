'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { 
  Sparkles, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  Bot, 
  Tag, 
  MessageSquare,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Database,
  TrendingUp,
  Clock,
  User,
  Monitor,
  Settings,
  Search,
  Filter,
  Trash,
  CheckSquare,
  Square,
  XCircle
} from 'lucide-react';
import { useState, useMemo } from 'react';

interface RecommendedQuestion {
  id: string;
  question: string;
  category?: string;
  tags: string[];
  description?: string;
  isActive: boolean;
  isAIGenerated: boolean;
  useCount: number;
  lastUsedAt?: string;
  displayOrder: number;
  dataSourceId: string;
  dataSource: { id: string; name: string; type: string };
  createdById?: string;
  createdByName?: string;
  source: string;
  createdAt: string;
}

interface DataSource {
  id: string;
  name: string;
  type: string;
}

export default function AdminRecommendedQuestionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedDataSource, setSelectedDataSource] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<RecommendedQuestion | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  
  const [formData, setFormData] = useState({
    question: '',
    dataSourceId: '',
    category: '',
    description: '',
    tags: '',
  });

  // Fetch DataSources
  const { data: dataSources = [] } = useQuery({
    queryKey: ['datasources'],
    queryFn: async () => {
      const res: any = await api.getDataSources();
      return res as DataSource[];
    },
  });

  // Fetch Recommended Questions
  const { data: questions = [], isLoading, refetch } = useQuery({
    queryKey: ['adminRecommendedQuestions', selectedDataSource],
    queryFn: async () => {
      const dataSourceId = selectedDataSource === 'all' ? undefined : selectedDataSource;
      return api.getAdminRecommendedQuestions(dataSourceId);
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => api.createAdminRecommendedQuestion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminRecommendedQuestions'] });
      toast({ title: '추천 질문이 생성되었습니다' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => toast({ title: '생성 실패', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateAdminRecommendedQuestion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminRecommendedQuestions'] });
      toast({ title: '추천 질문이 수정되었습니다' });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: () => toast({ title: '수정 실패', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAdminRecommendedQuestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminRecommendedQuestions'] });
      toast({ title: '추천 질문이 삭제되었습니다' });
    },
    onError: () => toast({ title: '삭제 실패', variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.toggleAdminRecommendedQuestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminRecommendedQuestions'] });
      toast({ title: '상태가 변경되었습니다' });
    },
    onError: () => toast({ title: '상태 변경 실패', variant: 'destructive' }),
  });

  const generateMutation = useMutation({
    mutationFn: (dataSourceId: string) => api.generateAIRecommendedQuestions(dataSourceId, 5),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminRecommendedQuestions'] });
      toast({ title: `${data.generated}개의 추천 질문이 생성되었습니다` });
      setIsGenerating(false);
    },
    onError: () => {
      toast({ title: 'AI 질문 생성 실패', variant: 'destructive' });
      setIsGenerating(false);
    },
  });

  const resetForm = () => {
    setFormData({ question: '', dataSourceId: '', category: '', description: '', tags: '' });
    setEditingQuestion(null);
  };

  const openEdit = (q: RecommendedQuestion) => {
    setEditingQuestion(q);
    setFormData({
      question: q.question,
      dataSourceId: q.dataSourceId,
      category: q.category || '',
      description: q.description || '',
      tags: q.tags.join(', '),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.dataSourceId) {
      toast({ title: '데이터소스를 선택해주세요', variant: 'destructive' });
      return;
    }
    if (!formData.question.trim()) {
      toast({ title: '질문을 입력해주세요', variant: 'destructive' });
      return;
    }

    const tags = formData.tags.split(',').map(t => t.trim()).filter(t => t);
    const payload = {
      question: formData.question,
      dataSourceId: formData.dataSourceId,
      category: formData.category || undefined,
      description: formData.description || undefined,
      tags,
    };

    if (editingQuestion) {
      updateMutation.mutate({ id: editingQuestion.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleGenerateAI = () => {
    if (selectedDataSource === 'all') {
      toast({ title: 'AI 생성을 위해 데이터소스를 선택해주세요', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    generateMutation.mutate(selectedDataSource);
  };

  // Filtering logic
  const filteredQuestions = useMemo(() => {
    return questions.filter((q: RecommendedQuestion) => {
      // Source filter
      if (selectedSource !== 'all' && q.source !== selectedSource) return false;
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          q.question.toLowerCase().includes(query) ||
          q.category?.toLowerCase().includes(query) ||
          q.createdByName?.toLowerCase().includes(query) ||
          q.tags.some(t => t.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [questions, selectedSource, searchQuery]);

  const activeQuestions = filteredQuestions.filter((q: RecommendedQuestion) => q.isActive);
  const inactiveQuestions = filteredQuestions.filter((q: RecommendedQuestion) => !q.isActive);
  const queryPageQuestions = questions.filter((q: RecommendedQuestion) => q.source === 'QUERY_PAGE');
  const adminQuestions = questions.filter((q: RecommendedQuestion) => q.source === 'ADMIN');

  // Bulk actions
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuestions.map((q: RecommendedQuestion) => q.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await deleteMutation.mutateAsync(id);
    }
    setSelectedIds(new Set());
    setShowBulkActions(false);
  };

  const handleBulkToggle = async (active: boolean) => {
    for (const id of selectedIds) {
      await api.updateAdminRecommendedQuestion(id, { isActive: active });
    }
    queryClient.invalidateQueries({ queryKey: ['adminRecommendedQuestions'] });
    setSelectedIds(new Set());
    setShowBulkActions(false);
    toast({ title: `${selectedIds.size}개 질문 상태가 변경되었습니다` });
  };

  return (
    <MainLayout>
      <TooltipProvider>
        <div className="container max-w-7xl py-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500">
                  <Sparkles className="h-7 w-7 text-white" />
                </div>
                추천 질문 관리
              </h1>
              <p className="text-muted-foreground mt-1">
                사용자에게 표시할 추천 질문을 관리합니다. AI로 자동 생성하거나 수동으로 추가할 수 있습니다.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              <Select value={selectedDataSource} onValueChange={setSelectedDataSource}>
                <SelectTrigger className="w-[200px]">
                  <Database className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="데이터소스 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 데이터소스</SelectItem>
                  {dataSources.map((ds: DataSource) => (
                    <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                onClick={handleGenerateAI}
                disabled={isGenerating || selectedDataSource === 'all'}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Bot className="h-4 w-4 mr-2" />
                )}
                AI 생성
              </Button>

              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>

              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    질문 추가
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>{editingQuestion ? '추천 질문 수정' : '새 추천 질문'}</DialogTitle>
                    <DialogDescription>
                      사용자에게 표시할 추천 질문을 입력하세요.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">데이터소스 *</label>
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
                          placeholder="예: 매출, 고객, 재고"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">질문 *</label>
                      <Textarea
                        value={formData.question}
                        onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                        placeholder="예: 이번 달 매출 상위 10개 제품은?"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">설명</label>
                      <Input
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="이 질문에 대한 부가 설명"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">태그 (쉼표로 구분)</label>
                      <Input
                        value={formData.tags}
                        onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                        placeholder="예: 매출, 월간, 분석"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
                    <Button 
                      onClick={handleSubmit} 
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      저장
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <ToggleRight className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{activeQuestions.length}</p>
                    <p className="text-xs text-muted-foreground">활성 질문</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <ToggleLeft className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{inactiveQuestions.length}</p>
                    <p className="text-xs text-muted-foreground">비활성 질문</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setSelectedSource('QUERY_PAGE')}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                    <Monitor className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{queryPageQuestions.length}</p>
                    <p className="text-xs text-muted-foreground">질문 페이지</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setSelectedSource('ADMIN')}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <Settings className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{adminQuestions.length}</p>
                    <p className="text-xs text-muted-foreground">관리자 생성</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <Bot className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {questions.filter((q: RecommendedQuestion) => q.isAIGenerated).length}
                    </p>
                    <p className="text-xs text-muted-foreground">AI 생성</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {questions.reduce((sum: number, q: RecommendedQuestion) => sum + q.useCount, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">총 사용 횟수</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="질문, 카테고리, 태그, 생성자로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchQuery('')}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <Select value={selectedSource} onValueChange={setSelectedSource}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="소스 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 소스</SelectItem>
                <SelectItem value="QUERY_PAGE">질문 페이지</SelectItem>
                <SelectItem value="ADMIN">관리자</SelectItem>
                <SelectItem value="SYSTEM">시스템</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showBulkActions ? "secondary" : "outline"}
              onClick={() => {
                setShowBulkActions(!showBulkActions);
                if (showBulkActions) setSelectedIds(new Set());
              }}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              일괄 선택
            </Button>
          </div>

          {/* Bulk Actions Bar */}
          {showBulkActions && selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-4 mb-6 rounded-lg bg-muted/50 border">
              <span className="font-medium text-sm">
                {selectedIds.size}개 선택됨
              </span>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkToggle(true)}
              >
                <ToggleRight className="h-4 w-4 mr-2" />
                활성화
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkToggle(false)}
              >
                <ToggleLeft className="h-4 w-4 mr-2" />
                비활성화
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash className="h-4 w-4 mr-2" />
                    삭제
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>일괄 삭제</AlertDialogTitle>
                    <AlertDialogDescription>
                      선택한 {selectedIds.size}개의 추천 질문을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleBulkDelete}
                    >
                      삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                선택 해제
              </Button>
            </div>
          )}

          {/* Select All Header */}
          {showBulkActions && filteredQuestions.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
                className="text-xs"
              >
                {selectedIds.size === filteredQuestions.length ? (
                  <><CheckSquare className="h-4 w-4 mr-2" /> 전체 해제</>
                ) : (
                  <><Square className="h-4 w-4 mr-2" /> 전체 선택 ({filteredQuestions.length}개)</>
                )}
              </Button>
            </div>
          )}

          {/* Question List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredQuestions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">등록된 추천 질문이 없습니다</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  AI로 자동 생성하거나 수동으로 추가해보세요.
                </p>
                <div className="flex gap-2">
                  {selectedDataSource !== 'all' && (
                    <Button variant="outline" onClick={handleGenerateAI} disabled={isGenerating}>
                      <Bot className="h-4 w-4 mr-2" />
                      AI로 생성하기
                    </Button>
                  )}
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    직접 추가하기
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredQuestions.map((question: RecommendedQuestion) => (
                <Card key={question.id} className={`transition-all ${!question.isActive ? 'opacity-60 bg-muted/30' : ''} ${selectedIds.has(question.id) ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="flex items-start gap-4 p-5">
                    {showBulkActions && (
                      <button
                        className="mt-1 flex-shrink-0"
                        onClick={() => toggleSelect(question.id)}
                      >
                        {selectedIds.has(question.id) ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="font-medium text-lg">{question.question}</h3>
                        {question.isAIGenerated && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <Bot className="h-3 w-3" />
                                AI
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>AI가 자동 생성한 질문</TooltipContent>
                          </Tooltip>
                        )}
                        {question.category && (
                          <Badge variant="outline" className="text-xs">{question.category}</Badge>
                        )}
                        <Badge 
                          variant={question.isActive ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {question.isActive ? '활성' : '비활성'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Database className="h-3.5 w-3.5" />
                          {question.dataSource?.name || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {question.useCount}회 사용
                        </span>
                        {question.createdByName && (
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {question.createdByName}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          {question.source === 'QUERY_PAGE' ? (
                            <><Monitor className="h-3.5 w-3.5" /> 질문 페이지</>
                          ) : question.source === 'ADMIN' ? (
                            <><Settings className="h-3.5 w-3.5" /> 관리자</>
                          ) : (
                            <><Bot className="h-3.5 w-3.5" /> 시스템</>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(question.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>

                      {question.description && (
                        <p className="text-sm text-muted-foreground mt-2">{question.description}</p>
                      )}

                      {question.tags && question.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-2">
                          {question.tags.map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              <Tag className="h-2.5 w-2.5 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={question.isActive}
                              onCheckedChange={() => toggleMutation.mutate(question.id)}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {question.isActive ? '비활성화' : '활성화'}
                        </TooltipContent>
                      </Tooltip>

                      <Button variant="ghost" size="icon" onClick={() => openEdit(question)}>
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
                            <AlertDialogTitle>추천 질문 삭제</AlertDialogTitle>
                            <AlertDialogDescription>
                              이 추천 질문을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteMutation.mutate(question.id)}
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
        </div>
      </TooltipProvider>
    </MainLayout>
  );
}
