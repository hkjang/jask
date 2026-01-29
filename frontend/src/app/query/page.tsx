'use client';

import { Suspense, useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ShareDialog } from './_components/share-dialog';
import { ThreadSidebar } from '@/components/chat/ThreadSidebar';
import { CommentSection } from './_components/comment-section';
import { FeedbackDialog } from './_components/feedback-dialog';
import { TableSchemaViewer } from './_components/table-schema-viewer';
import { SimulationDialog } from './_components/simulation-dialog';
import { SampleQueryDialog } from './_components/sample-query-dialog';
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
  Send,
  Database,
  Loader2,
  User,
  Bot,
  Play,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Table,
  ChevronDown,
  RefreshCw,
  Download,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Edit3,
  Check,
  X,
  History,
  Trash2,
  Search,
  ChevronRight,
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  PanelRightOpen,
  PanelRightClose,
  Star,
  MessageSquare, // Add this
  Share2, // Add this
  Eye, // Simulation icon
  BookOpen // Sample Query Icon
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useUserAction, ActionType } from '@/hooks/use-user-action';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  result?: any;
  queryId?: string;
  timestamp: Date;
  isLoading?: boolean;
  isExecuting?: boolean;
  error?: string;
  meta?: {
    tokens?: { prompt: number; completion: number; total: number };
    trustScore?: number;
    riskLevel?: string;
  };
  feedback?: 'POSITIVE' | 'NEGATIVE';
  favorited?: boolean;
  favoriteId?: string;
  selectedTables?: string[];
  selectedSampleQueries?: SampleQuery[];
}

interface SampleQuery {
  id: string;
  question: string;
  score: number;
  sql?: string;
}



const CHART_COLORS = ['hsl(210, 70%, 50%)', 'hsl(240, 70%, 50%)', 'hsl(270, 70%, 50%)', 'hsl(300, 70%, 50%)', 'hsl(330, 70%, 50%)'];

// Helper to extract tables from markdown content for history
const extractTablesFromContent = (content: string): string[] => {
  if (!content) return [];
  // Match "**참조 테이블**: ... " until newline
  const match = content.match(/\*\*참조 테이블\*\*:\s*([^\n\r]*)(\r?\n|$)/);
  if (!match) return [];
  const links = match[1];
  const tableMatches = [...links.matchAll(/\[(.*?)\]\(table:.*?\)/g)];
  return tableMatches.map(m => m[1]);
};

// Helper to extract sample queries from markdown content for history
const extractSampleQueriesFromContent = (content: string): SampleQuery[] => {
  if (!content) return [];
  // Match "**참조 샘플 쿼리**:" block
  const blockMatch = content.match(/\*\*참조 샘플 쿼리\*\*:\s*\r?\n([\s\S]*?)(\r?\n\r?\n|$)/);
  if (!blockMatch) return [];
  
  const lines = blockMatch[1].split(/\r?\n/);
  const queries: SampleQuery[] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    // Format: - [Question](sample:ID) (유사도: 85%)
    // Relaxed regex to handle spacing and optional parenthesis escaping
    const match = line.match(/- \[(.*?)\]\(sample:(.*?)\)\s*\(유사도:\s*(.*?)%\)/);
    if (match) {
      queries.push({
        question: match[1],
        id: match[2],
        score: parseFloat(match[3]) / 100
      });
    }
  }
  return queries;
};

const removeSampleQueriesFromContent = (content: string): string => {
  if (!content) return '';
  return content.replace(/\*\*참조 샘플 쿼리\*\*:\s*\r?\n([\s\S]*?)(\r?\n\r?\n|$)/, '');
};

const removeReferencedTablesFromContent = (content: string): string => {
  if (!content) return '';
  return content.replace(/\*\*참조 테이블\*\*:\s*([^\n\r]*)(\r?\n|$)/, '');
};

