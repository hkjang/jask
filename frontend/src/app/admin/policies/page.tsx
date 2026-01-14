'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, Edit, ShieldAlert, BookOpen, Code } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { api } from '@/lib/api';

// Types (should be in a shared type file but defining here for now)
type PolicyType = 'QUERY' | 'SQL' | 'METADATA' | 'MODEL' | 'DOMAIN';

interface Policy {
  id: string;
  name: string;
  type: PolicyType;
  description?: string;
  config: any;
  isActive: boolean;
  priority: number;
}

const POLICY_CONFIG_EXAMPLES: Record<PolicyType, string> = {
  SQL: '{\n  "maxJoins": 3,\n  "forbiddenKeywords": ["DROP", "TRUNCATE"]\n}',
  QUERY: '{\n  "blockedTerms": ["salary", "resident_id"],\n  "maxLength": 100\n}',
  METADATA: '{\n  "restrictedTables": ["audit_logs", "users"],\n  "restrictedColumns": ["ssn", "password"]\n}',
  MODEL: '{\n  "maxTokens": 1000,\n  "temperature": 0.7\n}',
  DOMAIN: '{\n  "allowedDomains": ["finance", "hr"]\n}'
};

const POLICY_CONFIG_DESCRIPTIONS: Record<PolicyType, string> = {
    SQL: 'SQL 생성 시 제약 조건을 설정합니다.',
    QUERY: '사용자 질문 입력 시 필터링 규칙을 설정합니다.',
    METADATA: '접근이 제한된 테이블이나 컬럼을 지정합니다.',
    MODEL: 'LLM 모델의 파라미터 제한을 설정합니다.',
    DOMAIN: '특정 비즈니스 도메인에 대한 규칙을 설정합니다.'
};

