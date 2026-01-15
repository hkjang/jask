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
import {
  Settings,
  Server,
  Database,
  Shield,
  Users,
  FileText,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  Zap,
  RefreshCw,
  AlertTriangle,
  Crown,
} from 'lucide-react';
import { useState } from 'react';

interface LLMProvider {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  isActive: boolean;
  isDefault: boolean;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
  _count?: { queries: number };
}

interface PromptTemplate {
  id: string;
  name: string;
  type: string;
  content: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Prompt Template States
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [promptForm, setPromptForm] = useState({
    name: '',
    type: 'SYSTEM',
    content: '',
    variables: '',
    isActive: true,
  });

  const { data: promptTemplates = [], isLoading: promptsLoading } = useQuery({
    queryKey: ['promptTemplates'],
    queryFn: async () => {
        const res: any = await api.getPromptTemplates();
        return res as PromptTemplate[];
    },
  });

  const resetPromptForm = () => {
    setPromptForm({ name: '', type: 'SYSTEM', content: '', variables: '', isActive: true });
    setEditingPrompt(null);
  };

  const promptMutation = useMutation({
    mutationFn: async ({ method, id, data }: { method: 'POST' | 'PUT' | 'DELETE'; id?: string; data?: any }) => {
      if (method === 'DELETE') return api.deletePromptTemplate(id!);
      if (method === 'PUT') return api.updatePromptTemplate(id!, data);
      return api.createPromptTemplate(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['promptTemplates'] });
      const action = variables.method === 'POST' ? '생성' : variables.method === 'PUT' ? '수정' : '삭제';
      toast({ title: `프롬프트 템플릿이 ${action}되었습니다` });
      setIsPromptDialogOpen(false);
      resetPromptForm();
    },
     onError: () => toast({ title: '작업 실패', variant: 'destructive' }),
  });

  // Dialog States
  const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [providerForm, setProviderForm] = useState({
    name: '',
    baseUrl: '',
    model: '',
    apiKey: '',
    isActive: true,
    isDefault: false,
  });

  const [isSettingDialogOpen, setIsSettingDialogOpen] = useState(false);
  const [settingForm, setSettingForm] = useState({ key: '', value: '', description: '' });
  const [editingSettingKey, setEditingSettingKey] = useState<string | null>(null);

  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);

  // Fetch data
  const { data: settings = {}, isLoading: settingsLoading } = useQuery({
    queryKey: ['adminSettings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${api.getToken()}` },
      });
      return response.json() as Promise<Record<string, any>>;
    },
  });

  const { data: llmProviders = [], isLoading: providersLoading } = useQuery({
    queryKey: ['llmProviders'],
    queryFn: async () => {
         const res: any = await api.getLLMProviders();
         return res as LLMProvider[];
    },
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
       const res: any = await api.getUsers(1, 50);
       return res;
    },
  });

  // LLM Provider Mutations
  const providerMutation = useMutation({
    mutationFn: async ({ method, id, data }: { method: 'POST' | 'PUT' | 'DELETE'; id?: string; data?: any }) => {
      const url = id ? `/api/admin/llm-providers/${id}` : '/api/admin/llm-providers';
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api.getToken()}`,
        },
        body: method !== 'DELETE' ? JSON.stringify(data) : undefined,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['llmProviders'] });
      const action = variables.method === 'POST' ? '생성' : variables.method === 'PUT' ? '수정' : '삭제';
      toast({ title: `LLM 프로바이더가 ${action}되었습니다` });
      setIsProviderDialogOpen(false);
      resetProviderForm();
    },
    onError: () => toast({ title: '작업 실패', variant: 'destructive' }),
  });

  // Test LLM Provider
  const testProviderMutation = useMutation({
    mutationFn: async (provider: LLMProvider) => {
      setTestingProviderId(provider.id);
      const response = await fetch(`${provider.baseUrl}/api/tags`, { method: 'GET' });
      if (!response.ok) throw new Error('Connection failed');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: '연결 성공', description: 'LLM 서버에 정상 연결되었습니다.' });
      setTestingProviderId(null);
    },
    onError: () => {
      toast({ title: '연결 실패', description: '서버에 연결할 수 없습니다.', variant: 'destructive' });
      setTestingProviderId(null);
    },
  });

  // Setting Mutation
  const settingMutation = useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: any; description?: string }) => {
      const response = await fetch(`/api/admin/settings/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify({ value, description }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
      toast({ title: '설정이 저장되었습니다' });
      setIsSettingDialogOpen(false);
      setSettingForm({ key: '', value: '', description: '' });
      setEditingSettingKey(null);
    },
  });

  // User Mutations
  const userMutation = useMutation({
    mutationFn: async ({ userId, action, data }: { userId: string; action: 'role' | 'toggle'; data?: any }) => {
      const endpoint = action === 'role' ? `/api/admin/users/${userId}/role` : `/api/admin/users/${userId}/toggle-active`;
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify(data || {}),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      toast({ title: '사용자 정보가 업데이트되었습니다' });
    },
  });

  const resetProviderForm = () => {
    setProviderForm({ name: '', baseUrl: '', model: '', apiKey: '', isActive: true, isDefault: false });
    setEditingProvider(null);
  };

  const openEditProvider = (provider: LLMProvider) => {
    setEditingProvider(provider);
    setProviderForm({
      name: provider.name,
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKey: provider.apiKey || '',
      isActive: provider.isActive,
      isDefault: provider.isDefault,
    });
    setIsProviderDialogOpen(true);
  };

  const openEditSetting = (key: string, value: any) => {
    setEditingSettingKey(key);
    setSettingForm({
      key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      description: '',
    });
    setIsSettingDialogOpen(true);
  };

  const handleProviderSubmit = () => {
    if (editingProvider) {
      providerMutation.mutate({ method: 'PUT', id: editingProvider.id, data: providerForm });
    } else {
      providerMutation.mutate({ method: 'POST', data: providerForm });
    }
  };

  const handleSettingSubmit = () => {
    let parsedValue: any = settingForm.value;
    try { parsedValue = JSON.parse(settingForm.value); } catch {}
    settingMutation.mutate({ key: settingForm.key, value: parsedValue, description: settingForm.description });
  };

  const settingsArray = Object.entries(settings).map(([key, value]) => ({ key, value }));
  const users: User[] = usersData?.items || [];

  return (
    <MainLayout>
      <div className="container max-w-6xl py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            시스템 설정
          </h1>
          <p className="text-muted-foreground">서비스 전반의 설정을 관리합니다</p>
        </div>

        <Tabs defaultValue="llm" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="llm" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              LLM
            </TabsTrigger>
            <TabsTrigger value="prompts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              프롬프트
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              설정
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              사용자
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              보안
            </TabsTrigger>
          </TabsList>

          {/* LLM Providers Tab */}
          <TabsContent value="llm" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">LLM 프로바이더</h2>
                <p className="text-sm text-muted-foreground">AI 모델 연결을 관리합니다</p>
              </div>
              <Dialog open={isProviderDialogOpen} onOpenChange={(open) => {
                setIsProviderDialogOpen(open);
                if (!open) resetProviderForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    프로바이더 추가
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>{editingProvider ? 'LLM 프로바이더 수정' : '새 LLM 프로바이더'}</DialogTitle>
                    <DialogDescription>AI 모델 서버 연결 정보를 입력하세요</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">프로바이더 이름</label>
                        <Input
                          value={providerForm.name}
                          onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                          placeholder="ollama"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">모델</label>
                        <Input
                          value={providerForm.model}
                          onChange={(e) => setProviderForm({ ...providerForm, model: e.target.value })}
                          placeholder="codellama:7b"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Base URL</label>
                      <Input
                        value={providerForm.baseUrl}
                        onChange={(e) => setProviderForm({ ...providerForm, baseUrl: e.target.value })}
                        placeholder="http://localhost:11434"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">API Key (선택)</label>
                      <Input
                        type="password"
                        value={providerForm.apiKey}
                        onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })}
                        placeholder="OpenAI 호환 API 사용 시 입력"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={providerForm.isActive}
                          onCheckedChange={(checked) => setProviderForm({ ...providerForm, isActive: checked })}
                        />
                        <label className="text-sm">활성화</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={providerForm.isDefault}
                          onCheckedChange={(checked) => setProviderForm({ ...providerForm, isDefault: checked })}
                        />
                        <label className="text-sm">기본 프로바이더</label>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsProviderDialogOpen(false)}>취소</Button>
                    <Button onClick={handleProviderSubmit} disabled={providerMutation.isPending}>
                      {providerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingProvider ? '수정' : '생성'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {providersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4">
                {llmProviders.map((provider: LLMProvider) => (
                  <Card key={provider.id} className={`transition-all ${!provider.isActive ? 'opacity-50' : ''}`}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${provider.isActive ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                          <Zap className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{provider.name}</p>
                            {provider.isDefault && <Badge variant="default">기본</Badge>}
                            {provider.isActive ? (
                              <Badge variant="success">활성</Badge>
                            ) : (
                              <Badge variant="secondary">비활성</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {provider.baseUrl} · <code className="bg-muted px-1 rounded">{provider.model}</code>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testProviderMutation.mutate(provider)}
                          disabled={testingProviderId === provider.id}
                        >
                          {testingProviderId === provider.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="ml-1">테스트</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditProvider(provider)}>
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
                              <AlertDialogTitle>프로바이더 삭제</AlertDialogTitle>
                              <AlertDialogDescription>
                                정말 <strong>{provider.name}</strong> 프로바이더를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => providerMutation.mutate({ method: 'DELETE', id: provider.id })}
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

          {/* Prompt Templates Tab */}
          <TabsContent value="prompts" className="space-y-4">
             <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">프롬프트 템플릿</h2>
                <p className="text-sm text-muted-foreground">시스템 프롬프트 및 템플릿을 관리합니다</p>
              </div>
              <Dialog open={isPromptDialogOpen} onOpenChange={(open) => {
                setIsPromptDialogOpen(open);
                if (!open) resetPromptForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    템플릿 추가
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[700px]">
                  <DialogHeader>
                    <DialogTitle>{editingPrompt ? '템플릿 수정' : '새 템플릿'}</DialogTitle>
                    <DialogDescription>프롬프트 템플릿 내용을 작성하세요</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">템플릿 이름</label>
                        <Input
                          value={promptForm.name}
                          onChange={(e) => setPromptForm({ ...promptForm, name: e.target.value })}
                          placeholder="SQL_GENERATION_PROMPT"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">유형</label>
                        <Input
                          value={promptForm.type}
                          onChange={(e) => setPromptForm({ ...promptForm, type: e.target.value })}
                          placeholder="SYSTEM"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">내용</label>
                      <Textarea
                        value={promptForm.content}
                        onChange={(e) => setPromptForm({ ...promptForm, content: e.target.value })}
                        placeholder="프롬프트 내용을 입력하세요"
                        rows={10}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">변수 (쉼표로 구분)</label>
                      <Input
                        value={promptForm.variables}
                        onChange={(e) => setPromptForm({ ...promptForm, variables: e.target.value })}
                        placeholder="schema,question,dialect"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                        <Switch
                          checked={promptForm.isActive}
                          onCheckedChange={(checked) => setPromptForm({ ...promptForm, isActive: checked })}
                        />
                        <label className="text-sm">활성화</label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPromptDialogOpen(false)}>취소</Button>
                    <Button onClick={() => {
                        const data = {
                            ...promptForm,
                            variables: promptForm.variables.split(',').map(v => v.trim()).filter(Boolean)
                        };
                        if(editingPrompt) {
                            promptMutation.mutate({ method: 'PUT', id: editingPrompt.id, data });
                        } else {
                            promptMutation.mutate({ method: 'POST', data });
                        }
                    }} disabled={promptMutation.isPending}>
                      {promptMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {editingPrompt ? '수정' : '생성'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {promptsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-4">
                  {promptTemplates.map((prompt: PromptTemplate) => (
                      <Card key={prompt.id}>
                          <CardContent className="flex items-center justify-between py-4">
                            <div className="flex items-start gap-4">
                                <div className="mt-1 flex items-center justify-center h-10 w-10 rounded-lg bg-blue-500/10 text-blue-500">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold">{prompt.name}</p>
                                        <Badge variant="outline">{prompt.type}</Badge>
                                        {!prompt.isActive && <Badge variant="secondary">비활성</Badge>}
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2 max-w-[600px]">
                                        {prompt.content}
                                    </p>
                                    <div className="flex gap-2 mt-2">
                                        {prompt.variables.map(v => (
                                            <Badge key={v} variant="secondary" className="text-xs font-mono">{v}</Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                             <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={() => {
                                    setEditingPrompt(prompt);
                                    setPromptForm({
                                        name: prompt.name,
                                        type: prompt.type,
                                        content: prompt.content,
                                        variables: prompt.variables.join(', '),
                                        isActive: prompt.isActive
                                    });
                                    setIsPromptDialogOpen(true);
                                }}>
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
                                      <AlertDialogTitle>템플릿 삭제</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        정말 <strong>{prompt.name}</strong> 템플릿을 삭제하시겠습니까?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>취소</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => promptMutation.mutate({ method: 'DELETE', id: prompt.id })}
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

          {/* System Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">시스템 설정</h2>
                <p className="text-sm text-muted-foreground">서비스 동작 설정을 관리합니다</p>
              </div>
              <Dialog open={isSettingDialogOpen} onOpenChange={(open) => {
                setIsSettingDialogOpen(open);
                if (!open) {
                  setSettingForm({ key: '', value: '', description: '' });
                  setEditingSettingKey(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    설정 추가
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingSettingKey ? '설정 수정' : '새 설정 추가'}</DialogTitle>
                    <DialogDescription>시스템 설정 값을 입력하세요</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">설정 키</label>
                      <Input
                        value={settingForm.key}
                        onChange={(e) => setSettingForm({ ...settingForm, key: e.target.value })}
                        placeholder="setting_key"
                        disabled={!!editingSettingKey}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">값</label>
                      <Input
                        value={settingForm.value}
                        onChange={(e) => setSettingForm({ ...settingForm, value: e.target.value })}
                        placeholder="설정 값"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">설명</label>
                      <Textarea
                        value={settingForm.description}
                        onChange={(e) => setSettingForm({ ...settingForm, description: e.target.value })}
                        placeholder="이 설정에 대한 설명"
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSettingDialogOpen(false)}>취소</Button>
                    <Button onClick={handleSettingSubmit} disabled={settingMutation.isPending}>
                      {settingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      저장
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {settingsArray.map(({ key, value }) => (
                    <div key={key} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium font-mono text-sm">{key}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {typeof value === 'boolean' ? (
                            <Badge variant={value ? 'success' : 'secondary'}>{value ? 'true' : 'false'}</Badge>
                          ) : typeof value === 'number' ? (
                            <span className="font-mono">{value.toLocaleString()}</span>
                          ) : (
                            String(value)
                          )}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => openEditSetting(key, value)}>
                        <Edit2 className="h-4 w-4 mr-1" />
                        수정
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">사용자 관리</h2>
              <p className="text-sm text-muted-foreground">등록된 사용자를 관리합니다</p>
            </div>

            {usersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`flex items-center justify-center h-10 w-10 rounded-full ${user.role === 'ADMIN' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            {user.role === 'ADMIN' ? <Crown className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{user.name}</p>
                              <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>{user.role}</Badge>
                              {!user.isActive && <Badge variant="destructive">비활성</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {user.email} · 쿼리 {user._count?.queries || 0}회
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => userMutation.mutate({
                              userId: user.id,
                              action: 'role',
                              data: { role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' },
                            })}
                          >
                            {user.role === 'ADMIN' ? '일반으로' : '관리자로'}
                          </Button>
                          <Button
                            variant={user.isActive ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => userMutation.mutate({ userId: user.id, action: 'toggle' })}
                          >
                            {user.isActive ? '비활성화' : '활성화'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">보안 설정</h2>
              <p className="text-sm text-muted-foreground">SQL 실행 보안 정책을 관리합니다</p>
            </div>

            <div className="grid gap-4">
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-500/10 text-green-500">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">SELECT 전용 모드</p>
                      <p className="text-sm text-muted-foreground">SELECT 쿼리만 허용하고 데이터 변경 차단</p>
                    </div>
                  </div>
                  <Switch 
                    checked={settings['security.select_only'] === true} 
                    onCheckedChange={(checked) => settingMutation.mutate({
                        key: 'security.select_only',
                        value: checked,
                        description: 'SELECT 쿼리만 허용'
                    })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-yellow-500/10 text-yellow-500">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">위험 키워드 차단</p>
                      <p className="text-sm text-muted-foreground">DELETE, DROP, TRUNCATE, ALTER 등 위험 명령 차단</p>
                    </div>
                  </div>
                   <Switch 
                    checked={settings['security.block_dangerous'] !== false} 
                    onCheckedChange={(checked) => settingMutation.mutate({
                        key: 'security.block_dangerous',
                        value: checked,
                        description: '위험 키워드 차단'
                    })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-500/10 text-blue-500">
                      <Database className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">LIMIT 강제</p>
                      <p className="text-sm text-muted-foreground">모든 쿼리에 LIMIT 절 자동 추가 (최대 1000)</p>
                    </div>
                  </div>
                  <Switch 
                    checked={settings['security.force_limit'] !== false} 
                    onCheckedChange={(checked) => settingMutation.mutate({
                        key: 'security.force_limit',
                        value: checked,
                        description: 'LIMIT 강제 적용'
                    })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-500/10 text-purple-500">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">EXPLAIN 분석</p>
                      <p className="text-sm text-muted-foreground">실행 전 쿼리 성능 분석 및 Full Scan 경고</p>
                    </div>
                  </div>
                  <Switch 
                    checked={settings['security.explain_analysis'] === true} 
                    onCheckedChange={(checked) => settingMutation.mutate({
                        key: 'security.explain_analysis',
                        value: checked,
                        description: 'EXPLAIN 실행 분석'
                    })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-500/10 text-orange-500">
                      <Database className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">DDL 허용 (CREATE/ALTER/DROP)</p>
                      <p className="text-sm text-muted-foreground">테이블 생성, 수정, 삭제 등 DDL 명령 허용</p>
                    </div>
                  </div>
                  <Switch 
                    checked={settings['sql_allow_ddl'] === true} 
                    onCheckedChange={(checked) => settingMutation.mutate({
                        key: 'sql_allow_ddl',
                        value: checked,
                        description: 'DDL 명령(CREATE/ALTER/DROP) 허용'
                    })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-red-500/10 text-red-500">
                      <Edit2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">DML 허용 (INSERT/UPDATE/DELETE)</p>
                      <p className="text-sm text-muted-foreground">데이터 삽입, 수정, 삭제 등 DML 명령 허용</p>
                    </div>
                  </div>
                  <Switch 
                    checked={settings['sql_allow_writes'] === true} 
                    onCheckedChange={(checked) => settingMutation.mutate({
                        key: 'sql_allow_writes',
                        value: checked,
                        description: 'DML 명령(INSERT/UPDATE/DELETE) 허용'
                    })}
                  />
                </CardContent>
              </Card>

              <Card className="border-destructive/50">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-destructive/10 text-destructive">
                      <Trash2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-destructive">파괴적 명령 허용 (DROP/TRUNCATE/DELETE)</p>
                      <p className="text-sm text-muted-foreground">⚠️ 데이터나 테이블을 삭제하는 위험한 명령 허용 (실행 전 확인 필요)</p>
                    </div>
                  </div>
                  <Switch 
                    checked={settings['sql_allow_destructive'] === true} 
                    onCheckedChange={(checked) => settingMutation.mutate({
                        key: 'sql_allow_destructive',
                        value: checked,
                        description: '파괴적 명령(DROP/TRUNCATE/DELETE) 허용'
                    })}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
