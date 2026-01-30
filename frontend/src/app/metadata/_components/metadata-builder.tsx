"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Layout, Save, Info, Plus, Columns, Network, Tag,
  Trash2, SlidersHorizontal, AlertCircle, Table as TableIcon, Eye, EyeOff, Code, ListTree
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

import { CodeValueManager } from "./code-value-manager";
import { RelationshipManager } from "./relationship-manager";
import { IndexManager } from "./index-manager";
import { MetadataQualityScore } from "./metadata-quality-score";
import { DataPreview } from "./data-preview";
import { ExcelImportExport } from "./excel-import-export";

interface MetadataBuilderProps {
  table: any;
  onUpdate: () => void;
}

export function MetadataBuilder({ table, onUpdate }: MetadataBuilderProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [formData, setFormData] = useState<any>({});
  const [columns, setColumns] = useState<any[]>([]);
  const [scoreData, setScoreData] = useState<any>({ score: 0, status: 'DRAFT', details: {} });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (table) {
      setFormData({
        description: table.description || "",
        tags: table.tags || [],
        importanceLevel: table.importanceLevel || "MEDIUM",
        isSyncedWithAI: table.isSyncedWithAI,
        isExcluded: table.isExcluded,
        reviewNotes: table.reviewNotes
      });
      setColumns(table.columns || []);
      setScoreData({
          score: table.completenessScore || 0,
          status: table.metadataStatus || 'DRAFT',
          details: {} // Can't reconstruct details easily without recalc, but score is enough
      });
    }
  }, [table]);

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    try {
        const res: any = await api.post(`/metadata/tables/${table.id}/ai-draft`, {});
        
        // Update local state with generated data
        if (res.description) {
            setFormData((prev: any) => ({ ...prev, description: res.description }));
        }
        
        if (res.columns) {
            setColumns((prev: any) => prev.map((col: any) => {
               const gen = res.columns[col.columnName];
               if (gen) {
                   return {
                       ...col,
                       semanticName: gen.semanticName || col.semanticName,
                       description: gen.description || col.description,
                       unit: gen.unit || col.unit,
                       sensitivityLevel: gen.sensitivity || col.sensitivityLevel
                   };
               }
               return col;
            }));
        }

        toast({ title: "초안 생성됨", description: "제안된 메타데이터를 검토해주세요." });
    } catch(e) {
        console.error(e);
        toast({ title: "오류", description: "초안 생성 실패", variant: "destructive" });
    } finally {
        setIsGenerating(false);
    }
  };

  const handleSaveTable = async () => {
    try {
      await api.updateTableExtendedMetadata(table.id, formData);
      toast({ title: "저장됨", description: "테이블 메타데이터가 업데이트되었습니다." });
      onUpdate();
    } catch (e) {
      toast({ title: "오류", description: "테이블 메타데이터 저장 실패", variant: "destructive" });
    }
  };

  const handleColumnChange = (id: string, field: string, value: any) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    // Auto-save or wait for explicit save? Explicit save for bulk is better, but individual row save works too.
    // Ideally we track dirty state.
    // For simplicity, let's implement instant save on blur/change for extended fields or a "Save Columns" button.
    // "Save Columns" button is safer.
  };

  const handleSaveColumns = async () => {
    try {
        // Bulk update or individual? API is individual.
        // Parallel requests.
        const promises = columns.map(col => {
            // Only send extended fields to save bandwidth if possible, but API takes DTO.
            return api.updateColumnExtendedMetadata(col.id, {
                description: col.description,
                semanticName: col.semanticName,
                unit: col.unit,
                isCode: col.isCode,
                sensitivityLevel: col.sensitivityLevel,
                isExcluded: col.isExcluded
            });
        });
        await Promise.all(promises);
        toast({ title: "저장됨", description: "컬럼이 성공적으로 업데이트되었습니다." });
        onUpdate();
    } catch (e) {
        console.error(e);
      toast({ title: "오류", description: "컬럼 저장 실패", variant: "destructive" });
    }
  };

  const handleToggleColumnExcluded = async (col: any) => {
    const newState = !col.isExcluded;
    try {
      await api.setColumnExcluded(col.id, newState);
      setColumns(prev => prev.map(c => c.id === col.id ? { ...c, isExcluded: newState } : c));
      toast({ title: newState ? "컬럼 제외됨" : "컬럼 포함됨", description: `${col.columnName} 컬럼이 ${newState ? 'AI 컨텍스트에서 제외' : 'AI 컨텍스트에 포함'}되었습니다.` });
    } catch (e) {
      toast({ title: "오류", description: "컬럼 상태 변경 실패", variant: "destructive" });
    }
  };

  const handleDeleteColumn = async (col: any) => {
    console.log('[DEBUG] handleDeleteColumn called with col:', col);
    if (!confirm(`"${col.columnName}" 컬럼을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      console.log('[DEBUG] Calling api.deleteColumn with id:', col.id);
      await api.deleteColumn(col.id);
      console.log('[DEBUG] Column deleted successfully');
      setColumns(prev => prev.filter(c => c.id !== col.id));
      toast({ title: "삭제됨", description: `${col.columnName} 컬럼이 삭제되었습니다.` });
      onUpdate();
    } catch (e) {
      console.error('[DEBUG] Delete column error:', e);
      toast({ title: "오류", description: "컬럼 삭제 실패", variant: "destructive" });
    }
  };

  const [codeManagerOpen, setCodeManagerOpen] = useState(false);
  const [activeColumnForCodes, setActiveColumnForCodes] = useState<{id: string, name: string} | null>(null);

  const openCodeManager = (col: any) => {
      setActiveColumnForCodes({ id: col.id, name: col.columnName });
      setCodeManagerOpen(true);
  };

  if (!table) return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
      <Layout className="h-16 w-16 mb-4 opacity-20" />
      <p>메타데이터를 편집할 테이블을 선택하세요</p>
    </div>
  );

  return (
    <>
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center bg-card shadow-sm z-10">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            {table.tableType === 'VIEW' ? (
              <Eye className="h-5 w-5 text-blue-500" />
            ) : (
              <Layout className="h-5 w-5 text-primary" />
            )}
            {table.tableName}
            {table.tableType === 'VIEW' && <Badge className="ml-2 bg-blue-100 text-blue-700 border-blue-200">VIEW</Badge>}
            {formData.isExcluded && <Badge variant="destructive" className="ml-2">제외됨</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {table.schemaName} • {table.tableType === 'VIEW' ? 'VIEW' : `${table.rowCount?.toLocaleString() || 0} 행`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={async () => {
             // Re-validate score
             try {
                const res = await api.post(`/metadata/tables/${table.id}/validate`, {});
                setScoreData(res);
                onUpdate();
             } catch(e) {}
          }}>
            점수 새로고침
          </Button>
          <Button size="sm" variant="outline"><Info className="h-4 w-4 mr-1"/> 스키마</Button>
          {(activeTab === 'general') && (
            <Button size="sm" onClick={handleSaveTable}><Save className="h-4 w-4 mr-1" /> 일반 저장</Button>
          )}
           {(activeTab === 'columns') && (
            <Button size="sm" onClick={handleSaveColumns}><Save className="h-4 w-4 mr-1" /> 컬럼 저장</Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
          {/* Score Section */}
          <div className="px-6 pt-6 pb-2">
              <MetadataQualityScore 
                 score={scoreData.score} 
                 status={scoreData.status} 
                 details={scoreData.details}
                 onValidate={async () => {
                     const res = await api.post(`/metadata/tables/${table.id}/validate`, {});
                     setScoreData(res);
                 }}
              />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-2 border-b bg-muted/10">
              <TabsList>
                <TabsTrigger value="general" className="gap-2"><SlidersHorizontal className="h-4 w-4"/> 일반</TabsTrigger>
                <TabsTrigger value="columns" className="gap-2"><Columns className="h-4 w-4"/> 컬럼</TabsTrigger>
                <TabsTrigger value="relationships" className="gap-2"><Network className="h-4 w-4"/> 관계</TabsTrigger>
                <TabsTrigger value="indexes" className="gap-2"><ListTree className="h-4 w-4"/> 인덱스</TabsTrigger>
                <TabsTrigger value="preview" className="gap-2"><TableIcon className="h-4 w-4"/> 데이터 미리보기</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="general" className="flex-1 overflow-auto p-6 space-y-6 mt-0">
              {/* VIEW Definition Card - Only shown for VIEWs */}
              {table.tableType === 'VIEW' && table.viewDefinition && (
                <Card className="p-4 border-blue-200 bg-blue-50/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Code className="h-4 w-4 text-blue-600" />
                    <h3 className="font-semibold text-blue-800">뷰 정의 (View Definition)</h3>
                  </div>
                  <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-md overflow-x-auto max-h-[200px] overflow-y-auto">
                    <code>{table.viewDefinition}</code>
                  </pre>
                </Card>
              )}

              <Card className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg flex items-center gap-2">기본 정보</h3>
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        className="gap-2 text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-200 border"
                        onClick={handleAutoGenerate}
                        disabled={isGenerating}
                    >
                        {isGenerating ? "생성 중..." : <><span className="text-lg">✨</span> AI 자동 채우기 초안</>}
                    </Button>
                </div>
                
                <div className="space-y-2">
                   <Label>설명</Label>
                   <Textarea 
                     className="min-h-[100px]" 
                     placeholder="이 테이블의 목적을 설명하세요..." 
                     value={formData.description}
                     onChange={(e) => setFormData({...formData, description: e.target.value})}
                   />
                   <p className="text-xs text-muted-foreground">이 설명은 AI 이해에 매우 중요합니다.</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label>중요도</Label>
                      <select 
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={formData.importanceLevel}
                        onChange={(e) => setFormData({...formData, importanceLevel: e.target.value})}
                      >
                         <option value="LOW">낮음</option>
                         <option value="MEDIUM">보통</option>
                         <option value="HIGH">높음</option>
                         <option value="CRITICAL">치명적</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <Label>태그</Label>
                      <Input 
                         placeholder="예: 사용자, 재무 (쉼표로 구분)" 
                         value={formData.tags?.join(', ')}
                         onChange={(e) => setFormData({...formData, tags: e.target.value.split(',').map((t: string) => t.trim())})}
                      />
                   </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Switch 
                    id="exclude" 
                    checked={formData.isExcluded} 
                    onCheckedChange={(c) => setFormData({...formData, isExcluded: c})} 
                  />
                  <Label htmlFor="exclude">AI 컨텍스트에서 제외</Label>
                  <Switch 
                    id="sync" 
                    checked={formData.isSyncedWithAI} 
                    className="ml-4"
                    onCheckedChange={(c) => setFormData({...formData, isSyncedWithAI: c})} 
                  />
                  <Label htmlFor="sync">AI와 명시적으로 동기화</Label>
                </div>
                    
                <div className="pt-4 border-t">
                    <Label>검토 노트</Label>
                    <Textarea 
                         className="mt-2 min-h-[60px]" 
                         placeholder="Add notes for reviewers..." 
                         value={formData.reviewNotes || ""}
                         onChange={(e) => setFormData({...formData, reviewNotes: e.target.value})}
                    />
                </div>
              </Card>

              {/* Excel Import/Export */}
              <ExcelImportExport 
                dataSourceId={table.dataSourceId} 
                onImportComplete={onUpdate}
              />
            </TabsContent>

            <TabsContent value="columns" className="flex-1 overflow-auto p-0 mt-0">
              <div className="w-full h-full p-4">
                <div className="border rounded-md overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground text-xs uppercase sticky top-0">
                            <tr>
                                <th className="p-3 font-medium w-[20%]">컬럼</th>
                                <th className="p-3 font-medium w-[10%]">타입</th>
                                <th className="p-3 font-medium w-[15%]">의미적 이름</th>
                                <th className="p-3 font-medium w-[25%]">설명</th>
                                <th className="p-3 font-medium w-[10%]">단위</th>
                                <th className="p-3 font-medium text-center w-[8%]">코드</th>
                                <th className="p-3 font-medium w-[10%]">민감도</th>
                                <th className="p-3 font-medium text-center w-[8%]">제외</th>
                                <th className="p-3 font-medium text-center w-[5%]">삭제</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {columns.map((col: any) => (
                                <tr key={col.id} className={`hover:bg-muted/50 group ${col.isExcluded ? 'opacity-50 bg-muted/30' : ''}`}>
                                    <td className="p-3 font-medium font-mono text-xs">
                                        <div className="flex items-center gap-2">
                                            {col.columnName}
                                            {col.isPrimaryKey && <span className="text-[10px] text-primary bg-primary/10 px-1 rounded">PK</span>}
                                            {col.isForeignKey && <span className="text-[10px] text-blue-500 bg-blue-500/10 px-1 rounded">FK</span>}
                                        </div>
                                    </td>
                                    <td className="p-3 text-muted-foreground text-xs truncate">{col.dataType}</td>
                                    <td className="p-3">
                                        <Input 
                                            className="h-7 text-xs bg-transparent border-transparent hover:border-input focus:border-primary transition-colors" 
                                            placeholder="이름" 
                                            value={col.semanticName || ""} 
                                            onChange={(e) => handleColumnChange(col.id, 'semanticName', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-3">
                                        <Input 
                                            className="h-7 text-xs bg-transparent border-transparent hover:border-input focus:border-primary transition-colors" 
                                            placeholder="설명..." 
                                            value={col.description || ""} 
                                            onChange={(e) => handleColumnChange(col.id, 'description', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-3">
                                         <Input 
                                            className="h-7 text-xs w-20 bg-transparent border-transparent hover:border-input focus:border-primary transition-colors" 
                                            placeholder="-" 
                                            value={col.unit || ""} 
                                            onChange={(e) => handleColumnChange(col.id, 'unit', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                checked={col.isCode || false} 
                                                onChange={(e) => handleColumnChange(col.id, 'isCode', e.target.checked)}
                                                className="accent-primary h-4 w-4"
                                            />
                                            {col.isCode && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6" 
                                                    title="코드 관리"
                                                    onClick={() => openCodeManager(col)}
                                                >
                                                    <Tag className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                       <select 
                                         className="h-7 text-xs bg-transparent border-transparent hover:border-input focus:border-primary rounded w-full"
                                         value={col.sensitivityLevel}
                                         onChange={(e) => handleColumnChange(col.id, 'sensitivityLevel', e.target.value)}
                                       >
                                          <option value="PUBLIC">공개</option>
                                          <option value="INTERNAL">내부용</option>
                                          <option value="CONFIDENTIAL">기밀</option>
                                          <option value="STRICT">엄격</option>
                                       </select>
                                    </td>
                                    <td className="p-3 text-center">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`h-7 w-7 ${col.isExcluded ? 'text-orange-500 bg-orange-50' : 'text-muted-foreground hover:text-primary'}`}
                                        onClick={() => handleToggleColumnExcluded(col)}
                                        title={col.isExcluded ? '컬럼 포함' : '컬럼 제외'}
                                      >
                                        {col.isExcluded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                      </Button>
                                    </td>
                                    <td className="p-3 text-center">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          console.log('[DEBUG] Delete button clicked');
                                          handleDeleteColumn(col);
                                        }}
                                        title="컬럼 삭제"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="relationships" className="flex-1 overflow-auto bg-muted/5 mt-0">
                 <RelationshipManager tableId={table.id} dataSourceId={table.dataSourceId} columns={columns} />
            </TabsContent>

            <TabsContent value="indexes" className="flex-1 overflow-auto bg-muted/5 mt-0">
                 <IndexManager tableId={table.id} tableName={table.tableName} columns={columns} />
            </TabsContent>

            <TabsContent value="preview" className="flex-1 overflow-auto bg-muted/5 mt-0">
                 <DataPreview tableId={table.id} />
            </TabsContent>
          </Tabs>
      </div>
    </div>

    {activeColumnForCodes && (
        <CodeValueManager 
            isOpen={codeManagerOpen}
            onClose={() => setCodeManagerOpen(false)}
            columnId={activeColumnForCodes.id}
            columnName={activeColumnForCodes.name}
        />
    )}
    </>
  );
}
