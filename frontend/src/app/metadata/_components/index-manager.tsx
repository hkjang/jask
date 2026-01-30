"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ListTree, RefreshCw, Hash, Key, Search, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface IndexManagerProps {
  tableId: string;
  tableName: string;
  columns?: any[];
}

interface IndexInfo {
  indexName: string;
  columnNames: string[];
  isUnique: boolean;
  isPrimary: boolean;
  indexType?: string; // BTREE, HASH, GIN, GIST 등
  tablespaceName?: string;
}

export function IndexManager({ tableId, tableName, columns = [] }: IndexManagerProps) {
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (tableId) {
      loadIndexes();
    }
  }, [tableId]);

  const loadIndexes = async () => {
    setLoading(true);
    try {
      const data = await api.getTableIndexes(tableId);
      setIndexes(data || []);
    } catch (e) {
      console.error(e);
      // 인덱스 API가 없을 경우 빈 배열 유지
      setIndexes([]);
    } finally {
      setLoading(false);
    }
  };

  // 인덱스 타입별 아이콘
  const getIndexIcon = (index: IndexInfo) => {
    if (index.isPrimary) return <Key className="h-4 w-4 text-amber-500" />;
    if (index.isUnique) return <Hash className="h-4 w-4 text-blue-500" />;
    return <ListTree className="h-4 w-4 text-gray-500" />;
  };

  // 인덱스 타입별 배지 색상
  const getIndexBadgeVariant = (index: IndexInfo): "default" | "secondary" | "outline" => {
    if (index.isPrimary) return "default";
    if (index.isUnique) return "secondary";
    return "outline";
  };

  // 인덱스 분석: 인덱스에 포함된 컬럼이 자주 조회되는지 등 분석
  const analyzeIndexUsage = () => {
    const suggestions: string[] = [];

    // FK 컬럼에 인덱스가 있는지 확인
    const fkColumns = columns.filter(c => c.isForeignKey);
    for (const fk of fkColumns) {
      const hasIndex = indexes.some(idx =>
        idx.columnNames.some(cn => cn.toLowerCase() === fk.columnName.toLowerCase())
      );
      if (!hasIndex) {
        suggestions.push(`FK 컬럼 '${fk.columnName}'에 인덱스가 없습니다. 조인 성능 향상을 위해 인덱스 추가를 권장합니다.`);
      }
    }

    // 자주 사용되는 컬럼 패턴 확인 (created_at, updated_at, status 등)
    const commonIndexColumns = ['created_at', 'updated_at', 'status', 'type', 'is_active', 'deleted_at'];
    for (const colName of commonIndexColumns) {
      const col = columns.find(c => c.columnName.toLowerCase() === colName);
      if (col) {
        const hasIndex = indexes.some(idx =>
          idx.columnNames.some(cn => cn.toLowerCase() === colName)
        );
        if (!hasIndex) {
          suggestions.push(`'${colName}' 컬럼은 조회 조건에 자주 사용됩니다. 인덱스 추가를 고려해보세요.`);
        }
      }
    }

    return suggestions;
  };

  const suggestions = analyzeIndexUsage();

  // PK 컬럼
  const pkColumns = columns.filter(c => c.isPrimaryKey);
  // FK 컬럼
  const fkColumns = columns.filter(c => c.isForeignKey);
  // 인덱스가 있는 컬럼들
  const indexedColumnNames = new Set(
    indexes.flatMap(idx => idx.columnNames.map(cn => cn.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <ListTree className="h-5 w-5" /> 인덱스 관리
        </h3>
        <Button size="sm" variant="outline" onClick={loadIndexes} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      <Tabs defaultValue="indexes" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="indexes" className="gap-2">
            <ListTree className="h-4 w-4" /> 인덱스 목록
          </TabsTrigger>
          <TabsTrigger value="keys" className="gap-2">
            <Key className="h-4 w-4" /> 키 정보
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-2">
            <Zap className="h-4 w-4" /> 분석 & 제안
          </TabsTrigger>
        </TabsList>

        {/* 인덱스 목록 탭 */}
        <TabsContent value="indexes" className="flex-1 overflow-auto space-y-4">
          {loading && <div className="text-center p-4">로딩 중...</div>}

          {!loading && indexes.length === 0 && (
            <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
              <ListTree className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>인덱스 정보가 없습니다.</p>
              <p className="text-xs mt-1">메타데이터 동기화를 실행하면 인덱스 정보가 수집됩니다.</p>
            </div>
          )}

          {indexes.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">
                총 {indexes.length}개 인덱스
              </div>
              {indexes.map((idx, i) => (
                <Card key={i} className={`
                  ${idx.isPrimary ? 'border-amber-200 bg-amber-50/30' : ''}
                  ${idx.isUnique && !idx.isPrimary ? 'border-blue-200 bg-blue-50/30' : ''}
                `}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          {getIndexIcon(idx)}
                          <span className="font-mono text-sm font-medium">{idx.indexName}</span>
                          {idx.isPrimary && (
                            <Badge variant="default" className="text-xs bg-amber-500">PRIMARY</Badge>
                          )}
                          {idx.isUnique && !idx.isPrimary && (
                            <Badge variant="secondary" className="text-xs">UNIQUE</Badge>
                          )}
                          {idx.indexType && (
                            <Badge variant="outline" className="text-xs">{idx.indexType}</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 ml-6">
                          {idx.columnNames.map((colName, j) => (
                            <Badge key={j} variant="outline" className="font-mono text-xs">
                              {colName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 키 정보 탭 */}
        <TabsContent value="keys" className="flex-1 overflow-auto space-y-4">
          {/* Primary Key */}
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-600" />
                Primary Key
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {pkColumns.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {pkColumns.map(col => (
                    <Badge key={col.columnName} variant="outline" className="bg-amber-100 border-amber-300 font-mono">
                      {col.columnName}
                      <span className="text-muted-foreground ml-1">({col.dataType})</span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Primary Key가 정의되어 있지 않습니다.</p>
              )}
            </CardContent>
          </Card>

          {/* Foreign Keys */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Hash className="h-4 w-4 text-blue-600" />
                Foreign Keys
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {fkColumns.length > 0 ? (
                <div className="space-y-2">
                  {fkColumns.map(col => (
                    <div key={col.columnName} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="bg-blue-100 border-blue-300 font-mono">
                        {col.columnName}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="outline" className="bg-green-100 border-green-300 font-mono">
                        {col.referencedTable}.{col.referencedColumn}
                      </Badge>
                      {indexedColumnNames.has(col.columnName.toLowerCase()) ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            </TooltipTrigger>
                            <TooltipContent>인덱스 있음</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            </TooltipTrigger>
                            <TooltipContent>인덱스 없음 - 성능 저하 가능</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Foreign Key가 정의되어 있지 않습니다.</p>
              )}
            </CardContent>
          </Card>

          {/* Unique Constraints */}
          {indexes.filter(idx => idx.isUnique && !idx.isPrimary).length > 0 && (
            <Card className="border-purple-200 bg-purple-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Hash className="h-4 w-4 text-purple-600" />
                  Unique Constraints
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {indexes.filter(idx => idx.isUnique && !idx.isPrimary).map((idx, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{idx.indexName}:</span>
                      <div className="flex flex-wrap gap-1">
                        {idx.columnNames.map((colName, j) => (
                          <Badge key={j} variant="outline" className="bg-purple-100 border-purple-300 font-mono text-xs">
                            {colName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 분석 & 제안 탭 */}
        <TabsContent value="analysis" className="flex-1 overflow-auto space-y-4">
          {/* 인덱스 커버리지 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                인덱스 커버리지
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>전체 컬럼</span>
                  <span className="font-medium">{columns.length}개</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>인덱싱된 컬럼</span>
                  <span className="font-medium text-green-600">{indexedColumnNames.size}개</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>인덱스 개수</span>
                  <span className="font-medium">{indexes.length}개</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${columns.length > 0 ? (indexedColumnNames.size / columns.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 최적화 제안 */}
          <Card className={suggestions.length > 0 ? 'border-yellow-200 bg-yellow-50/50' : 'border-green-200 bg-green-50/50'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {suggestions.length > 0 ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
                최적화 제안
              </CardTitle>
            </CardHeader>
            <CardContent>
              {suggestions.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {suggestions.map((suggestion, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-yellow-500 mt-0.5">•</span>
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-green-600">
                  현재 인덱스 구성이 적절합니다. 추가 제안 사항이 없습니다.
                </p>
              )}
            </CardContent>
          </Card>

          {/* 인덱스 유형 설명 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">인덱스 유형 안내</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-amber-500">PRIMARY</Badge>
                  <span>테이블의 기본 키 인덱스 (자동 생성)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">UNIQUE</Badge>
                  <span>중복 값을 허용하지 않는 고유 인덱스</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">BTREE</Badge>
                  <span>범위 검색에 효율적인 기본 인덱스 유형</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">HASH</Badge>
                  <span>등치 비교에 최적화된 인덱스</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">GIN/GIST</Badge>
                  <span>전문 검색, 배열, JSON 등 특수 데이터용</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