const ChartView = ({ rows }: { rows: any[] }) => {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  
  const chartData = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const keys = Object.keys(rows[0]);
    if (keys.length < 2) return null;

    let xKey = keys.find((k) => {
      const val = rows[0][k];
      return typeof val === 'string' || val instanceof Date;
    });
    if (!xKey) xKey = keys[0];

    const dataKeys = keys.filter(
      (k) => k !== xKey && typeof rows[0][k] === 'number'
    );

    if (dataKeys.length === 0) return null;

    return { xKey, dataKeys, data: rows.slice(0, 20) };
  }, [rows]);

  if (!chartData) return null;

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <LineChart data={chartData.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chartData.xKey} />
            <YAxis />
            <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }} />
            <Legend />
            {chartData.dataKeys.map((key, index) => (
              <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 4 }} />
            ))}
          </LineChart>
        );
      case 'pie':
        const pieData = chartData.data.map((d) => ({ name: d[chartData.xKey], value: d[chartData.dataKeys[0]] }));
        return (
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
              {pieData.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
            </Pie>
            <RechartsTooltip />
            <Legend />
          </PieChart>
        );
      default:
        return (
          <BarChart data={chartData.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chartData.xKey} />
            <YAxis />
            <RechartsTooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }} />
            <Legend />
            {chartData.dataKeys.map((key, index) => (
              <Bar key={key} dataKey={key} fill={CHART_COLORS[index % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        );
    }
  };

  return (
    <div className="mt-6 h-[340px] w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">데이터 시각화</h3>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button onClick={() => setChartType('bar')} className={`p-1.5 rounded ${chartType === 'bar' ? 'bg-background shadow-sm' : ''}`}>
            <BarChart3 className="h-4 w-4" />
          </button>
          <button onClick={() => setChartType('line')} className={`p-1.5 rounded ${chartType === 'line' ? 'bg-background shadow-sm' : ''}`}>
            <LineChartIcon className="h-4 w-4" />
          </button>
          <button onClick={() => setChartType('pie')} className={`p-1.5 rounded ${chartType === 'pie' ? 'bg-background shadow-sm' : ''}`}>
            <PieChartIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

function QueryPageContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { logAction } = useUserAction();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '안녕하세요! 🎉 자연어로 데이터를 조회해보세요. 질문을 입력하면 SQL로 변환해드립니다.',
      timestamp: new Date(),
    },
  ]);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [input, setInput] = useState('');
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [isDataSourceOpen, setIsDataSourceOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'SUCCESS' | 'FAILED'>('all');
  
  // Initialize from URL
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>(searchParams.get('threadId') || undefined);

  // Sync state with URL changes
  useEffect(() => {
    const tid = searchParams.get('threadId');
    if (tid && tid !== activeThreadId) {
        setActiveThreadId(tid);
    }
  }, [searchParams]);

  const [shareQueryId, setShareQueryId] = useState<string | null>(null);
  const [activeCommentQueryId, setActiveCommentQueryId] = useState<string | null>(null);
  
  // Feedback State
  const [feedbackQueryId, setFeedbackQueryId] = useState<string | null>(null);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);

  // Schema Viewer State
  const [schemaViewerSql, setSchemaViewerSql] = useState<string | null>(null);

  // Simulation Dialog State
  const [simulationInfo, setSimulationInfo] = useState<{ question: string } | null>(null);

  // Sample Query Dialog State
  const [selectedSampleQueryId, setSelectedSampleQueryId] = useState<string | null>(null);
  const [isSampleQueryDialogOpen, setIsSampleQueryDialogOpen] = useState(false);

  const handleSampleQueryClick = (id: string) => {
      setSelectedSampleQueryId(id);
      setIsSampleQueryDialogOpen(true);
  };

  // Destructive SQL Confirmation State
  const [pendingDestructiveExec, setPendingDestructiveExec] = useState<{
    queryId: string;
    sql: string;
    operations: string[];
  } | null>(null);

  // Partial Failure Recovery State
  const [partialFailureInfo, setPartialFailureInfo] = useState<{
    queryId: string;
    originalSql: string;
    batchResults: { index: number; sql: string; success: boolean; rowsAffected?: number; error?: string }[];
    successStatements: string[];
    failedStatements: { sql: string; error: string }[];
  } | null>(null);

  // Query History
  const { data: historyData, isLoading: isHistoryLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['queryHistory', selectedDataSource],
    queryFn: async () => {
         const res: any = await api.getQueryHistory({ limit: 30, dataSourceId: selectedDataSource || undefined });
         return res;
    },
    enabled: isHistoryOpen,
  });

  const filteredHistory = useMemo(() => {
    if (!historyData?.items) return [];
    return historyData.items.filter((item: any) => {
      const matchesSearch = !historySearch || 
        item.naturalQuery?.toLowerCase().includes(historySearch.toLowerCase());
      const matchesStatus = historyStatusFilter === 'all' || item.status === historyStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [historyData, historySearch, historyStatusFilter]);

  const { data: dataSources = [] } = useQuery({
    queryKey: ['dataSources'],
    queryFn: () => api.getDataSources(),
  });

  // Persist selected data source to localStorage
  useEffect(() => {
    if (selectedDataSource) {
      localStorage.setItem('jask_selectedDataSource', selectedDataSource);
    }
  }, [selectedDataSource]);

  // Initialize or validate selected data source when dataSources change
  useEffect(() => {
    if (dataSources.length > 0) {
      // First, try to load from localStorage on mount
      const storedSelection = localStorage.getItem('jask_selectedDataSource');
      
      // Check if stored selection is valid
      const isStoredValid = storedSelection && 
        dataSources.some((ds: any) => ds.id === storedSelection);
      
      // Check if current selection is valid
      const isCurrentValid = selectedDataSource && 
        dataSources.some((ds: any) => ds.id === selectedDataSource);
      
      if (isStoredValid && !selectedDataSource) {
        // Use stored selection if current is empty
        setSelectedDataSource(storedSelection);
      } else if (!isCurrentValid) {
        // Current selection is invalid, set to first available
        setSelectedDataSource(dataSources[0].id);
      }
    }
  }, [dataSources]);

  /* Ref for skipping load on create */
  const skipNextLoadRef = useRef(false);

  useEffect(() => {
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }
    if (activeThreadId) {
      loadThreadMessages(activeThreadId);
    } else {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: '안녕하세요! 🎉 자연어로 데이터를 조회해보세요. 질문을 입력하면 SQL로 변환해드립니다.',
        timestamp: new Date(),
      }]);
    }
  }, [activeThreadId]);

  const loadThreadMessages = async (threadId: string) => {
    try {
      const thread = await api.getThread(threadId);
      if (thread && thread.messages) {
        const mapped: Message[] = thread.messages.map((m: any) => ({
          id: m.id,
          role: m.role.toLowerCase(),
          content: m.content,
          timestamp: new Date(m.timestamp),
          sql: m.query?.finalSql || m.query?.generatedSql,
          queryId: m.query?.id,
          meta: m.query ? {
             riskLevel: m.query.riskLevel,
             trustScore: m.query.trustScore,

          } : undefined,
          feedback: m.query?.feedback as 'POSITIVE' | 'NEGATIVE' | undefined
        }));
        setMessages(mapped);
      }
    } catch (e) {
       toast({ title: '대화 불러오기 실패', variant: 'destructive' });
    }
  };

  const handleThreadSelect = (threadId: string) => {
    setActiveThreadId(threadId);
    const params = new URLSearchParams(searchParams);
    params.set('threadId', threadId);
    router.replace(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch AI recommended questions
  const { data: suggestedQuestions = [], isLoading: isSuggestionsLoading, refetch: refetchSuggestions } = useQuery({
    queryKey: ['suggestedQuestions', selectedDataSource],
    queryFn: () => api.getRecommendedQuestions(selectedDataSource),
    enabled: !!selectedDataSource,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    retry: false,
  });

  // Auto-focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Force regenerate AI recommendations
  const [isForceRegenerating, setIsForceRegenerating] = useState(false);
  const handleForceRegenerate = async () => {
    setIsForceRegenerating(true);
    try {
      const newQuestions = await api.getRecommendedQuestions(selectedDataSource, true);
      queryClient.setQueryData(['suggestedQuestions', selectedDataSource], newQuestions);
      toast({ title: 'AI 추천 질문이 새로 생성되었습니다!' });
    } catch (error) {
      toast({ title: 'AI 생성 실패', variant: 'destructive' });
    } finally {
      setIsForceRegenerating(false);
    }
  };

  const generateMutation = useMutation({
    mutationFn: (question: string) =>
      api.generateQuery(selectedDataSource, question, true),
    onSuccess: (data: any, question) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.isLoading
            ? {
                ...msg,
                isLoading: false,
                content: data.explanation || 'SQL이 생성되었습니다.',
                sql: data.generatedSQL,
                result: data.result,
                queryId: data.queryId,
              }
            : msg
        )
      );
      if (data.queryId) {
        logAction(ActionType.QUERY, data.queryId, { question });
      }
    },
    onError: (error: Error) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.isLoading
            ? {
                ...msg,
                isLoading: false,
                content: '죄송합니다, 오류가 발생했습니다.',
                error: error.message,
              }
            : msg
        )
      );
    },
  });

  const executeMutation = useMutation({
    mutationFn: ({ queryId, sql }: { queryId: string; sql: string }) =>
      api.executeQuery(queryId, sql),
    onMutate: async (variables) => {
       setMessages((prev) =>
        prev.map((msg) =>
          msg.queryId === variables.queryId
            ? { ...msg, isExecuting: true, error: undefined }
            : msg
        )
      );
    },
    onSuccess: (data: any, variables) => {
      // Check for partial failure in batch execution
      if (data.result?.hasPartialFailure && data.result?.batchResults) {
        const batchResults = data.result.batchResults;
        const successStatements = batchResults
          .filter((r: any) => r.success)
          .map((r: any) => r.sql);
        const failedStatements = batchResults
          .filter((r: any) => !r.success)
          .map((r: any) => ({ sql: r.sql, error: r.error || '알 수 없는 오류' }));
        
        setPartialFailureInfo({
          queryId: variables.queryId,
          originalSql: variables.sql,
          batchResults,
          successStatements,
          failedStatements,
        });
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg.queryId === variables.queryId
              ? { ...msg, isExecuting: false, error: data.result.firstError || '일부 문장 실행 실패' }
              : msg
          )
        );
        return;
      }
      
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.queryId === variables.queryId) {
             let newContent = msg.content;
             // If SQL changed (auto-fix), update content display
             if (data.finalSql && data.finalSql !== variables.sql) {
                 newContent = newContent.replace(/```sql[\s\S]*?```/, `\`\`\`sql\n${data.finalSql}\n\`\`\``) +
                              `\n\n> **알림:** 초기 쿼리 실행이 실패하여, 자동으로 수정된 쿼리로 재실행되었습니다.`;
             }
             
             return { 
                 ...msg, 
                 result: data.result, 
                 isExecuting: false,
                 sql: data.finalSql || variables.sql,
                 content: newContent,
                 meta: { ...msg.meta, trustScore: 1.0 } // Confirmed success
             };
          }
          return msg;
        })
      );
      toast({ title: '쿼리 실행 완료' });
      logAction(ActionType.EXECUTE, variables.queryId, { sql: variables.sql });
    },
    onError: (error: Error, variables) => {
        setMessages((prev) =>
            prev.map((msg) =>
              msg.queryId === variables.queryId
                ? { ...msg, isExecuting: false, error: error.message }
                : msg
            )
        );
        toast({ title: '실행 실패', description: error.message, variant: 'destructive' });
    }
  });

  const addFavoriteMutation = useMutation({
    mutationFn: (data: { name: string; naturalQuery: string; sqlQuery: string; queryId?: string }) =>
      api.addFavorite(data),
    onSuccess: (response: any, variables) => {
      toast({ title: '즐겨찾기에 추가되었습니다 ⭐' });
      // Mark the message as favorited and store the favorite id
      if (variables.queryId) {
        setMessages(prev => prev.map(m => 
          m.queryId === variables.queryId ? { ...m, favorited: true, favoriteId: response.id } : m
        ));
        logAction(ActionType.SAVE, variables.queryId);
      }
    },
    onError: () => {
      toast({ title: '즐겨찾기 추가 실패', variant: 'destructive' });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: (data: { favoriteId: string; queryId: string }) =>
      api.removeFavorite(data.favoriteId),
    onSuccess: (_, variables) => {
      toast({ title: '즐겨찾기에서 삭제되었습니다' });
      // Mark the message as not favorited
      setMessages(prev => prev.map(m => 
        m.queryId === variables.queryId ? { ...m, favorited: false, favoriteId: undefined } : m
      ));
    },
    onError: () => {
      toast({ title: '즐겨찾기 삭제 실패', variant: 'destructive' });
    },
  });

  // Feedback Handler
  const handleFeedback = async (queryId: string, type: 'POSITIVE' | 'NEGATIVE', note?: string) => {
    try {
      // Find current message to check existing feedback
      const currentMessage = messages.find(m => m.queryId === queryId);
      const isSameFeedback = currentMessage?.feedback === type;
      
      // Optimistic Update - toggle off if same feedback, otherwise set new feedback
      setMessages(prev => prev.map(m => 
          m.queryId === queryId ? { ...m, feedback: isSameFeedback ? undefined : type } : m
      ));
      
      if (isSameFeedback) {
        // Remove feedback
        await api.post(`/query/${queryId}/feedback`, { feedback: null, note });
        toast({ title: "피드백이 취소되었습니다" });
      } else {
        // Set new feedback
        await api.post(`/query/${queryId}/feedback`, { feedback: type, note });
        toast({ title: type === 'POSITIVE' ? "감사합니다! 👍" : "피드백이 제출되었습니다." });
        logAction(ActionType.RATE, queryId, { rating: type, reason: note });
      }
    } catch (e) {
      // Revert on error
      toast({ title: "피드백 제출 실패", variant: "destructive" });
    }
  };
  
  const onNegativeFeedback = (queryId: string) => {
     setFeedbackQueryId(queryId);
     setIsFeedbackDialogOpen(true);
  };



  // Helper for opening table schema
  const handleTableClick = (tableName: string) => {
    // Fake SQL to trigger the viewer logic
    setSchemaViewerSql(`SELECT * FROM ${tableName}`);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!selectedDataSource) {
      toast({ title: '데이터소스를 선택해주세요', variant: 'destructive' });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    const currentInput = input;
    setInput('');

    try {
      let currentThreadId = activeThreadId;

      // Create thread if not exists
      if (!currentThreadId) {
          const newThread = await api.createThread({ title: currentInput.slice(0, 30) });
          currentThreadId = newThread.id;
          skipNextLoadRef.current = true;
          setActiveThreadId(currentThreadId);
          queryClient.invalidateQueries({ queryKey: ['threads'] }); // Refresh sidebar
      }

      // Persist User Message
      await api.addMessage(currentThreadId!, { role: 'USER', content: currentInput });

      let currentContent = '';
      let preamble = '';
      let currentSql = '';
      let sqlExplanation = '';
      let tokenUsage = { prompt: 0, completion: 0, total: 0 };

      // Pass threadId to stream
      const stream = api.generateQueryStream(selectedDataSource, currentInput, true, currentThreadId);

      for await (const chunk of stream) {
        if (chunk.type === 'step_start') {
          // stepMessage = `[${chunk.step}] ${chunk.message}`; 
        } else if (chunk.type === 'context_selected') {
           setMessages((prev) => prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, selectedTables: chunk.tables } 
                : msg
            ));
        } else if (chunk.type === 'sample_queries_found') {
           setMessages((prev) => prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, selectedSampleQueries: chunk.samples } 
                : msg
            ));
        } else if (chunk.type === 'content_chunk') {
          if (chunk.step === 'sql_generation') {
            currentSql += chunk.content;
          } else if (chunk.step === 'explanation') {
            sqlExplanation += chunk.content;
          } else {
            // General content (Referenced Tables, Sample Queries, etc.)
            preamble += chunk.content;
          }

          // Construct display content
          let displayContent = preamble;
          
          if (currentSql) {
             displayContent += `### 1. SQL Generation\n\`\`\`sql\n${currentSql}\n\`\`\`\n\n`;
          }
          if (sqlExplanation) {
             displayContent += `### 2. Explanation\n${sqlExplanation}`;
          }

          setMessages((prev) => prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { 
                  ...msg, 
                  isLoading: true, 
                  content: displayContent, 
                  sql: currentSql 
                } 
              : msg
          ));
        } else if (chunk.type === 'token_usage') {
             // ... usage handling ...
        } else if (chunk.type === 'execution_result') {
           setMessages((prev) => prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, result: chunk.result } 
                : msg
            ));
        } else if (chunk.type === 'done') {
           setMessages((prev) => prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { 
                    ...msg, 
                    isLoading: false, 
                    queryId: chunk.queryId,
                    meta: { 
                        ...msg.meta, 
                        trustScore: chunk.trustScore, 
                        riskLevel: chunk.riskLevel 
                    }
                  } 
                : msg
            ));
            // Invalidate thread messages to ensure consistency? 
            // Maybe not needed if we trust local state until refresh.
        } else if (chunk.type === 'error') {
           throw new Error(chunk.message);
        }
      }

    } catch (error: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id
            ? {
                ...msg,
                isLoading: false,
                content: '오류가 발생했습니다.',
                error: error.message,
              }
            : msg
        )
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copySQL = (sql: string) => {
    navigator.clipboard.writeText(sql);
    toast({ title: 'SQL이 복사되었습니다' });
  };

  // 파괴적 SQL 감지
  const isDestructiveSQL = (sql: string): string[] => {
    const destructiveKeywords = ['DROP', 'TRUNCATE', 'DELETE'];
    const upperSql = sql.toUpperCase();
    return destructiveKeywords.filter(kw => new RegExp(`\\b${kw}\\b`).test(upperSql));
  };

  // 확인이 필요한 SQL 실행 처리
  const handleExecuteWithConfirmation = (queryId: string, sql: string) => {
    const destructiveOps = isDestructiveSQL(sql);
    if (destructiveOps.length > 0) {
      // 파괴적 명령 감지 - 확인 요청
      setPendingDestructiveExec({ queryId, sql, operations: destructiveOps });
    } else {
      // 안전한 SQL - 바로 실행
      executeMutation.mutate({ queryId, sql });
    }
  };

  // 확인 후 실행
  const confirmDestructiveExecution = () => {
    if (pendingDestructiveExec) {
      executeMutation.mutate({ 
        queryId: pendingDestructiveExec.queryId, 
        sql: pendingDestructiveExec.sql 
      });
      setPendingDestructiveExec(null);
    }
  };

  // 부분 실패 시 성공 가능한 문장만 재실행
  const executeSuccessfulStatementsOnly = async () => {
    if (!partialFailureInfo) return;
    
    const successSql = partialFailureInfo.successStatements.join(';\n');
    if (successSql.trim()) {
      try {
        // Re-execute only successful statements with skipOnError
        const result = await api.post(`/nl2sql/execute/${partialFailureInfo.queryId}`, { 
          sql: successSql,
          skipOnError: true 
        });
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg.queryId === partialFailureInfo.queryId
              ? { ...msg, result: (result as any).result, error: undefined, isExecuting: false }
              : msg
          )
        );
        
        toast({ 
          title: '부분 실행 완료', 
          description: `${partialFailureInfo.successStatements.length}개 문장이 성공적으로 실행되었습니다.` 
        });
      } catch (error: any) {
        toast({ title: '실행 실패', description: error.message, variant: 'destructive' });
      }
    }
    setPartialFailureInfo(null);
  };

  const selectedDS = dataSources.find((ds: any) => ds.id === selectedDataSource);

  return (
    <TooltipProvider>
    <MainLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Thread Sidebar */}
        <ThreadSidebar 
          activeThreadId={activeThreadId} 
          onThreadSelect={handleThreadSelect} 
        />

        {/* Main Content */}
        <div className={`flex flex-col flex-1 transition-all duration-300 ${isHistoryOpen ? 'mr-80' : ''}`}>
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center justify-between bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-semibold">데이터 질문하기</h1>
              <p className="text-xs text-muted-foreground">자연어로 SQL 쿼리 생성</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Clear Chat */}
            {messages.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => {
                  setMessages([{
                    id: 'welcome',
                    role: 'assistant',
                    content: '안녕하세요! 🎉 자연어로 데이터를 조회해보세요. 질문을 입력하면 SQL로 변환해드립니다.',
                    timestamp: new Date(),
                  }]);
                  toast({ title: '대화가 초기화되었습니다' });
                }}
                title="대화 초기화"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}

            {/* DataSource Selector */}
            <div className="relative">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setIsDataSourceOpen(!isDataSourceOpen)}
              >
                <Database className="h-4 w-4" />
                {selectedDS?.name || '데이터소스 선택'}
                <ChevronDown className="h-4 w-4" />
              </Button>
            {isDataSourceOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-lg border bg-popover shadow-lg z-50">
                <div className="p-2">
                  {dataSources.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">
                      연결된 데이터소스가 없습니다
                    </p>
                  ) : (
                    dataSources.map((ds: any) => (
                      <button
                        key={ds.id}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors ${
                          selectedDataSource === ds.id ? 'bg-accent' : ''
                        }`}
                        onClick={() => {
                          setSelectedDataSource(ds.id);
                          setIsDataSourceOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${ds.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="font-medium">{ds.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ds.type} · {ds.host}:{ds.port}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

            {/* History Toggle */}
            <Button
              variant={isHistoryOpen ? "default" : "outline"}
              size="icon"
              className="h-9 w-9"
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              title="질문 히스토리"
            >
              {isHistoryOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <History className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}

              <div className={`max-w-[80%] min-w-0 ${message.role === 'user' ? 'order-first' : ''}`}>
                {message.role === 'user' ? (
                  <div className="group relative">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 pr-10">
                      <p>{message.content}</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/20"
                          onClick={() => setInput(message.content)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p>다시 질문하기</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Selected Tables Context */}
                    {/* Selected Tables Context */}
                    {(() => {
                      const displayTables = (message.selectedTables && message.selectedTables.length > 0)
                        ? message.selectedTables 
                        : extractTablesFromContent(message.content);

                      const displaySampleQueries = (message.selectedSampleQueries && message.selectedSampleQueries.length > 0)
                        ? message.selectedSampleQueries
                        : extractSampleQueriesFromContent(message.content);

                      if ((displayTables && displayTables.length > 0) || (displaySampleQueries && displaySampleQueries.length > 0)) {
                        return (
                          <div className="flex flex-col gap-2 mb-3">
                              {displayTables && displayTables.length > 0 && (
                                <div className="flex flex-wrap gap-1 px-1">
                                    <span className="text-xs text-muted-foreground self-center mr-1">참조 테이블:</span>
                                    {displayTables.map(t => (
                                    <Badge 
                                        variant="secondary" 
                                        className="text-[10px] h-5 px-1.5 font-mono cursor-pointer hover:bg-muted-foreground/20 transition-colors" 
                                        key={t}
                                        onClick={() => handleTableClick(t)}
                                    >
                                        {t}
                                    </Badge>
                                    ))}
                                </div>
                              )}
                              
                              {displaySampleQueries && displaySampleQueries.length > 0 && (
                                  <div className="flex flex-wrap gap-1 px-1">
                                    <span className="text-xs text-muted-foreground self-center mr-1 flex items-center gap-1">
                                        <BookOpen className="h-3 w-3" />
                                        참조 샘플:
                                    </span>
                                    {displaySampleQueries.map(q => (
                                    <Badge 
                                        variant="outline" 
                                        className="text-[10px] h-5 px-2 cursor-pointer hover:bg-muted transition-colors gap-1 max-w-[300px] truncate" 
                                        key={q.id}
                                        onClick={() => handleSampleQueryClick(q.id)}
                                        title={q.question}
                                    >
                                        <span className="truncate">{q.question}</span>
                                        <span className="text-muted-foreground opacity-70 text-[9px]">{(q.score * 100).toFixed(0)}%</span>
                                    </Badge>
                                    ))}
                                </div>
                              )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {message.isLoading && !message.content ? (
                      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <div className="absolute inset-0 h-5 w-5 rounded-full bg-primary/20 animate-ping" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium">AI가 분석 중입니다...</span>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 bg-muted-foreground/20 rounded-full overflow-hidden">
                                <div className="h-full w-1/2 bg-primary rounded-full animate-pulse" style={{ animation: 'pulse 1s ease-in-out infinite, moveRight 2s linear infinite' }} />
                              </div>
                              <span className="text-xs text-muted-foreground">SQL 생성 중</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : message.isLoading && message.content ? (
                      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm break-words overflow-hidden w-full max-w-full">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          <span className="text-xs text-primary font-medium">실시간 스트리밍...</span>
                        </div>
                        <div className="overflow-x-auto">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={{
                              pre: ({ node, ...props }) => (
                                <pre className="overflow-x-auto max-w-full" {...props} />
                              ),
                              code: ({ node, className, children, ...props }: any) => (
                                <code className="relative rounded bg-background px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold break-all" {...props}>{children}</code>
                              ),
                              p: ({ node, ...props }) => <p className="whitespace-pre-wrap mb-2 last:mb-0 break-words" {...props} />,
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <>
                        {message.error ? (
                          <div className="bg-destructive/10 text-destructive rounded-2xl rounded-tl-sm px-4 py-3">
                            <p className="text-sm">{message.error}</p>
                          </div>
                        ) : (
                          <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm break-words overflow-hidden w-full">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeRaw]}
                              components={{
                                a: ({ node, href, children, ...props }: any) => {
                                  if (href?.startsWith('table:')) {
                                    const tableName = href.replace('table:', '');
                                    return (
                                      <span
                                        onClick={() => handleTableClick(tableName)}
                                        className="cursor-pointer font-medium text-primary hover:underline"
                                      >
                                        {children}
                                      </span>
                                    );
                                  }
                                  return (
                                    <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
                                      {children}
                                    </a>
                                  );
                                },
                                table: ({ node, ...props }) => (
                                  <div className="overflow-x-auto my-2 border rounded-md bg-background">
                                    <table className="w-full text-sm" {...props} />
                                  </div>
                                ),
                                thead: ({ node, ...props }) => (
                                  <thead className="bg-muted/50 border-b" {...props} />
                                ),
                                tbody: ({ node, ...props }) => (
                                  <tbody className="divide-y" {...props} />
                                ),
                                tr: ({ node, ...props }) => (
                                  <tr className="hover:bg-muted/50 transition-colors" {...props} />
                                ),
                                th: ({ node, ...props }) => (
                                  <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0" {...props} />
                                ),
                                td: ({ node, ...props }) => (
                                  <td className="p-3 align-top [&:has([role=checkbox])]:pr-0 [&>ul]:my-0 [&>ul]:ml-4 [&>ol]:my-0 [&>ol]:ml-4" {...props} />
                                ),
                                p: ({ node, ...props }) => (
                                  <p className="whitespace-pre-wrap mb-2 last:mb-0" {...props} />
                                ),
                                ul: ({ node, ...props }) => (
                                  <ul className="my-2 ml-5 list-disc space-y-1" {...props} />
                                ),
                                ol: ({ node, ...props }) => (
                                  <ol className="my-2 ml-5 list-decimal space-y-1" {...props} />
                                ),
                                li: ({ node, ...props }) => (
                                  <li className="text-sm leading-relaxed" {...props} />
                                ),
                                code: ({ node, className, children, ...props }: any) => {
                                  return (
                                    <code
                                      className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold"
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  );
                                },
                              }}
                            >
                              {removeReferencedTablesFromContent(removeSampleQueriesFromContent(message.content))}
                            </ReactMarkdown>
                            {message.meta?.tokens && (
                              <div className="mt-2 pt-2 border-t text-xs text-muted-foreground flex gap-3">
                                 <span className="font-semibold">Tokens: {message.meta.tokens.total}</span>
                                 <span>(In: {message.meta.tokens.prompt} / Out: {message.meta.tokens.completion})</span>
                              </div>
                            )}
                          </div>
                        )}

                        {message.sql && (
                          <Card className="overflow-hidden w-full">
                            <div className="bg-zinc-900 text-zinc-100 p-4 overflow-x-auto">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-zinc-400">Generated SQL</span>
                                    {message.meta?.riskLevel && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Badge variant="outline" className={`text-[10px] h-5 px-1.5 cursor-help ${
                                                    message.meta.riskLevel === 'HIGH' || message.meta.riskLevel === 'CRITICAL' ? 'border-red-500 text-red-500' :
                                                    message.meta.riskLevel === 'MEDIUM' ? 'border-yellow-500 text-yellow-500' :
                                                    'border-green-500 text-green-500'
                                                }`}>
                                                    Risk: {message.meta.riskLevel}
                                                </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs bg-zinc-800 text-zinc-100 border-zinc-700">
                                                <p className="font-semibold mb-2">위험도 산정 기준 (Risk Level)</p>
                                                <ul className="list-disc pl-4 text-xs space-y-1 mb-2">
                                                    <li><strong>CRITICAL:</strong> 데이터 변경(DROP, DELETE, UPDATE)이나 민감 테이블 접근 포함.</li>
                                                    <li><strong>HIGH:</strong> JOIN 5개 이상 또는 LIMIT/집계 함수 없는 대량 조회 가능성.</li>
                                                    <li><strong>MEDIUM:</strong> JOIN 3~4개 포함.</li>
                                                    <li><strong>LOW:</strong> 단순 조회 (JOIN 2개 이하).</li>
                                                </ul>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                    {message.meta?.trustScore !== undefined && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Badge variant="outline" className={`text-[10px] h-5 px-1.5 cursor-help ${
                                                    message.meta.trustScore < 0.5 ? 'border-red-500 text-red-500' : 
                                                    message.meta.trustScore > 0.8 ? 'border-green-500 text-green-500' : 'border-blue-500 text-blue-500'
                                                }`}>
                                                    Trust: {Math.round(message.meta.trustScore * 100)}%
                                                </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs bg-zinc-800 text-zinc-100 border-zinc-700">
                                                <p className="font-semibold mb-2">신뢰도 산정 로직 (Trust Score)</p>
                                                <div className="space-y-2 text-xs">
                                                    <div>
                                                        <span className="font-bold text-green-400">실행 성공 시: 100%</span>
                                                    </div>
                                                    <div className="pt-2 border-t border-zinc-600">
                                                        <span className="font-bold text-zinc-300">실행 전 (예측): 요약 검토</span>
                                                    </div>
                                                    <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                                                        <span>기본 점수</span>
                                                        <span className="text-zinc-400">80%</span>
                                                        <span>SELECT * (전체 컬럼)</span>
                                                        <span className="text-red-400">-15%</span>
                                                        <span>WHERE 조건 포함</span>
                                                        <span className="text-green-400">+5%</span>
                                                        <span>LIMIT 절 포함</span>
                                                        <span className="text-green-400">+5%</span>
                                                    </div>
                                                    <div className="pt-1 text-[10px] text-zinc-500 italic">
                                                        * 실행 전에는 90% 까지 제한됨
                                                    </div>
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-zinc-400 hover:text-white"
                                    onClick={() => copySQL(message.sql!)}
                                    title="SQL 복사"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-zinc-400 hover:text-cyan-400"
                                    onClick={() => setSchemaViewerSql(message.sql!)}
                                    title="테이블 스키마 보기"
                                  >
                                    <Database className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-zinc-400 hover:text-purple-400"
                                    onClick={() => {
                                      const msgIndex = messages.findIndex(m => m.id === message.id);
                                      const userMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
                                      setSimulationInfo({ question: userMsg?.content || '' });
                                    }}
                                    title="AI 생성 과정 보기"
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  {message.queryId && (
                                    <Button
                                      variant={message.result ? "ghost" : "default"} // Highlight if no result
                                      size={message.result ? "icon" : "sm"}
                                      className={`${message.result ? "h-6 w-6 text-zinc-400 hover:text-white" : "h-7 gap-1.5 bg-green-600 hover:bg-green-700 text-white"}`}
                                      onClick={() =>
                                        handleExecuteWithConfirmation(
                                          message.queryId!,
                                          message.sql!
                                        )
                                      }
                                      title="Run Query"
                                    >
                                      {message.isExecuting ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : message.result ? <RefreshCw className="h-3 w-3" /> : (
                                        <>
                                          <Play className="h-3 w-3 fill-current" />
                                          <span className="text-xs">Run</span>
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-6 w-6 ${message.favorited ? 'text-yellow-400' : 'text-zinc-400 hover:text-yellow-400'}`}
                                    onClick={() => {
                                      if (message.favorited && message.favoriteId) {
                                        // Remove from favorites
                                        removeFavoriteMutation.mutate({
                                          favoriteId: message.favoriteId,
                                          queryId: message.queryId!,
                                        });
                                      } else {
                                        // Add to favorites
                                        const msgIndex = messages.findIndex(m => m.id === message.id);
                                        const userMsg = messages.slice(0, msgIndex).reverse().find(m => m.role === 'user');
                                        addFavoriteMutation.mutate({
                                          name: userMsg?.content?.slice(0, 50) || 'My Query',
                                          naturalQuery: userMsg?.content || '',
                                          sqlQuery: message.sql!,
                                          queryId: message.queryId,
                                        });
                                      }
                                    }}
                                    title={message.favorited ? '즐겨찾기에서 삭제' : '즐겨찾기에 추가'}
                                  >
                                    <Star className={`h-3 w-3 ${message.favorited ? 'fill-current' : ''}`} />
                                  </Button>
                                  
                                  {/* Feedback Buttons */}
                                  {message.queryId && (
                                     <>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className={`h-6 w-6 ${message.feedback === 'POSITIVE' ? 'text-green-500' : 'text-zinc-400 hover:text-green-500'}`}
                                          onClick={() => handleFeedback(message.queryId!, 'POSITIVE')}
                                          title="Good Response"
                                        >
                                          <ThumbsUp className={`h-3 w-3 ${message.feedback === 'POSITIVE' ? 'fill-current' : ''}`} />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className={`h-6 w-6 ${message.feedback === 'NEGATIVE' ? 'text-red-500' : 'text-zinc-400 hover:text-red-500'}`}
                                          onClick={() => onNegativeFeedback(message.queryId!)}
                                          title="Bad Response"
                                        >
                                          <ThumbsDown className={`h-3 w-3 ${message.feedback === 'NEGATIVE' ? 'fill-current' : ''}`} />
                                        </Button>
                                     </>
                                  )}

                                  {/* Collaboration Buttons */}
                                  {message.queryId && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                                            onClick={() => setActiveCommentQueryId(activeCommentQueryId === message.queryId ? null : (message.queryId || null))}
                                            title="Comments"
                                        >
                                            <MessageSquare className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                                            onClick={() => setShareQueryId(message.queryId || null)}
                                            title="Share"
                                        >
                                            <Share2 className="h-3 w-3" />
                                        </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="relative">
                                {/* ... SQL Code ... */}
                                <SyntaxHighlighter
                                  language="sql"
                                  style={vscDarkPlus}
                                  customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
                                >
                                  {String(message.sql)}
                                </SyntaxHighlighter>
                              </div>

                              {/* Comments Section */}
                              {activeCommentQueryId === message.queryId && message.queryId && (
                                  <div className="border-t border-zinc-700 bg-zinc-800/50 p-3">
                                      <CommentSection queryId={message.queryId} />
                                  </div>
                              )}
                            </div>
                          </Card>
                        )}

                        {message.result && (
                          <Card>
                            <CardContent className="p-0">
                              <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
                                <div className="flex items-center gap-2">
                                  <Table className="h-4 w-4" />
                                  <span className="text-sm font-medium">
                                    결과 ({message.result.rowCount || message.result.rows?.length || 0}행)
                                  </span>
                                  {message.result.executionTime && (
                                    <span className="text-xs text-muted-foreground">
                                      {message.result.executionTime}ms
                                    </span>
                                  )}
                                </div>
                                {message.result.rows?.length > 0 && (
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => {
                                        const rows = message.result.rows;
                                        const headers = Object.keys(rows[0]);
                                        const csvContent = [
                                          headers.join(','),
                                          ...rows.map((row: any) => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
                                        ].join('\n');
                                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `query-result-${new Date().toISOString().slice(0,10)}.csv`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                        toast({ title: 'CSV 파일이 다운로드되었습니다' });
                                      }}
                                    >
                                      <Download className="h-3 w-3" />
                                      CSV
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs gap-1"
                                      onClick={() => {
                                        const jsonContent = JSON.stringify(message.result.rows, null, 2);
                                        const blob = new Blob([jsonContent], { type: 'application/json' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `query-result-${new Date().toISOString().slice(0,10)}.json`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                        toast({ title: 'JSON 파일이 다운로드되었습니다' });
                                      }}
                                    >
                                      <Download className="h-3 w-3" />
                                      JSON
                                    </Button>
                                  </div>
                                )}
                              </div>
                              <div className="max-h-64 overflow-auto">
                                {message.result.rows && message.result.rows.length > 0 ? (
                                  <table className="w-full text-sm">
                                    <thead className="bg-muted/30 sticky top-0">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-medium w-10 text-muted-foreground">#</th>
                                        {Object.keys(message.result.rows[0]).map((key) => (
                                          <th key={key} className="px-3 py-2 text-left font-medium">
                                            {key}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {message.result.rows.slice(0, 50).map((row: any, i: number) => (
                                        <tr key={i} className="border-t hover:bg-muted/30">
                                          <td className="px-3 py-2 text-muted-foreground text-xs">{i + 1}</td>
                                          {Object.values(row).map((val: any, j: number) => (
                                            <td key={j} className="px-3 py-2 max-w-xs truncate">
                                              {val === null ? (
                                                <span className="text-muted-foreground italic">null</span>
                                              ) : typeof val === 'number' ? (
                                                <span className="font-mono">{val.toLocaleString()}</span>
                                              ) : (
                                                String(val)
                                              )}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div className="py-8 text-center text-muted-foreground">
                                    결과가 없습니다
                                  </div>
                                )}
                              </div>
                              <ChartView rows={message.result.rows} />
                            </CardContent>
                          </Card>
                        )}

                        {message.queryId && !message.error && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">도움이 되었나요?</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${message.feedback === 'POSITIVE' ? 'text-green-500' : 'text-zinc-400 hover:text-green-500'}`}
                              onClick={() => handleFeedback(message.queryId!, 'POSITIVE')}
                            >
                              <ThumbsUp className={`h-3.5 w-3.5 ${message.feedback === 'POSITIVE' ? 'fill-current' : ''}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${message.feedback === 'NEGATIVE' ? 'text-red-500' : 'text-zinc-400 hover:text-red-500'}`}
                              onClick={() => handleFeedback(message.queryId!, 'NEGATIVE')}
                            >
                              <ThumbsDown className={`h-3.5 w-3.5 ${message.feedback === 'NEGATIVE' ? 'fill-current' : ''}`} />
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  AI 추천 질문
                </h3>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 gap-1.5 text-xs"
                        onClick={handleForceRegenerate}
                        disabled={isForceRegenerating || isSuggestionsLoading}
                      >
                        {isForceRegenerating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Bot className="h-3 w-3" />
                        )}
                        새로 생성
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>AI로 추천 질문을 새로 생성합니다 (DB에 저장됨)</TooltipContent>
                  </Tooltip>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0" 
                    onClick={() => refetchSuggestions()}
                    disabled={isSuggestionsLoading}
                  >
                    <RefreshCw className={`h-3 w-3 ${isSuggestionsLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              
              {isSuggestionsLoading ? (
                <div className="flex flex-wrap gap-2">
                   {[1, 2, 3].map(i => (
                     <div key={i} className="h-8 w-32 bg-muted rounded-full animate-pulse" />
                   ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.length > 0 ? suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      className="px-3 py-1.5 text-sm rounded-full border bg-background hover:bg-accent transition-colors text-left"
                      onClick={() => setInput(q)}
                    >
                      {q}
                    </button>
                  )) : (
                    <p className="text-sm text-muted-foreground">추천 질문을 생성할 수 없습니다.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t p-4 bg-background/95 backdrop-blur">
          <div className="max-w-4xl mx-auto">
            {/* Quick Examples (shown when input is empty and few messages) */}
            {!input && messages.length <= 2 && (
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground self-center">예시:</span>
                {['지난 달 매출 합계', '최근 10개 주문', '고객별 구매 횟수'].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    className="px-2.5 py-1 text-xs rounded-md bg-muted hover:bg-accent transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="자연어로 질문을 입력하세요..."
                  className="min-h-[52px] max-h-32 resize-none pr-20"
                  rows={1}
                />
                <div className="absolute right-2 bottom-2 text-xs text-muted-foreground hidden sm:block">
                  ⏎ 전송
                </div>
              </div>
              <Button
                onClick={handleSend}
                disabled={!input.trim() || generateMutation.isPending}
                className="h-[52px] w-[52px] shrink-0"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">💡 Tip: 구체적으로 질문할수록 정확한 결과를 얻을 수 있어요</span>
              <span>Enter 전송 · Shift+Enter 줄바꿈</span>
            </div>
          </div>
        </div>
        </div>

        {/* History Sidebar */}
        <div 
          className={`fixed right-0 top-16 h-[calc(100vh-4rem)] w-80 border-l bg-background shadow-lg transition-transform duration-300 ${
            isHistoryOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex flex-col h-full">
            {/* Sidebar Header */}
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold">질문 히스토리</h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => refetchHistory()}
                  disabled={isHistoryLoading}
                >
                  <RotateCcw className={`h-3.5 w-3.5 ${isHistoryLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              
              {/* Search */}
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="질문 검색..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>

              {/* Filter */}
              <div className="flex gap-1">
                <Button
                  variant={historyStatusFilter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={() => setHistoryStatusFilter('all')}
                >
                  전체
                </Button>
                <Button
                  variant={historyStatusFilter === 'SUCCESS' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={() => setHistoryStatusFilter('SUCCESS')}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  성공
                </Button>
                <Button
                  variant={historyStatusFilter === 'FAILED' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs flex-1"
                  onClick={() => setHistoryStatusFilter('FAILED')}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  실패
                </Button>
              </div>
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto">
              {isHistoryLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <History className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {historySearch || historyStatusFilter !== 'all' 
                      ? '검색 결과가 없습니다' 
                      : '질문 히스토리가 없습니다'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredHistory.map((item: any) => (
                    <div
                      key={item.id}
                      className="p-3 hover:bg-muted/50 transition-colors group cursor-pointer"
                      onClick={() => {
                        setInput(item.naturalQuery);
                        inputRef.current?.focus();
                        toast({ title: '질문이 입력창에 복사되었습니다' });
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.naturalQuery}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant={item.status === 'SUCCESS' ? 'default' : 'destructive'}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {item.status === 'SUCCESS' ? '성공' : '실패'}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(item.createdAt).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {item.generatedSql && (
                            <pre className="text-xs text-muted-foreground mt-1.5 p-1.5 bg-muted rounded truncate font-mono">
                              {item.generatedSql.slice(0, 60)}...
                            </pre>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs gap-1 flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInput(item.naturalQuery);
                            handleSend();
                          }}
                        >
                          <RotateCcw className="h-3 w-3" />
                          재실행
                        </Button>
                        {item.generatedSql && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1 flex-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(item.generatedSql);
                              toast({ title: 'SQL이 복사되었습니다' });
                            }}
                          >
                            <Copy className="h-3 w-3" />
                            SQL 복사
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="border-t p-3">
              <p className="text-xs text-muted-foreground text-center">
                총 {filteredHistory.length}개의 질문
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {shareQueryId && (
        <ShareDialog 
            queryId={shareQueryId} 
            isOpen={!!shareQueryId} 
            onClose={() => setShareQueryId(null)} 
        />
      )}
      
      <FeedbackDialog 
        isOpen={isFeedbackDialogOpen}
        onClose={() => {
            setIsFeedbackDialogOpen(false);
            setFeedbackQueryId(null);
        }}
        onSubmit={async (reason) => {
            if (feedbackQueryId) {
                await handleFeedback(feedbackQueryId, 'NEGATIVE', reason);
            }
        }}
      />

      {/* Destructive SQL Confirmation Dialog */}
      <AlertDialog open={!!pendingDestructiveExec} onOpenChange={(open) => !open && setPendingDestructiveExec(null)}>
        <AlertDialogContent className="border-destructive/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              ⚠️ 위험한 SQL 명령 확인
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>다음 파괴적 명령이 감지되었습니다:</p>
              <div className="flex gap-2 flex-wrap">
                {pendingDestructiveExec?.operations.map((op) => (
                  <Badge key={op} variant="destructive">{op}</Badge>
                ))}
              </div>
              <div className="bg-muted p-3 rounded-md font-mono text-xs max-h-40 overflow-auto">
                {pendingDestructiveExec?.sql}
              </div>
              <p className="text-destructive font-medium">
                이 명령은 데이터나 테이블을 영구적으로 삭제할 수 있습니다. 정말 실행하시겠습니까?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDestructiveExecution}
            >
              실행 확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Partial Failure Recovery Dialog */}
      <AlertDialog open={!!partialFailureInfo} onOpenChange={(open) => !open && setPartialFailureInfo(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-yellow-600 flex items-center gap-2">
              ⚠️ 일부 SQL 문장 실행 실패
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>일부 SQL 문장이 성공하고 일부가 실패했습니다. 성공한 문장만 실행하시겠습니까?</p>
                
                {partialFailureInfo && (
                  <div className="space-y-3 max-h-60 overflow-auto">
                    {/* Failed Statements */}
                    {partialFailureInfo.failedStatements.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-destructive flex items-center gap-2">
                          <XCircle className="h-4 w-4" />
                          실패한 문장 ({partialFailureInfo.failedStatements.length}개)
                        </p>
                        {partialFailureInfo.failedStatements.map((item, idx) => (
                          <div key={idx} className="bg-destructive/10 border border-destructive/30 p-2 rounded-md text-xs">
                            <div className="font-mono text-destructive mb-1">{item.error}</div>
                            <div className="font-mono text-muted-foreground truncate">{item.sql}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Success Statements */}
                    {partialFailureInfo.successStatements.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-green-600 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          실행 가능한 문장 ({partialFailureInfo.successStatements.length}개)
                        </p>
                        {partialFailureInfo.successStatements.map((sql, idx) => (
                          <div key={idx} className="bg-green-500/10 border border-green-500/30 p-2 rounded-md">
                            <div className="font-mono text-xs truncate">{sql}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>전체 취소</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={executeSuccessfulStatementsOnly}
              disabled={!partialFailureInfo?.successStatements.length}
            >
              성공 가능한 {partialFailureInfo?.successStatements.length || 0}개 문장만 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Table Schema Viewer Modal */}
      <TableSchemaViewer
        sql={schemaViewerSql || ''}
        dataSourceId={selectedDataSource}
        dataSourceName={selectedDS?.name}
        open={!!schemaViewerSql}
        onOpenChange={(open) => !open && setSchemaViewerSql(null)}
      />

      {/* AI Simulation Dialog */}
      <SimulationDialog
        open={!!simulationInfo}
        onOpenChange={(open) => !open && setSimulationInfo(null)}
        dataSourceId={selectedDataSource}
        question={simulationInfo?.question || ''}
      />
      
      <SampleQueryDialog 
           open={isSampleQueryDialogOpen} 
           onOpenChange={setIsSampleQueryDialogOpen} 
           id={selectedSampleQueryId}
           onUseQuery={(sql) => {
               setIsSampleQueryDialogOpen(false);
           }} 
        />
    </MainLayout>
    </TooltipProvider>
  );
}

export default function QueryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <QueryPageContent />
    </Suspense>
  );
}
