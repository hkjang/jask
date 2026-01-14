'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, AlertTriangle, HelpCircle, Activity, Shield, Zap, BarChart3, Pencil, Undo } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { MainLayout } from '@/components/layout/main-layout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";


import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

export default function AdminEvolutionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Existing Queries
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['evolutionCandidates'],
    queryFn: () => api.getEvolutionCandidates(),
  });

  const { data: stats } = useQuery({
    queryKey: ['evolutionStats'],
    queryFn: () => api.getEvolutionStats(),
  });

  // New Queries for Policies
  const { data: policyLogs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ['policyLogs'],
    queryFn: () => api.getPolicyLogs(),
  });

  const { data: policyRules = [] } = useQuery({
    queryKey: ['policyRules'],
    queryFn: () => api.getPolicyRules(),
  });

  const { data: metrics } = useQuery({
    queryKey: ['policyMetrics'],
    queryFn: () => api.getPolicyMetrics(),
    refetchInterval: 30000 // Refresh every 30s
  });

  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      api.handleEvolutionCandidate(id, action),
    onSuccess: (_, variables) => {
      const actionText = variables.action === 'approve' ? '승인' : '거부';
      toast({ title: `후보가 성공적으로 ${actionText}되었습니다.` });
      queryClient.invalidateQueries({ queryKey: ['evolutionCandidates'] });
    },
    onError: () => {
      toast({ title: '작업 실패', variant: 'destructive' });
    },
  });

  const policyCheckMutation = useMutation({
    mutationFn: () => api.runPolicyCheck(),
    onSuccess: () => {
      toast({ title: '정책 검사가 실행되었습니다.' });
      queryClient.invalidateQueries({ queryKey: ['policyLogs'] });
      queryClient.invalidateQueries({ queryKey: ['policyMetrics'] });
    }
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.togglePolicyRule(id, isActive),
    onSuccess: () => {
      toast({ title: '규칙 상태가 변경되었습니다.' });
      queryClient.invalidateQueries({ queryKey: ['policyRules'] });
    }
  });

  const updateTriggerMutation = useMutation({
    mutationFn: ({ id, threshold }: { id: string; threshold: number }) =>
      api.updatePolicyTrigger(id, { threshold }),
    onSuccess: () => {
      toast({ title: '임계값이 업데이트되었습니다.' });
      queryClient.invalidateQueries({ queryKey: ['policyRules'] });
    }
  });

  const revertMutation = useMutation({
    mutationFn: (id: string) => api.revertPolicyLog(id),
    onSuccess: () => {
      toast({ title: '정책 변경이 복구(Revert)되었습니다.' });
      queryClient.invalidateQueries({ queryKey: ['policyLogs'] });
    },
    onError: () => {
      toast({ title: '복구 실패', variant: 'destructive' });
    }
  });

  const handleEditThreshold = (trigger: any) => {
    const newVal = prompt(`'${trigger.name}'의 새 임계값을 입력하세요 (현재: ${trigger.threshold}):`, trigger.threshold.toString());
    if (newVal !== null) {
      const numVal = parseFloat(newVal);
      if (!isNaN(numVal)) {
        updateTriggerMutation.mutate({ id: trigger.id, threshold: numVal });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">AI 진화 관리 (Evolution Control)</h2>
            <p className="text-muted-foreground">자가 개선 후보 검토 및 자동 정책 관리를 수행합니다.</p>
          </div>
          <div className="flex gap-2">
             <Button variant="secondary" onClick={() => policyCheckMutation.mutate()} disabled={policyCheckMutation.isPending}>
                {policyCheckMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
                정책 검사 실행
             </Button>
            <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                도움말
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>AI 진화 관리 가이드</DialogTitle>
                <DialogDescription>
                  AI가 스스로 시스템을 개선하는 과정에 대한 안내입니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 overflow-y-auto max-h-[60vh]">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    진화 후보란?
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    사용자의 질문에 대해 AI의 신뢰도가 낮거나(Low Trust), 답변 수정이 빈번하게 발생하는 경우, 
                    AI는 이를 "개선이 필요한 신호"로 감지합니다. 이 신호를 바탕으로 
                    <strong>메타데이터 수정</strong>이나 <strong>프롬프트 최적화</strong>와 같은 개선안을 자동으로 생성하여 제안합니다.
                  </p>
                </div>
                
                <div className="space-y-2">
                   <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    신뢰 점수 (Trust Score)
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    AI의 답변이 얼마나 정확하고 사용자의 의도에 부합했는지를 나타내는 지표입니다. 
                    사용자의 긍정/부정 피드백, SQL 직접 수정 여부, 재질문 빈도 등을 종합하여 계산됩니다. 
                    신뢰 점수가 낮을수록 개선이 시급함을 의미합니다.
                  </p>
                </div>

                <div className="space-y-2">
                   <h3 className="font-semibold text-lg">자동 정책 조정</h3>
                   <p className="text-sm text-muted-foreground">
                      시스템 상태(오류율, 활용도 등)에 따라 UX나 AI 설정을 자동으로 최적화하는 규칙입니다.
                      관리자는 적용된 정책 로그를 확인할 수 있습니다.
                   </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <Tabs defaultValue="candidates" className="space-y-4">
          <TabsList>
            <TabsTrigger value="candidates">진화 후보 (Candidates)</TabsTrigger>
            <TabsTrigger value="policies">자동 정책 (Auto Policies)</TabsTrigger>
          </TabsList>

          <TabsContent value="candidates" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">대기 중인 후보</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.candidates.pending || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">적용된 개선 사항</CardTitle>
                  <Check className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.candidates.applied || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">평균 신뢰 점수 (7일)</CardTitle>
                  <Badge variant={stats?.trustScore.average > 0.8 ? 'default' : 'secondary'}>
                     {Math.round((stats?.trustScore.average || 0) * 100)}%
                  </Badge>
                </CardHeader>
                <CardContent>
                   <p className="text-xs text-muted-foreground">{stats?.trustScore.sampleSize || 0}개의 신호 분석됨</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4">
              {candidates.length === 0 ? (
                <p className="text-muted-foreground">대기 중인 진화 후보가 없습니다.</p>
              ) : (
                candidates.map((candidate: any) => (
                  <Card key={candidate.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">
                            {candidate.type === 'METADATA' ? '메타데이터 개선 (Metadata)' : '프롬프트 최적화 (Prompt)'}
                          </CardTitle>
                          <Badge variant="outline">{candidate.targetId}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(candidate.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <CardDescription>{candidate.reasoning}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted p-4 rounded-md mb-4 text-sm font-mono">
                        <pre>{JSON.stringify(candidate.proposedChange, null, 2)}</pre>
                      </div>
                      
                      {candidate.impactAnalysis?.evidence && (
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold mb-2">관련 질문 (근거 자료 - Evidence)</h4>
                          <div className="space-y-2">
                             {(candidate.impactAnalysis.evidence as any[]).map((ev, idx) => (
                               <div key={idx} className="flex items-center justify-between text-sm border p-2 rounded bg-background">
                                  <span>{ev.naturalQuery}</span>
                                  <Badge variant="outline">신뢰도: {Math.round(ev.score * 100)}%</Badge>
                               </div>
                             ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          className="gap-1 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => mutation.mutate({ id: candidate.id, action: 'reject' })}
                          disabled={mutation.isPending}
                        >
                          <X className="h-4 w-4" />
                          거부 (Reject)
                        </Button>
                        <Button
                          className="gap-1 bg-green-600 hover:bg-green-700"
                          onClick={() => mutation.mutate({ id: candidate.id, action: 'approve' })}
                          disabled={mutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                          승인 및 적용 (Approve)
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="policies" className="space-y-4">
             <div className="grid gap-4 md:grid-cols-2">
                <Card>
                   <CardHeader>
                      <CardTitle>정책 규칙 구성 (Defined Rules)</CardTitle>
                      <CardDescription>정의된 자동 조정 규칙의 활성 상태를 관리합니다.</CardDescription>
                   </CardHeader>
                   <CardContent>
                      <div className="space-y-4">
                         {policyRules.map((rule: any) => (
                            <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                               <div className="space-y-1">
                                  <div className="font-medium flex items-center gap-2">
                                     {rule.name}
                                     <Badge variant="outline">{rule.area}</Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground flex flex-wrap gap-2 mt-1">
                                     {rule.triggers?.map((t: any) => (
                                        <Badge key={t.id} variant="secondary" className="flex items-center gap-1">
                                           {t.name} {t.operator} {t.threshold}
                                           <button 
                                              onClick={() => handleEditThreshold(t)}
                                              className="ml-1 hover:text-primary transition-colors"
                                              title="임계값 수정"
                                           >
                                              <Pencil className="h-3 w-3" />
                                           </button>
                                        </Badge>
                                     ))}
                                     <span className="self-center">{'->'}</span>
                                     <span className="font-mono self-center">{rule.targetParameter}</span>
                                  </div>
                               </div>
                               <div className="flex items-center gap-2">
                                  <Switch 
                                     checked={rule.isActive}
                                     onCheckedChange={(checked) => toggleRuleMutation.mutate({ id: rule.id, isActive: checked })}
                                     disabled={toggleRuleMutation.isPending}
                                  />
                               </div>
                            </div>
                         ))}
                         {policyRules.length === 0 && <p className="text-muted-foreground text-sm">등록된 규칙이 없습니다.</p>}
                      </div>
                   </CardContent>
                </Card>

                <Card>
                   <CardHeader>
                      <CardTitle>자동 정책 조정 로그 (Adjustment Logs)</CardTitle>
                      <CardDescription>시스템 상태 변화에 따라 자동으로 적용된 정책 변경 이력입니다.</CardDescription>
                   </CardHeader>
                   <CardContent>
                      <div className="rounded-md border max-h-[400px] overflow-auto">
                         <table className="w-full text-sm">
                            <thead>
                               <tr className="border-b bg-muted/50 transition-colors hover:bg-muted/50">
                                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">시간</th>
                                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">규칙</th>
                                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">변경</th>
                                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">액션</th>
                               </tr>
                            </thead>
                            <tbody>
                               {policyLogs.length === 0 ? (
                                  <tr>
                                     <td colSpan={4} className="p-4 text-center text-muted-foreground">적용된 정책 로그가 없습니다.</td>
                                  </tr>
                               ) : (
                                  policyLogs.map((log: any) => (
                                     <tr key={log.id} className="border-b transition-colors hover:bg-muted/50">
                                        <td className="p-4 align-middle">{new Date(log.appliedAt).toLocaleString()}</td>
                                        <td className="p-4 align-middle">
                                           <div className="font-medium">{log.rule?.name}</div>
                                           <div className="text-xs text-muted-foreground">{log.reason}</div>
                                        </td>
                                        <td className="p-4 align-middle font-mono text-xs">
                                            <div className="text-green-600">{JSON.stringify(log.newValue)}</div>
                                            <div className="text-muted-foreground text-[10px] mt-1">Previous: {JSON.stringify(log.previousValue)}</div>
                                         </td>
                                         <td className="p-4 align-middle">
                                           {log.revertedAt ? (
                                              <Badge variant="outline" className="bg-muted text-[10px]">Reverted</Badge>
                                           ) : (
                                              <Button 
                                                 variant="ghost" 
                                                 size="sm" 
                                                 onClick={() => {
                                                    if (confirm('이 정책 변경을 정말로 복구하시겠습니까?')) {
                                                       revertMutation.mutate(log.id);
                                                    }
                                                 }}
                                                 disabled={revertMutation.isPending}
                                                 title="원래 값으로 복구"
                                              >
                                                 <Undo className="h-4 w-4" />
                                              </Button>
                                           )}
                                        </td>
                                     </tr>
                                  ))
                               )}
                            </tbody>
                         </table>
                      </div>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

