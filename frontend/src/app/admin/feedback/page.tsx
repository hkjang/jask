'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Search,
  Download,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Eye,
  TrendingUp,
  TrendingDown,
  FileText,
  Database,
  Users,
  Clock,
  Edit,
  Save,
  X,
  BarChart3,
  Percent,
  MessageCircle,
  Play,
  Sparkles,
  RotateCcw,
  Table2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const CHART_COLORS = {
  positive: '#22c55e',
  negative: '#ef4444',
};

export default function FeedbackManagementPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'POSITIVE' | 'NEGATIVE'>('all');
  const [dataSourceId, setDataSourceId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [hasNoteFilter, setHasNoteFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Query execution & simulation state
  const [detailTab, setDetailTab] = useState<'sql' | 'execute' | 'simulate'>('sql');
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: string | undefined;
    
    switch (dateRange) {
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '90d':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        break;
      default:
        start = undefined;
    }
    
    return { startDate: start, endDate: dateRange !== 'all' ? now.toISOString() : undefined };
  }, [dateRange]);

  // Fetch feedback list
  const { data: feedbackData, isLoading, refetch } = useQuery({
    queryKey: ['adminFeedback', page, search, feedbackFilter, dataSourceId, startDate, endDate, hasNoteFilter],
    queryFn: () => api.getAdminFeedbackList({
      page,
      limit: 20,
      feedback: feedbackFilter !== 'all' ? feedbackFilter : undefined,
      dataSourceId: dataSourceId !== 'all' ? dataSourceId : undefined,
      startDate,
      endDate,
      search: search || undefined,
      hasNote: hasNoteFilter === 'yes' ? true : hasNoteFilter === 'no' ? false : undefined,
    }),
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['adminFeedbackStats', startDate, endDate, dataSourceId],
    queryFn: () => api.getAdminFeedbackStats({
      startDate,
      endDate,
      dataSourceId: dataSourceId !== 'all' ? dataSourceId : undefined,
    }),
  });

  // Fetch data sources for filter
  const { data: dataSources = [] } = useQuery({
    queryKey: ['dataSources'],
    queryFn: () => api.getDataSources(),
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { feedbackNote?: string } }) =>
      api.updateAdminFeedback(id, data),
    onSuccess: () => {
      toast({ title: '피드백 메모가 업데이트되었습니다' });
      queryClient.invalidateQueries({ queryKey: ['adminFeedback'] });
      setEditingNote(false);
    },
    onError: () => {
      toast({ title: '업데이트 실패', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAdminFeedback(id),
    onSuccess: () => {
      toast({ title: '피드백이 삭제되었습니다' });
      queryClient.invalidateQueries({ queryKey: ['adminFeedback'] });
      queryClient.invalidateQueries({ queryKey: ['adminFeedbackStats'] });
      setDetailOpen(false);
      setSelectedFeedback(null);
    },
    onError: () => {
      toast({ title: '삭제 실패', variant: 'destructive' });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.deleteAdminFeedbackBulk(ids),
    onSuccess: () => {
      toast({ title: `${selectedItems.size}개 피드백이 삭제되었습니다` });
      queryClient.invalidateQueries({ queryKey: ['adminFeedback'] });
      queryClient.invalidateQueries({ queryKey: ['adminFeedbackStats'] });
      setSelectedItems(new Set());
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast({ title: '삭제 실패', variant: 'destructive' });
    },
  });

  // Export CSV
  const handleExport = async () => {
    try {
      const result = await api.exportAdminFeedback({
        feedback: feedbackFilter !== 'all' ? feedbackFilter : undefined,
        dataSourceId: dataSourceId !== 'all' ? dataSourceId : undefined,
        startDate,
        endDate,
      });
      
      // Download CSV
      const blob = new Blob([result.content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({ title: `${result.count}개 피드백을 내보냈습니다` });
    } catch (e) {
      toast({ title: '내보내기 실패', variant: 'destructive' });
    }
  };

  // Toggle select item
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };

  // Select all on page
  const toggleSelectAll = () => {
    if (feedbackData?.items) {
      const allIds = feedbackData.items.map((f: any) => f.id);
      const allSelected = allIds.every((id: string) => selectedItems.has(id));
      if (allSelected) {
        setSelectedItems(new Set());
      } else {
        setSelectedItems(new Set(allIds));
      }
    }
  };

  // Open detail
  const openDetail = (feedback: any) => {
    setSelectedFeedback(feedback);
    setNoteValue(feedback.feedbackNote || '');
    setEditingNote(false);
    setDetailOpen(true);
    // Reset execution/simulation state
    setDetailTab('sql');
    setExecutionResult(null);
    setSimulationResult(null);
    setExecutionError(null);
    setSimulationError(null);
  };

  // Execute the SQL query
  const handleExecuteQuery = async () => {
    if (!selectedFeedback?.id) return;
    
    setIsExecuting(true);
    setExecutionError(null);
    setExecutionResult(null);
    
    try {
      const result: any = await api.previewQuery(selectedFeedback.id, selectedFeedback.generatedSql);
      setExecutionResult(result);
      setDetailTab('execute');
    } catch (err: any) {
      setExecutionError(err.message || '쿼리 실행에 실패했습니다');
    } finally {
      setIsExecuting(false);
    }
  };

  // Simulate (re-generate) the query with AI
  const handleSimulateQuery = async () => {
    if (!selectedFeedback?.dataSource?.id || !selectedFeedback?.naturalQuery) return;
    
    setIsSimulating(true);
    setSimulationError(null);
    setSimulationResult(null);
    
    try {
      const result: any = await api.simulateQuery(selectedFeedback.dataSource.id, selectedFeedback.naturalQuery);
      setSimulationResult(result);
      setDetailTab('simulate');
    } catch (err: any) {
      setSimulationError(err.message || '시뮬레이션에 실패했습니다');
    } finally {
      setIsSimulating(false);
    }
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Chart data
  const feedbackPieData = [
    { name: '긍정적', value: statsData?.summary?.positive || 0, color: CHART_COLORS.positive },
    { name: '부정적', value: statsData?.summary?.negative || 0, color: CHART_COLORS.negative },
  ];

  const dataSourceBarData = statsData?.byDataSource?.map((ds: any) => ({
    name: ds.name.length > 12 ? ds.name.slice(0, 12) + '...' : ds.name,
    긍정: ds.positive,
    부정: ds.negative,
  })) || [];

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">피드백 관리</h1>
              <p className="text-muted-foreground">사용자 피드백 분석 및 관리</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedItems.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {selectedItems.size}개 삭제
              </Button>
            )}
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              새로고침
            </Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              CSV 내보내기
            </Button>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-500/20 text-blue-500">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">전체 피드백</p>
                  <p className="text-2xl font-bold">{statsData?.summary?.total || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-500/20 text-green-500">
                  <ThumbsUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">긍정적</p>
                  <p className="text-2xl font-bold">{statsData?.summary?.positive || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-red-500/20 text-red-500">
                  <ThumbsDown className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">부정적</p>
                  <p className="text-2xl font-bold">{statsData?.summary?.negative || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-500/20 text-emerald-500">
                  <Percent className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">긍정률</p>
                  <p className="text-2xl font-bold">{statsData?.summary?.positiveRate || 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-500/20 text-purple-500">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">메모 있음</p>
                  <p className="text-2xl font-bold">{statsData?.summary?.withNote || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">피드백 비율</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={feedbackPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {feedbackPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">데이터소스별 피드백</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataSourceBarData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="긍정" fill={CHART_COLORS.positive} stackId="a" />
                    <Bar dataKey="부정" fill={CHART_COLORS.negative} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="질문, SQL, 메모 검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select value={feedbackFilter} onValueChange={(v: any) => setFeedbackFilter(v)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="피드백 유형" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="POSITIVE">
                    <span className="flex items-center gap-2">
                      <ThumbsUp className="h-3 w-3 text-green-500" /> 긍정적
                    </span>
                  </SelectItem>
                  <SelectItem value="NEGATIVE">
                    <span className="flex items-center gap-2">
                      <ThumbsDown className="h-3 w-3 text-red-500" /> 부정적
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={dataSourceId} onValueChange={setDataSourceId}>
                <SelectTrigger className="w-[180px]">
                  <Database className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="데이터소스" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 데이터소스</SelectItem>
                  {dataSources.map((ds: any) => (
                    <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                <SelectTrigger className="w-[130px]">
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">최근 7일</SelectItem>
                  <SelectItem value="30d">최근 30일</SelectItem>
                  <SelectItem value="90d">최근 90일</SelectItem>
                  <SelectItem value="all">전체</SelectItem>
                </SelectContent>
              </Select>

              <Select value={hasNoteFilter} onValueChange={(v: any) => setHasNoteFilter(v)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="메모 여부" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="yes">메모 있음</SelectItem>
                  <SelectItem value="no">메모 없음</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Feedback Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={feedbackData?.items?.length > 0 && 
                            feedbackData.items.every((f: any) => selectedItems.has(f.id))}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-[80px]">유형</TableHead>
                      <TableHead>질문</TableHead>
                      <TableHead className="w-[150px]">데이터소스</TableHead>
                      <TableHead className="w-[120px]">사용자</TableHead>
                      <TableHead className="w-[60px]">메모</TableHead>
                      <TableHead className="w-[150px]">날짜</TableHead>
                      <TableHead className="w-[80px]">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedbackData?.items?.map((feedback: any) => (
                      <TableRow 
                        key={feedback.id}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedItems.has(feedback.id)}
                            onCheckedChange={() => toggleSelect(feedback.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {feedback.feedback === 'POSITIVE' ? (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
                              <ThumbsUp className="h-3 w-3 mr-1" /> 좋음
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-500 border-red-500/30">
                              <ThumbsDown className="h-3 w-3 mr-1" /> 나쁨
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell 
                          className="max-w-[300px] truncate"
                          onClick={() => openDetail(feedback)}
                        >
                          {feedback.naturalQuery}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {feedback.dataSource?.name || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {feedback.user?.name || feedback.user?.email || '-'}
                        </TableCell>
                        <TableCell>
                          {feedback.feedbackNote ? (
                            <Badge variant="secondary" className="text-xs">
                              <FileText className="h-3 w-3" />
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(feedback.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDetail(feedback)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {(!feedbackData?.items || feedbackData.items.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                          피드백이 없습니다
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {feedbackData?.pagination && feedbackData.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      총 {feedbackData.pagination.total}개 중{' '}
                      {(page - 1) * 20 + 1}-{Math.min(page * 20, feedbackData.pagination.total)}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        {page} / {feedbackData.pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(feedbackData.pagination.totalPages, p + 1))}
                        disabled={page >= feedbackData.pagination.totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedFeedback(null);
            setEditingNote(false);
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedFeedback?.feedback === 'POSITIVE' ? (
                  <ThumbsUp className="h-5 w-5 text-green-500" />
                ) : (
                  <ThumbsDown className="h-5 w-5 text-red-500" />
                )}
                피드백 상세
              </DialogTitle>
              <DialogDescription>
                {selectedFeedback?.user?.name || selectedFeedback?.user?.email} • {selectedFeedback && formatDate(selectedFeedback.createdAt)}
              </DialogDescription>
            </DialogHeader>

            {selectedFeedback && (
              <div className="flex-1 overflow-hidden flex flex-col space-y-4">
                {/* Meta Info & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      <Database className="h-3 w-3 mr-1" />
                      {selectedFeedback.dataSource?.name || 'Unknown'}
                    </Badge>
                    <Badge variant="outline">
                      {selectedFeedback.feedback === 'POSITIVE' ? '긍정적 피드백' : '부정적 피드백'}
                    </Badge>
                    {selectedFeedback.trustScore !== null && (
                      <Badge variant="outline">
                        신뢰도: {(selectedFeedback.trustScore * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExecuteQuery}
                      disabled={isExecuting || !selectedFeedback.generatedSql}
                    >
                      {isExecuting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Play className="h-4 w-4 mr-1" />
                      )}
                      쿼리 실행
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSimulateQuery}
                      disabled={isSimulating || !selectedFeedback.dataSource?.id}
                    >
                      {isSimulating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-1" />
                      )}
                      AI 시뮬레이션
                    </Button>
                  </div>
                </div>

                {/* Question */}
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-muted-foreground">질문</h4>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm">{selectedFeedback.naturalQuery}</p>
                  </div>
                </div>

                {/* Tabs for SQL, Execute Results, Simulation */}
                <Tabs value={detailTab} onValueChange={(v: any) => setDetailTab(v)} className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="sql" className="gap-2">
                      <FileText className="h-4 w-4" />
                      SQL
                    </TabsTrigger>
                    <TabsTrigger value="execute" className="gap-2">
                      <Table2 className="h-4 w-4" />
                      실행 결과
                      {executionResult && <Badge variant="secondary" className="ml-1 text-xs">{executionResult.rowCount || executionResult.rows?.length || 0}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="simulate" className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      시뮬레이션
                    </TabsTrigger>
                  </TabsList>

                  {/* SQL Tab */}
                  <TabsContent value="sql" className="flex-1 overflow-auto space-y-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">생성된 SQL</h4>
                      <div className="p-3 bg-zinc-900 rounded-lg overflow-x-auto">
                        <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                          {selectedFeedback.generatedSql}
                        </pre>
                      </div>
                    </div>

                    {/* Feedback Note */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-muted-foreground">사용자 피드백 메모</h4>
                        {!editingNote && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingNote(true)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            편집
                          </Button>
                        )}
                      </div>
                      {editingNote ? (
                        <div className="space-y-2">
                          <Textarea
                            value={noteValue}
                            onChange={(e) => setNoteValue(e.target.value)}
                            placeholder="피드백에 대한 메모를 입력하세요..."
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                updateMutation.mutate({
                                  id: selectedFeedback.id,
                                  data: { feedbackNote: noteValue || undefined },
                                });
                              }}
                              disabled={updateMutation.isPending}
                            >
                              {updateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <Save className="h-4 w-4 mr-1" />
                              )}
                              저장
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setNoteValue(selectedFeedback.feedbackNote || '');
                                setEditingNote(false);
                              }}
                            >
                              취소
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-muted/50 rounded-lg min-h-[60px]">
                          <p className="text-sm">
                            {selectedFeedback.feedbackNote || (
                              <span className="text-muted-foreground italic">메모 없음</span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Execute Results Tab */}
                  <TabsContent value="execute" className="flex-1 overflow-auto">
                    {isExecuting ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">쿼리 실행 중...</span>
                      </div>
                    ) : executionError ? (
                      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-center gap-2 text-red-500">
                          <AlertCircle className="h-5 w-5" />
                          <h4 className="font-medium">실행 오류</h4>
                        </div>
                        <p className="mt-2 text-sm text-red-400">{executionError}</p>
                      </div>
                    ) : executionResult ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <span className="font-medium">실행 완료</span>
                            <Badge variant="secondary">
                              {executionResult.rowCount || executionResult.rows?.length || 0}개 결과
                            </Badge>
                          </div>
                          {executionResult.executionTime && (
                            <span className="text-sm text-muted-foreground">
                              {executionResult.executionTime}ms
                            </span>
                          )}
                        </div>
                        
                        {executionResult.rows && executionResult.rows.length > 0 ? (
                          <ScrollArea className="h-[300px] border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  {Object.keys(executionResult.rows[0]).map((col) => (
                                    <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {executionResult.rows.slice(0, 100).map((row: any, i: number) => (
                                  <TableRow key={i}>
                                    {Object.values(row).map((val: any, j: number) => (
                                      <TableCell key={j} className="max-w-[200px] truncate">
                                        {val === null ? <span className="text-muted-foreground italic">NULL</span> : String(val)}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        ) : (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            결과가 없습니다
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <Play className="h-12 w-12 mb-4 opacity-20" />
                        <p>"쿼리 실행" 버튼을 눌러 SQL을 실행하세요</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Simulation Tab */}
                  <TabsContent value="simulate" className="flex-1 overflow-auto">
                    {isSimulating ? (
                      <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">AI 시뮬레이션 중...</span>
                      </div>
                    ) : simulationError ? (
                      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-center gap-2 text-red-500">
                          <AlertCircle className="h-5 w-5" />
                          <h4 className="font-medium">시뮬레이션 오류</h4>
                        </div>
                        <p className="mt-2 text-sm text-red-400">{simulationError}</p>
                      </div>
                    ) : simulationResult ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-purple-500" />
                          <span className="font-medium">AI 재생성 결과</span>
                          {simulationResult.trustScore && (
                            <Badge variant="secondary">
                              신뢰도: {(simulationResult.trustScore * 100).toFixed(0)}%
                            </Badge>
                          )}
                        </div>

                        {/* Comparison View */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-muted-foreground">기존 SQL</h5>
                            <div className="p-3 bg-zinc-900 rounded-lg overflow-x-auto h-[200px]">
                              <pre className="text-xs text-orange-400 font-mono whitespace-pre-wrap">
                                {selectedFeedback.generatedSql}
                              </pre>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              새로 생성된 SQL
                              {simulationResult.sql === selectedFeedback.generatedSql && (
                                <Badge className="bg-green-500/10 text-green-500 text-xs">동일</Badge>
                              )}
                            </h5>
                            <div className="p-3 bg-zinc-900 rounded-lg overflow-x-auto h-[200px]">
                              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                                {simulationResult.sql}
                              </pre>
                            </div>
                          </div>
                        </div>

                        {/* Simulation Details */}
                        {simulationResult.schemaContext && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-muted-foreground">사용된 테이블</h5>
                            <div className="flex flex-wrap gap-2">
                              {simulationResult.usedTables?.map((table: string) => (
                                <Badge key={table} variant="outline" className="text-xs">
                                  {table}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {simulationResult.explanation && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium text-muted-foreground">AI 설명</h5>
                            <div className="p-3 bg-muted/50 rounded-lg">
                              <p className="text-sm">{simulationResult.explanation}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <Sparkles className="h-12 w-12 mb-4 opacity-20" />
                        <p>"AI 시뮬레이션" 버튼을 눌러 같은 질문으로 SQL을 다시 생성하세요</p>
                        <p className="text-xs mt-2">기존 SQL과 비교하여 품질을 검증할 수 있습니다</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}

            <DialogFooter className="sm:justify-between border-t pt-4">
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedFeedback) {
                    deleteMutation.mutate(selectedFeedback.id);
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                삭제
              </Button>
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                닫기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Confirmation */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>피드백 일괄 삭제</DialogTitle>
              <DialogDescription>
                선택한 {selectedItems.size}개의 피드백을 삭제하시겠습니까?
                이 작업은 취소할 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={() => bulkDeleteMutation.mutate(Array.from(selectedItems))}
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                삭제
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
