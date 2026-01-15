"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  Check, 
  Database, 
  Brain, 
  FileText, 
  Shield, 
  Clock,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { api } from "@/lib/api";

interface SimulationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dataSourceId: string;
  question: string;
}

interface SimulationStep {
  step: number;
  name: string;
  status: 'pending' | 'running' | 'done' | 'error';
  timeMs?: number;
  data?: any;
  error?: string;
}

function StepCard({ step, isExpanded, onToggle }: { step: SimulationStep; isExpanded: boolean; onToggle: () => void }) {
  const stepNames: Record<string, string> = {
    embedding: '임베딩 & 스키마 검색',
    prompt: '프롬프트 구성',
    generation: 'AI 응답 생성',
    extraction: 'SQL 추출',
    validation: '검증 & 분석'
  };

  const stepIcons: Record<string, any> = {
    embedding: Database,
    prompt: FileText,
    generation: Brain,
    extraction: FileText,
    validation: Shield
  };

  const Icon = stepIcons[step.name] || Database;

  const statusColors = {
    pending: 'bg-gray-200 text-gray-500',
    running: 'bg-blue-100 text-blue-600 animate-pulse',
    done: 'bg-green-100 text-green-600',
    error: 'bg-red-100 text-red-600'
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${statusColors[step.status]}`}>
          {step.status === 'running' ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : step.status === 'done' ? (
            <Check className="h-3 w-3" />
          ) : (
            step.step
          )}
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 font-medium text-sm">{stepNames[step.name] || step.name}</span>
        {step.timeMs !== undefined && (
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {step.timeMs}ms
          </Badge>
        )}
        {step.data && (
          isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {isExpanded && step.data && (
        <div className="p-3 border-t bg-muted/30 text-xs space-y-2">
          {/* Embedding Step */}
          {step.name === 'embedding' && step.data && (
            <>
              {step.data.embedding && (
                <div className="flex gap-4">
                  <span className="text-muted-foreground">임베딩 차원:</span>
                  <span className="font-mono">{step.data.embedding.dimensions}</span>
                  <span className="text-muted-foreground ml-4">소요 시간:</span>
                  <span className="font-mono">{step.data.embedding.timeMs}ms</span>
                </div>
              )}
              {step.data.search?.selectedTables && (
                <div className="mt-2">
                  <div className="text-muted-foreground mb-1">선택된 테이블 ({step.data.search.selectedTables.length}개):</div>
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {step.data.search.selectedTables.map((t: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-1 bg-white rounded">
                        <span className="font-mono text-primary">{t.schemaName}.{t.tableName}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {(t.similarity * 100).toFixed(1)}%
                        </Badge>
                        {t.description && (
                          <span className="text-muted-foreground truncate">{t.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Prompt Step */}
          {step.name === 'prompt' && step.data && (
            <>
              <div className="flex gap-4 mb-2">
                <span className="text-muted-foreground">전체 프롬프트 길이:</span>
                <span className="font-mono">{step.data.fullPromptLength?.toLocaleString()} 자</span>
              </div>
              <div className="text-muted-foreground mb-1">시스템 프롬프트 (미리보기):</div>
              <pre className="p-2 bg-slate-900 text-slate-100 rounded text-[10px] leading-tight overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                {step.data.systemPrompt}
              </pre>
            </>
          )}

          {/* Generation Step */}
          {step.name === 'generation' && step.data && (
            <>
              <div className="flex gap-4">
                <span className="text-muted-foreground">응답 길이:</span>
                <span className="font-mono">{step.data.rawResponseLength} 자</span>
                <span className="text-muted-foreground ml-4">추론 포함:</span>
                <span className="font-mono">{step.data.hasReasoning ? '예' : '아니오'}</span>
              </div>
              {step.data.hasReasoning && step.data.reasoning && (
                <div className="mt-2">
                  <div className="text-muted-foreground mb-1">AI 추론 과정:</div>
                  <pre className="p-2 bg-amber-50 border border-amber-200 rounded text-[10px] leading-tight overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap text-amber-900">
                    {step.data.reasoning}
                  </pre>
                </div>
              )}
            </>
          )}

          {/* Extraction Step */}
          {step.name === 'extraction' && step.data?.extractedSql && (
            <div>
              <div className="text-muted-foreground mb-1">추출된 SQL:</div>
              <pre className="p-2 bg-slate-900 text-green-400 font-mono rounded text-[10px] leading-tight overflow-x-auto max-h-40">
                {step.data.extractedSql}
              </pre>
            </div>
          )}

          {/* Validation Step */}
          {step.name === 'validation' && step.data && (
            <>
              <div className="flex gap-4 flex-wrap">
                <div>
                  <span className="text-muted-foreground">유효성:</span>
                  <Badge variant={step.data.isValid ? "default" : "destructive"} className="ml-2">
                    {step.data.isValid ? '통과' : '실패'}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">위험도:</span>
                  <Badge variant={step.data.riskLevel === 'LOW' ? 'outline' : 'destructive'} className="ml-2">
                    {step.data.riskLevel}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">신뢰도:</span>
                  <span className="ml-2 font-bold">{step.data.trustScore}%</span>
                </div>
              </div>
              {step.data.errors?.length > 0 && (
                <div className="mt-2 p-2 bg-red-50 text-red-600 rounded">
                  {step.data.errors.join(', ')}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SimulationDialog({ open, onOpenChange, dataSourceId, question }: SimulationDialogProps) {
  const [simulation, setSimulation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && dataSourceId && question) {
      runSimulation();
    }
  }, [open, dataSourceId, question]);

  const runSimulation = async () => {
    setLoading(true);
    setSimulation(null);
    setExpandedSteps(new Set());
    try {
      const res = await api.simulateQuery(dataSourceId, question);
      setSimulation(res);
      if (res.steps) {
        setExpandedSteps(new Set([1, 2]));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleStep = (step: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(step)) {
        next.delete(step);
      } else {
        next.add(step);
      }
      return next;
    });
  };

  const copySql = () => {
    if (simulation?.result?.sql) {
      navigator.clipboard.writeText(simulation.result.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI 생성 시뮬레이션
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between">
            <span className="truncate">{question}</span>
            {simulation && (
              <Badge variant="outline" className="ml-2 shrink-0">
                {simulation.totalTimeMs}ms
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-3 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">시뮬레이션 중...</span>
            </div>
          )}

          {simulation && !loading && (
            <>
              {/* Summary Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={simulation.success ? 'default' : 'destructive'}>
                    {simulation.success ? '성공' : '실패'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    총 {simulation.totalTimeMs}ms
                  </span>
                </div>
                <div className="flex gap-2">
                  {simulation.result?.sql && (
                    <Button variant="outline" size="sm" onClick={copySql} className="h-7">
                      {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      SQL 복사
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={runSimulation} className="h-7">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    다시 실행
                  </Button>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-2">
                {simulation.steps?.map((step: SimulationStep) => (
                  <StepCard
                    key={step.step}
                    step={step}
                    isExpanded={expandedSteps.has(step.step)}
                    onToggle={() => toggleStep(step.step)}
                  />
                ))}
              </div>

              {/* Final SQL Card */}
              {simulation.result?.sql && (
                <div className="p-3 border rounded-lg bg-slate-900">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-green-400">최종 SQL</span>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-300">
                        {simulation.result.riskLevel}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-300">
                        신뢰도 {simulation.result.trustScore}%
                      </Badge>
                    </div>
                  </div>
                  <pre className="text-green-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                    {simulation.result.sql}
                  </pre>
                </div>
              )}

              {simulation.error && (
                <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                  오류: {simulation.error}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
