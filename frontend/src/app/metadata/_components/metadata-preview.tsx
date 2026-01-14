"use client";

import { Button } from "@/components/ui/button";
import { Sparkles, Play, RefreshCw, MessageSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MetadataPreviewProps {
  dataSourceId: string;
  context: string;
}

export function MetadataPreview({ dataSourceId, context }: MetadataPreviewProps) {
  const [query, setQuery] = useState("");
  const [generation, setGeneration] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("context");

  const handleSimulate = async () => {
    if (!query.trim() || !dataSourceId) return;
    setLoading(true);
    setGeneration(null);
    try {
        // Use generateQuery. Ideally we should have a simulation endpoint that doesn't save history,
        // or we mark it as test. For now using standard generation.
        const res = await api.generateQuery(dataSourceId, query);
        setGeneration(res);
        setActiveTab("simulation");
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="w-96 border-l bg-slate-50 flex flex-col h-full shadow-inner">
      <div className="p-4 border-b bg-white">
        <h2 className="font-semibold flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" /> AI 미리보기
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          AI가 메타데이터를 어떻게 해석하는지 확인하세요.
        </p>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-2 border-b bg-muted/10">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full">
                    <TabsTrigger value="context" className="flex-1">컨텍스트</TabsTrigger>
                    <TabsTrigger value="simulation" className="flex-1">시뮬레이션</TabsTrigger>
                </TabsList>
            </Tabs>
        </div>

        {activeTab === 'context' && (
            <div className="flex-1 overflow-auto p-4 font-mono text-[10px] text-muted-foreground whitespace-pre-wrap leading-tight bg-slate-50">
                {context ? context : "컨텍스트를 보려면 데이터 소스를 선택하세요..."}
            </div>
        )}

        {activeTab === 'simulation' && (
            <div className="flex-1 overflow-auto p-4 space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-semibold">테스트 질문</label>
                    <Textarea 
                        placeholder="예: 활성 사용자 찾기..." 
                        className="text-xs min-h-[60px]"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)} 
                    />
                    <Button 
                        size="sm" 
                        className="w-full" 
                        onClick={handleSimulate} 
                        disabled={loading || !dataSourceId}
                    >
                        {loading ? <RefreshCw className="h-3 w-3 mr-2 animate-spin" /> : <Play className="h-3 w-3 mr-2" />}
                        생성 시뮬레이션
                    </Button>
                </div>

                {generation && (
                    <div className="space-y-4 pt-4 border-t">
                        <div>
                            <span className="text-xs font-semibold text-green-600">생성된 SQL</span>
                            <div className="mt-1 p-2 bg-slate-900 text-green-400 font-mono text-xs rounded overflow-x-auto">
                                {generation.generatedSql}
                            </div>
                        </div>
                        {generation.sqlExplanation && (
                            <div>
                                <span className="text-xs font-semibold">설명</span>
                                <p className="text-xs text-muted-foreground mt-1 bg-white p-2 rounded border">
                                    {generation.sqlExplanation}
                                </p>
                            </div>
                        )}
                        {generation.errorMessage && (
                            <div className="text-xs text-red-500 bg-red-50 p-2 rounded">
                                오류: {generation.errorMessage}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}
