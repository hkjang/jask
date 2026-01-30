"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Network, Plus, Trash2, ArrowRight, Key, Link2, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface RelationshipManagerProps {
  tableId: string;
  dataSourceId: string;
  columns?: any[]; // 컬럼 정보 (FK 정보 포함)
}

interface FKRelation {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  isPrimaryKey: boolean;
}

export function RelationshipManager({ tableId, dataSourceId, columns = [] }: RelationshipManagerProps) {
  const [relationships, setRelationships] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState<any[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRel, setNewRel] = useState({
    targetTableId: "",
    relationType: "LOGICAL",
    description: ""
  });

  const { toast } = useToast();

  // FK 기반 관계 추출
  const fkRelations: FKRelation[] = columns
    .filter(col => col.isForeignKey && col.referencedTable)
    .map(col => ({
      columnName: col.columnName,
      referencedTable: col.referencedTable,
      referencedColumn: col.referencedColumn,
      isPrimaryKey: col.isPrimaryKey
    }));

  // PK 컬럼 추출
  const pkColumns = columns.filter(col => col.isPrimaryKey);

  useEffect(() => {
    if (tableId) {
      loadRelationships();
    }
  }, [tableId]);

  useEffect(() => {
    if (isAddOpen && dataSourceId) {
      loadTables();
    }
  }, [isAddOpen, dataSourceId]);

  const loadTables = async () => {
    try {
      const data = await api.getTables(dataSourceId);
      setTables(data.filter((t: any) => t.id !== tableId));
    } catch (e) {
      console.error(e);
    }
  };

  const loadRelationships = async () => {
    setLoading(true);
    try {
      const data = await api.getTableRelationships(tableId);
      setRelationships(data);
    } catch (e) {
      console.error(e);
      toast({ title: "오류", description: "관계 정보를 불러오는데 실패했습니다.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteRelationship(id);
      setRelationships(relationships.filter(r => r.id !== id));
      toast({ title: "삭제됨", description: "관계가 삭제되었습니다." });
    } catch (e) {
      toast({ title: "오류", description: "관계 삭제에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!newRel.targetTableId) {
      toast({ title: "입력 오류", description: "대상 테이블을 선택해주세요.", variant: "destructive" });
      return;
    }
    try {
      await api.createRelationship(tableId, {
        targetTableId: newRel.targetTableId,
        relationType: newRel.relationType,
        description: newRel.description
      });
      toast({ title: "생성됨", description: "관계가 생성되었습니다." });
      setIsAddOpen(false);
      setNewRel({ targetTableId: "", relationType: "LOGICAL", description: "" });
      loadRelationships();
    } catch (e) {
      toast({ title: "오류", description: "관계 생성에 실패했습니다.", variant: "destructive" });
    }
  };

  // FK 관계를 논리적 관계로 등록
  const handleRegisterFKAsLogical = async (fk: FKRelation) => {
    const targetTable = tables.find(t =>
      t.tableName.toLowerCase() === fk.referencedTable.toLowerCase()
    );

    if (!targetTable) {
      // 테이블 목록을 먼저 로드
      const data = await api.getTables(dataSourceId);
      const found = data.find((t: any) =>
        t.tableName.toLowerCase() === fk.referencedTable.toLowerCase()
      );
      if (!found) {
        toast({ title: "오류", description: `참조 테이블 '${fk.referencedTable}'을 찾을 수 없습니다.`, variant: "destructive" });
        return;
      }
      try {
        await api.createRelationship(tableId, {
          targetTableId: found.id,
          relationType: "FK",
          description: `${fk.columnName} → ${fk.referencedTable}.${fk.referencedColumn}`
        });
        toast({ title: "등록됨", description: "FK 관계가 논리적 관계로 등록되었습니다." });
        loadRelationships();
      } catch (e) {
        toast({ title: "오류", description: "관계 등록에 실패했습니다.", variant: "destructive" });
      }
    } else {
      try {
        await api.createRelationship(tableId, {
          targetTableId: targetTable.id,
          relationType: "FK",
          description: `${fk.columnName} → ${fk.referencedTable}.${fk.referencedColumn}`
        });
        toast({ title: "등록됨", description: "FK 관계가 논리적 관계로 등록되었습니다." });
        loadRelationships();
      } catch (e) {
        toast({ title: "오류", description: "관계 등록에 실패했습니다.", variant: "destructive" });
      }
    }
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Network className="h-5 w-5" /> 테이블 관계
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadRelationships}>
            <RefreshCw className="h-4 w-4 mr-2" /> 새로고침
          </Button>
          <Button size="sm" variant="default" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> 논리적 관계 추가
          </Button>
        </div>
      </div>

      <Tabs defaultValue="physical" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="physical" className="gap-2">
            <Key className="h-4 w-4" /> 물리적 관계 (FK)
          </TabsTrigger>
          <TabsTrigger value="logical" className="gap-2">
            <Link2 className="h-4 w-4" /> 논리적 관계
          </TabsTrigger>
        </TabsList>

        {/* 물리적 관계 (FK) 탭 */}
        <TabsContent value="physical" className="flex-1 overflow-auto space-y-4">
          {/* PK 정보 */}
          {pkColumns.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-4 w-4 text-amber-600" />
                  Primary Key
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {pkColumns.map(col => (
                    <Badge key={col.columnName} variant="outline" className="bg-amber-100 border-amber-300">
                      {col.columnName} ({col.dataType})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* FK 관계 */}
          {fkRelations.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">Foreign Keys ({fkRelations.length})</div>
              {fkRelations.map((fk, idx) => {
                // 이미 논리적 관계로 등록되어 있는지 확인
                const isRegistered = relationships.some(rel =>
                  rel.description?.includes(fk.columnName) &&
                  rel.description?.includes(fk.referencedTable)
                );

                return (
                  <Card key={idx} className="border-blue-200 bg-blue-50/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-blue-100 border-blue-300 font-mono text-xs">
                              {fk.columnName}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-blue-500" />
                            <Badge variant="outline" className="bg-green-100 border-green-300 font-mono text-xs">
                              {fk.referencedTable}.{fk.referencedColumn}
                            </Badge>
                          </div>
                          <Badge variant="secondary" className="text-xs">FK</Badge>
                        </div>
                        {isRegistered ? (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            등록됨
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRegisterFKAsLogical(fk)}
                            className="text-xs"
                          >
                            <Link2 className="h-3 w-3 mr-1" /> 논리적 관계로 등록
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>이 테이블에는 Foreign Key가 정의되어 있지 않습니다.</p>
              <p className="text-xs mt-1">논리적 관계 탭에서 수동으로 관계를 추가할 수 있습니다.</p>
            </div>
          )}
        </TabsContent>

        {/* 논리적 관계 탭 */}
        <TabsContent value="logical" className="flex-1 overflow-auto space-y-4">
          {/* 관계 추가 폼 */}
          {isAddOpen && (
            <Card className="border-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">새 논리적 관계 추가</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">대상 테이블</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                      value={newRel.targetTableId}
                      onChange={(e) => setNewRel({...newRel, targetTableId: e.target.value})}
                    >
                      <option value="">테이블 선택...</option>
                      {tables.map(t => (
                        <option key={t.id} value={t.id}>{t.tableName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">관계 유형</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                      value={newRel.relationType}
                      onChange={(e) => setNewRel({...newRel, relationType: e.target.value})}
                    >
                      <option value="LOGICAL">논리적 관계</option>
                      <option value="FK">FK 관계</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">설명 (선택)</label>
                  <Textarea
                    placeholder="예: user_id → users.id (사용자 참조)"
                    value={newRel.description}
                    onChange={(e) => setNewRel({...newRel, description: e.target.value})}
                    className="h-20"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => {
                    setIsAddOpen(false);
                    setNewRel({ targetTableId: "", relationType: "LOGICAL", description: "" });
                  }}>
                    취소
                  </Button>
                  <Button size="sm" onClick={handleCreate}>추가</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 기존 논리적 관계 목록 */}
          {loading && <div className="text-center p-4">로딩 중...</div>}

          {!loading && relationships.length === 0 && !isAddOpen && (
            <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
              <Link2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>정의된 논리적 관계가 없습니다.</p>
              <p className="text-xs mt-1">AI가 테이블 간 조인을 더 잘 이해할 수 있도록 관계를 추가해주세요.</p>
              <Button size="sm" variant="outline" className="mt-4" onClick={() => setIsAddOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> 관계 추가
              </Button>
            </div>
          )}

          {relationships.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">
                등록된 관계 ({relationships.length})
              </div>
              {relationships.map((rel) => {
                const isSource = rel.sourceTableId === tableId;
                const otherTableName = isSource
                  ? rel.targetTable?.tableName
                  : rel.sourceTable?.tableName || "Unknown";
                const relType = rel.relationType;

                return (
                  <Card key={rel.id} className="hover:bg-accent/5 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className={isSource ? "bg-primary/10 border-primary/30" : ""}>
                              {isSource ? "현재 테이블" : otherTableName}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline" className={!isSource ? "bg-primary/10 border-primary/30" : ""}>
                              {isSource ? otherTableName : "현재 테이블"}
                            </Badge>
                            <Badge
                              variant={relType === 'FK' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {relType === 'FK' ? 'FK' : 'LOGICAL'}
                            </Badge>
                          </div>
                          {rel.description && (
                            <p className="text-xs text-muted-foreground pl-1">
                              {rel.description}
                            </p>
                          )}
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(rel.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
