"use client"; 

import { Button } from "@/components/ui/button";
import { Database, Table, Search, MoreHorizontal, Pencil, Trash2, Plus, Sparkles, FileSymlink, Circle, AlertTriangle, Eye, LayoutGrid } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle, Languages, AlertCircle, MinusCircle, RefreshCw, EyeOff, Eye as EyeIcon, BarChart3, FilterX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MetadataSidebarProps {
  dataSources: any[];
  selectedDataSource: any;
  onSelectDataSource: (ds: any) => void;
  onRefreshDataSources: () => void; // Callback to refresh list after update/delete
  tables: any[];
  selectedTableId: string | null;
  onSelectTable: (id: string) => void;
}

export function MetadataSidebar({
  dataSources,
  selectedDataSource,
  onSelectDataSource,
  onRefreshDataSources,
  tables,
  selectedTableId,
  onSelectTable,
}: MetadataSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL"); // TABLE, VIEW, ALL
  const { toast } = useToast();
  const router = useRouter();

  // State for Edit Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDataSource, setEditingDataSource] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    type: "postgresql",
    host: "",
    port: 5432,
    database: "",
    username: "",
    password: "",
    schema: "public"
  });
  const [isTesting, setIsTesting] = useState(false);
  
  // State for Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dataSourceToDelete, setDataSourceToDelete] = useState<any>(null);


  const filteredTables = tables.filter(t => {
    const matchesSearch = t.tableName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || (t.metadataStatus || 'DRAFT') === statusFilter;
    const matchesType = typeFilter === "ALL" || (t.tableType || 'TABLE') === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Count tables and views for display
  const tableCount = filteredTables.filter(t => (t.tableType || 'TABLE') === 'TABLE').length;
  const viewCount = filteredTables.filter(t => t.tableType === 'VIEW').length;

  const handleEditClick = (ds: any) => {
      setEditingDataSource(ds);
      setEditForm({ 
        name: ds.name || "", 
        description: ds.description || "",
        type: ds.type || "postgresql",
        host: ds.host || "localhost",
        port: ds.port || 5432,
        database: ds.database || "",
        username: ds.username || "",
        password: "", // Don't show existing password
        schema: ds.schema || "public"
      });
      setEditDialogOpen(true);
  };

  const confirmDeleteClick = (ds: any) => {
      setDataSourceToDelete(ds);
      setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
      if (!dataSourceToDelete) return;
      try {
          await api.deleteDataSource(dataSourceToDelete.id);
          toast({ title: "삭제됨", description: "데이터 소스가 삭제되었습니다." });
          if (selectedDataSource?.id === dataSourceToDelete.id) {
              onSelectDataSource(null);
          }
          onRefreshDataSources();
          setDeleteDialogOpen(false);
          setDataSourceToDelete(null);
      } catch (e: any) {
          toast({ title: "오류", description: e.message || "데이터 소스 삭제 실패", variant: "destructive" });
      }
  };

  const handleTestConnection = async () => {
      setIsTesting(true);
      try {
          await api.testConnection(editForm);
          toast({ title: "연결 성공", description: "데이터베이스에 성공적으로 연결되었습니다." });
      } catch (e: any) {
          toast({ title: "연결 실패", description: e.message || "연결에 실패했습니다.", variant: "destructive" });
      } finally {
          setIsTesting(false);
      }
  };

  const handleSaveEdit = async () => {
      if (!editingDataSource) return;
      try {
          const updateData: any = { ...editForm };
          if (!updateData.password) delete updateData.password; // Don't send empty password if not changed

          await api.updateDataSource(editingDataSource.id, updateData);
          toast({ title: "업데이트됨", description: "데이터 소스가 업데이트되었습니다." });
          setEditDialogOpen(false);
          onRefreshDataSources();
      } catch (e: any) {
          console.error(e);
          toast({ title: "오류", description: e.message || "데이터 소스 업데이트 실패", variant: "destructive" });
      }
  };

  const handleTranslateMetadata = async (ds: any, untranslatedOnly: boolean = false) => {
    try {
      const description = untranslatedOnly
        ? "AI가 미번역 메타데이터만 번역 중입니다. 잠시만 기다려주세요."
        : "AI가 전체 메타데이터를 번역 중입니다. 잠시만 기다려주세요.";
      toast({ title: "번역 시작됨", description });
      await api.translateMetadata(ds.id, untranslatedOnly);
      toast({ title: "번역 완료", description: "메타데이터 번역이 완료되었습니다." });
      onRefreshDataSources();
      if (selectedDataSource?.id === ds.id) {
          onSelectDataSource(ds);
      }
    } catch (e: any) {
      toast({ title: "번역 실패", description: e.message, variant: "destructive" });
    }
  };

  const handleCreateClick = () => {
      // For create, redirect to main datasources page as it's complex
      // OR implement simple create here.
      // Context implies "Connected ones CUD".. usually implies management.
      // Redirecting is safer for consistent flows.
      router.push('/datasources');
  };

  // 전체 점수 새로고침
  const handleRecalculateScores = async (ds: any) => {
    try {
      toast({ title: "점수 계산 시작됨", description: "전체 테이블의 품질 점수를 재계산 중입니다..." });
      const result = await api.recalculateAllScores(ds.id);
      toast({
        title: "점수 계산 완료",
        description: `${result.processed}개 테이블의 점수가 재계산되었습니다.`
      });
      onRefreshDataSources();
      if (selectedDataSource?.id === ds.id) {
        onSelectDataSource(ds);
      }
    } catch (e: any) {
      toast({ title: "점수 계산 실패", description: e.message, variant: "destructive" });
    }
  };

  // 제외 설정 일괄 반영
  const handleSyncExcludedItems = async (ds: any) => {
    try {
      toast({ title: "반영 시작됨", description: "제외 설정을 임베딩에 반영 중입니다..." });
      const result = await api.syncExcludedItems(ds.id);
      const messages = [];
      if (result.deletedTables > 0) messages.push(`${result.deletedTables}개 테이블 임베딩 삭제`);
      if (result.updatedTables > 0) messages.push(`${result.updatedTables}개 테이블 임베딩 갱신`);
      if (result.errors?.length > 0) messages.push(`${result.errors.length}개 오류 발생`);

      toast({
        title: "제외 설정 반영 완료",
        description: messages.length > 0 ? messages.join(', ') : "변경 사항이 없습니다.",
        variant: result.errors?.length > 0 ? "destructive" : "default"
      });
      onRefreshDataSources();
      if (selectedDataSource?.id === ds.id) {
        onSelectDataSource(ds);
      }
    } catch (e: any) {
      toast({ title: "반영 실패", description: e.message, variant: "destructive" });
    }
  };

  // 테이블 단일 번역
  const handleTranslateTable = async (table: any) => {
    try {
      toast({ title: "번역 시작됨", description: `${table.tableName} 테이블을 번역 중입니다...` });
      await api.translateTable(table.id);
      toast({ title: "번역 완료", description: `${table.tableName} 테이블 번역이 완료되었습니다.` });
      onRefreshDataSources();
      if (selectedDataSource) {
        onSelectDataSource(selectedDataSource);
      }
    } catch (e: any) {
      toast({ title: "번역 실패", description: e.message, variant: "destructive" });
    }
  };

  // AI 컨텍스트에서 제외/포함 토글
  const handleToggleExclude = async (table: any) => {
    try {
      const newExcluded = !table.isExcluded;
      await api.setTableExcluded(table.id, newExcluded);
      toast({
        title: newExcluded ? "AI 컨텍스트에서 제외됨" : "AI 컨텍스트에 포함됨",
        description: `${table.tableName} 테이블이 ${newExcluded ? '제외' : '포함'}되었습니다.`
      });
      onRefreshDataSources();
      if (selectedDataSource) {
        onSelectDataSource(selectedDataSource);
      }
    } catch (e: any) {
      toast({ title: "오류", description: e.message, variant: "destructive" });
    }
  };

  // AI와 명시적 동기화 (임베딩 재생성)
  const handleSyncWithAI = async (table: any) => {
    try {
      toast({ title: "동기화 시작됨", description: `${table.tableName} 테이블을 AI와 동기화 중입니다...` });
      await api.syncTableWithAI(table.id);
      toast({ title: "동기화 완료", description: `${table.tableName} 테이블이 AI와 동기화되었습니다.` });
      onRefreshDataSources();
      if (selectedDataSource) {
        onSelectDataSource(selectedDataSource);
      }
    } catch (e: any) {
      toast({ title: "동기화 실패", description: e.message, variant: "destructive" });
    }
  };

  return (
    <>
    <div className="w-72 border-r bg-muted/10 flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2">
            <Database className="h-4 w-4" /> 데이터 소스
            </h2>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCreateClick} title="데이터 소스 관리/생성">
                <Plus className="h-4 w-4" />
            </Button>
        </div>
        
        {/* DataSource Selector List */}
        <div className="flex flex-col gap-1 overflow-y-auto max-h-[150px]">
           {dataSources.map((ds) => (
             <div key={ds.id} className="flex items-center gap-1 group">
                 <Button 
                    variant={selectedDataSource?.id === ds.id ? "default" : "outline"}
                    className="flex-1 h-8 text-xs justify-start truncate"
                    onClick={() => onSelectDataSource(ds)}
                    >
                    {ds.name}
                 </Button>
                 <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-8 w-8">
                             <MoreHorizontal className="h-3 w-3" />
                         </Button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditClick(ds)}>
                              <Pencil className="h-3 w-3 mr-2" /> 정보 수정
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTranslateMetadata(ds, false)}>
                              <Sparkles className="h-3 w-3 mr-2" /> 전체 번역 (AI)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTranslateMetadata(ds, true)}>
                              <Languages className="h-3 w-3 mr-2" /> 미수행만 번역 (AI)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRecalculateScores(ds)}>
                              <BarChart3 className="h-3 w-3 mr-2" /> 점수 새로고침
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSyncExcludedItems(ds)}>
                              <FilterX className="h-3 w-3 mr-2" /> 제외 설정 일괄 반영
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                         <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => confirmDeleteClick(ds)}>
                             <Trash2 className="h-3 w-3 mr-2" /> Delete
                         </DropdownMenuItem>
                     </DropdownMenuContent>
                 </DropdownMenu>
             </div>
           ))}
        </div>
      </div>
      
      {selectedDataSource ? (
        <div className="flex-1 flex flex-col overflow-hidden">
           <div className="p-2 border-b space-y-2 bg-slate-50/50">
               <Button 
                   variant={selectedTableId === '__SAMPLE_QUERIES__' ? "secondary" : "outline"}
                   className="w-full justify-start text-xs h-8 border-dashed bg-white"
                   onClick={() => onSelectTable('__SAMPLE_QUERIES__')}
               >
                   <FileSymlink className="h-3.5 w-3.5 mr-2 text-primary" />
                   Manage Sample Queries
               </Button>
               <div className="relative">
                   <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                   <Input 
                     placeholder="Search tables..." 
                     className="h-8 pl-8 text-xs bg-background"
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                   />
               </div>
               
               <Select value={statusFilter} onValueChange={setStatusFilter}>
                   <SelectTrigger className="h-7 text-xs w-full">
                       <SelectValue placeholder="All Status" />
                   </SelectTrigger>
                   <SelectContent>
                       <SelectItem value="ALL">All Status</SelectItem>
                       <SelectItem value="DRAFT">Draft</SelectItem>
                       <SelectItem value="PENDING_REVIEW">Review Needed</SelectItem>
                       <SelectItem value="VERIFIED">Verified</SelectItem>
                   </SelectContent>
               </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-7 text-xs w-full">
                        <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">📋 All Types</SelectItem>
                        <SelectItem value="TABLE">📋 Tables Only</SelectItem>
                        <SelectItem value="VIEW">👁️ Views Only</SelectItem>
                    </SelectContent>
                </Select>
           </div>
           <div className="flex-1 overflow-auto p-2 space-y-0.5">
             <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1 flex justify-between">
               <span>Tables ({tableCount}) / Views ({viewCount})</span>
             </div>
             {filteredTables.map((t) => (
                <div key={t.id} className="flex items-center gap-0.5 group">
                  <Button
                    variant={selectedTableId === t.id ? "secondary" : "ghost"}
                    size="sm"
                    className={`flex-1 justify-start text-xs h-8 ${t.isExcluded ? 'opacity-50 line-through' : ''}`}
                    onClick={() => onSelectTable(t.id)}
                  >
                    {/* Translation Status Icon */}
                    <TranslationStatusIcon table={t} />
                    {/* Type Icon - VIEW vs TABLE */}
                    {t.tableType === 'VIEW' ? (
                      <Eye className="h-3 w-3 text-blue-500 shrink-0 ml-1" />
                    ) : (
                      <span className="ml-1"><StatusIcon status={t.metadataStatus} score={t.completenessScore} /></span>
                    )}
                    <span className="truncate flex-1 text-left ml-2">
                      {t.tableName}
                      {t.tableType === 'VIEW' && <span className="text-blue-500 text-[10px] ml-1">[VIEW]</span>}
                    </span>
                    {t.importanceLevel === 'HIGH' && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 ml-1" />}
                    {t.importanceLevel === 'CRITICAL' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 ml-1" />}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleTranslateTable(t)}>
                        <Sparkles className="h-3.5 w-3.5 mr-2" />
                        번역 (AI)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSyncWithAI(t)}>
                        <RefreshCw className="h-3.5 w-3.5 mr-2" />
                        AI와 동기화
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleToggleExclude(t)}>
                        {t.isExcluded ? (
                          <>
                            <EyeIcon className="h-3.5 w-3.5 mr-2" />
                            AI 컨텍스트에 포함
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3.5 w-3.5 mr-2" />
                            AI 컨텍스트에서 제외
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
             ))}
           </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
           Select a data source to view tables.
        </div>
      )}
    </div>

    {/* Edit Dialog */}
    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>데이터 소스 수정</DialogTitle>
                <DialogDescription>연결 정보를 업데이트합니다.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>이름</Label>
                        <Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>유형</Label>
                        <Select value={editForm.type} onValueChange={(val) => setEditForm({...editForm, type: val})}>
                            <SelectTrigger>
                                <SelectValue placeholder="유형 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                                <SelectItem value="mysql">MySQL</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label>설명</Label>
                    <Input value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>호스트</Label>
                        <Input value={editForm.host} onChange={(e) => setEditForm({...editForm, host: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>포트</Label>
                        <Input type="number" value={editForm.port} onChange={(e) => setEditForm({...editForm, port: parseInt(e.target.value) || 0})} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>데이터베이스</Label>
                        <Input value={editForm.database} onChange={(e) => setEditForm({...editForm, database: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>스키마</Label>
                        <Input value={editForm.schema} onChange={(e) => setEditForm({...editForm, schema: e.target.value})} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>사용자명</Label>
                        <Input value={editForm.username} onChange={(e) => setEditForm({...editForm, username: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>비밀번호</Label>
                        <Input type="password" placeholder="현재 비밀번호를 유지하려면 비워두세요" value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})} />
                    </div>
                </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
                 <Button type="button" variant="outline" onClick={handleTestConnection} disabled={isTesting} className="mr-auto">
                    {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    연결 테스트
                </Button>
                <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>취소</Button>
                <Button onClick={handleSaveEdit}>변경사항 저장</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    {/* Delete Alert Dialog */}
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                    이 작업은 되돌릴 수 없습니다. 이 작업은 데이터 소스 
                    <span className="font-semibold text-foreground"> {dataSourceToDelete?.name} </span>
                    및 관련 메타데이터를 영구적으로 삭제합니다.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    삭제
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function StatusIcon({ status, score }: { status?: string, score?: number }) {
    if (status === 'VERIFIED') {
        return <CheckCircle className="h-3 w-3 text-green-500" />;
    }
    if (status === 'PENDING_REVIEW' || (score && score > 50 && score < 90)) {
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
    }
    return <Circle className="h-3 w-3 text-muted-foreground" />;
}

// 번역 상태 계산 함수
function getTranslationStatus(table: any): 'complete' | 'partial' | 'none' {
  // 테이블 설명이 있는지 확인
  const hasTableDescription = !!table.description && table.description.trim().length > 0;

  // 컬럼들 중 번역된 것이 있는지 확인
  const columns = table.columns || [];
  const translatedColumns = columns.filter((col: any) =>
    (col.semanticName && col.semanticName.trim().length > 0) ||
    (col.description && col.description.trim().length > 0)
  );

  const hasColumnTranslations = translatedColumns.length > 0;
  const allColumnsTranslated = columns.length > 0 && translatedColumns.length === columns.length;

  // 완료: 테이블 설명 + 모든 컬럼 번역됨
  if (hasTableDescription && allColumnsTranslated) {
    return 'complete';
  }

  // 부분: 테이블 설명 또는 일부 컬럼만 번역됨
  if (hasTableDescription || hasColumnTranslations) {
    return 'partial';
  }

  // 미수행
  return 'none';
}

// 번역 상태 아이콘 컴포넌트
function TranslationStatusIcon({ table }: { table: any }) {
  const status = getTranslationStatus(table);

  if (status === 'complete') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span><Languages className="h-3 w-3 text-green-500 shrink-0" /></span>
          </TooltipTrigger>
          <TooltipContent>
            <p>번역 완료</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === 'partial') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span><Languages className="h-3 w-3 text-yellow-500 shrink-0" /></span>
          </TooltipTrigger>
          <TooltipContent>
            <p>부분 번역</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span><MinusCircle className="h-3 w-3 text-muted-foreground/50 shrink-0" /></span>
        </TooltipTrigger>
        <TooltipContent>
          <p>번역 미수행</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