export default function PoliciesPage() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    type: PolicyType;
    description: string;
    config: string; // JSON string
    isActive: boolean;
    priority: number;
  }>({
    name: '',
    type: 'SQL',
    description: '',
    config: POLICY_CONFIG_EXAMPLES['SQL'],
    isActive: true,
    priority: 0,
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const data = await api.getPolicies();
      setPolicies(data);
    } catch (error) {
      console.error('Failed to fetch policies', error);
      toast({
        title: '정책 목록을 불러오지 못했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      let parsedConfig;
      try {
        parsedConfig = JSON.parse(formData.config);
      } catch (e) {
        toast({
          title: 'Config JSON 형식이 올바르지 않습니다.',
          variant: 'destructive',
        });
        return;
      }

      const payload = {
        ...formData,
        config: parsedConfig,
        priority: Number(formData.priority),
      };

      if (editingPolicy) {
        await api.updatePolicy(editingPolicy.id, payload);
      } else {
        await api.createPolicy(payload);
      }

      toast({
        title: editingPolicy ? '정책이 수정되었습니다.' : '새 정책이 생성되었습니다.',
      });
      setIsDialogOpen(false);
      setEditingPolicy(null);
      fetchPolicies();
    } catch (error) {
      toast({
        title: '저장에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
      await api.deletePolicy(id);
      toast({
        title: '정책이 삭제되었습니다.',
      });
      fetchPolicies();
    } catch (error) {
      toast({
        title: '삭제 실패',
        variant: 'destructive',
      });
    }
  };

  const openEdit = (policy: Policy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      type: policy.type,
      description: policy.description || '',
      config: JSON.stringify(policy.config, null, 2),
      isActive: policy.isActive,
      priority: policy.priority,
    });
    setIsDialogOpen(true);
  };

  const openCreate = () => {
    setEditingPolicy(null);
    setFormData({
      name: '',
      type: 'SQL',
      description: '',
      config: POLICY_CONFIG_EXAMPLES['SQL'],
      isActive: true,
      priority: 0,
    });
    setIsDialogOpen(true);
  };

  const handleTypeChange = (val: PolicyType) => {
      // If creating a new policy, automatically switch the config template
      // If editing, keep existing config unless user wants to reset (implementation choice: just switch for new, keep for edit)
      if (!editingPolicy) {
          setFormData({ ...formData, type: val, config: POLICY_CONFIG_EXAMPLES[val] });
      } else {
          setFormData({ ...formData, type: val });
      }
  };

  return (
    <MainLayout>
      <div className="space-y-6 max-h-screen overflow-auto p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">정책 및 거버넌스</h2>
            <p className="text-muted-foreground">
              NL2SQL 엔진의 동작 정책과 위험 제어를 관리합니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsGuideOpen(true)}>
              <BookOpen className="mr-2 h-4 w-4" /> 이용 가이드
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> 정책 추가
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>활성 정책 목록</CardTitle>
            <CardDescription>
              현재 적용 중인 거버넌스 정책 목록입니다. 높은 우선순위(Priority) 정책이 먼저 검사됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>우선순위</TableHead>
                    <TableHead>정책명</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>설정 요약</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.length === 0 ? (
                      <TableRow>
                          <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                              등록된 정책이 없습니다.
                          </TableCell>
                      </TableRow>
                  ) : (
                      policies.map((policy) => (
                      <TableRow key={policy.id}>
                          <TableCell>
                              <Badge variant="outline">{policy.priority}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                  <ShieldAlert className="h-4 w-4 text-blue-500" />
                                  {policy.name}
                              </div>
                              {policy.description && <div className="text-xs text-muted-foreground mt-1">{policy.description}</div>}
                          </TableCell>
                          <TableCell>
                              <Badge variant="secondary">{policy.type}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate font-mono text-xs">
                              {JSON.stringify(policy.config)}
                          </TableCell>
                          <TableCell>
                              <Switch checked={policy.isActive} disabled />
                          </TableCell>
                          <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(policy)}>
                              <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(policy.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                          </TableCell>
                      </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Policy Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingPolicy ? '정책 수정' : '새 정책 생성'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">정책명</Label>
                <Input
                  className="col-span-3"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">유형</Label>
                <Select
                  value={formData.type}
                  onValueChange={handleTypeChange}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SQL">SQL Logic</SelectItem>
                    <SelectItem value="QUERY">User Query (Keyword)</SelectItem>
                    <SelectItem value="METADATA">Metadata Access</SelectItem>
                    <SelectItem value="MODEL">Model Config</SelectItem>
                    <SelectItem value="DOMAIN">Domain Specific</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">우선순위</Label>
                <Input
                  type="number"
                  className="col-span-3"
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: Number(e.target.value)})}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">상태</Label>
                <div className="col-span-3 flex items-center gap-2">
                    <Switch
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData({...formData, isActive: checked})}
                    />
                    <span className="text-sm text-muted-foreground">{formData.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <Label className="text-right mt-2">설명</Label>
                <Textarea
                  className="col-span-3"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-4 gap-4">
                <Label className="text-right mt-2">설정 (JSON)</Label>
                <div className="col-span-3">
                  <Textarea
                      className="font-mono text-xs min-h-[150px]"
                      value={formData.config}
                      onChange={(e) => setFormData({...formData, config: e.target.value})}
                  />
                  <div className="text-xs text-muted-foreground mt-2 bg-muted p-2 rounded border">
                      <p className="font-semibold mb-1">추천 설정 ({formData.type}):</p>
                      <pre className="whitespace-pre-wrap font-mono">
                          {POLICY_CONFIG_EXAMPLES[formData.type]}
                      </pre>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>취소</Button>
              <Button onClick={handleSubmit}>저장</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* How it Works / Guide Dialog */}
        <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>정책 관리 가이드</DialogTitle>
              <DialogDescription>
                NL2SQL 엔진의 품질과 안전성을 보장하기 위해 다양한 정책을 설정할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-2 text-sm">
              <div className="grid gap-4">
                <div className="bg-muted/50 p-4 rounded-md border">
                    <h4 className="font-semibold text-base mb-2">설정 가이드 (Configuration Examples)</h4>
                    <div className="space-y-4">
                        {Object.entries(POLICY_CONFIG_EXAMPLES).map(([type, example]) => (
                            <div key={type} className="grid grid-cols-1 md:grid-cols-4 gap-2 border-b last:border-0 pb-3 last:pb-0">
                                <div className="md:col-span-1">
                                    <Badge variant="outline" className="mb-1">{type}</Badge>
                                    <p className="text-xs text-muted-foreground">{POLICY_CONFIG_DESCRIPTIONS[type as PolicyType]}</p>
                                </div>
                                <div className="md:col-span-3">
                                    <pre className="bg-background border p-2 rounded text-xs overflow-x-auto">
                                        {example}
                                    </pre>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid gap-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" /> 정책 상세 설명
                  </h4>
                  <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                    <li><span className="font-semibold">SQL Logic</span>: 조인 횟수 제한, 특정 구문 금지 등 SQL 생성 엔진의 행동을 제어합니다.</li>
                    <li><span className="font-semibold">User Query</span>: 사용자 입력 단계에서 금지어 포함 여부를 검사하여 쿼리 생성을 조기에 차단합니다.</li>
                    <li><span className="font-semibold">Metadata Access</span>: LLM에게 보여주지 말아야 할 민감한 테이블이나 컬럼 정보를 필터링합니다.</li>
                  </ul>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-md">
                  <h4 className="font-medium mb-1 text-blue-700 dark:text-blue-300">💡 우선순위 (Priority) 규칙</h4>
                  <p className="text-muted-foreground">
                    정책은 우선순위 숫자가 <span className="font-bold text-foreground">높은 순서대로</span> 적용됩니다. 
                    예를 들어, <code>Priority: 10</code> 정책이 <code>Priority: 1</code> 정책보다 먼저 평가되며, 상충되는 내용이 있을 경우 높은 우선순위의 설정이 우선합니다.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setIsGuideOpen(false)}>확인</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
