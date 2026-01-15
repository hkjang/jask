'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, Key, Link2, ChevronDown, ChevronRight, Table2 } from 'lucide-react';
import { api } from '@/lib/api';
import { extractTableNames } from '@/lib/sql-parser';

interface TableSchemaViewerProps {
  sql: string;
  dataSourceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ColumnInfo {
  id: string;
  columnName: string;
  dataType: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  description?: string;
  koreanName?: string;
}

interface TableInfo {
  id: string;
  tableName: string;
  schemaName?: string;
  description?: string;
  koreanName?: string;
  columns: ColumnInfo[];
}

export function TableSchemaViewer({
  sql,
  dataSourceId,
  open,
  onOpenChange,
}: TableSchemaViewerProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const tableNames = extractTableNames(sql);

  // 데이터소스의 모든 테이블 메타데이터 가져오기
  const { data: allTables, isLoading, error } = useQuery({
    queryKey: ['tables', dataSourceId],
    queryFn: () => api.getTables(dataSourceId),
    enabled: open && !!dataSourceId,
    staleTime: 1000 * 60 * 5, // 5분 캐시
  });

  // SQL에 사용된 테이블만 필터링
  const relevantTables = allTables?.filter((table: TableInfo) =>
    tableNames.some(
      (name) =>
        table.tableName.toLowerCase() === name.toLowerCase() ||
        name.toLowerCase().includes(table.tableName.toLowerCase())
    )
  ) || [];

  // 모달이 열릴 때 첫 번째 테이블 자동 확장
  useEffect(() => {
    if (open && relevantTables.length > 0 && expandedTables.size === 0) {
      setExpandedTables(new Set([relevantTables[0].id]));
    }
  }, [open, relevantTables]);

  const toggleTable = (tableId: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            쿼리에 사용된 테이블 스키마
          </DialogTitle>
          <DialogDescription>
            SQL에서 추출된 {tableNames.length}개 테이블의 스키마 정보입니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">스키마 로딩 중...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              <p>스키마를 불러오는 중 오류가 발생했습니다.</p>
              <p className="text-sm mt-1">{(error as Error).message}</p>
            </div>
          ) : relevantTables.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Table2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>일치하는 테이블을 찾을 수 없습니다.</p>
              <p className="text-sm mt-2">
                추출된 테이블: {tableNames.join(', ') || '없음'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {relevantTables.map((table: TableInfo) => (
                <div
                  key={table.id}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* 테이블 헤더 */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
                    onClick={() => toggleTable(table.id)}
                  >
                    {expandedTables.has(table.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">
                          {table.schemaName ? `${table.schemaName}.` : ''}
                          {table.tableName}
                        </span>
                        {table.koreanName && (
                          <span className="text-muted-foreground text-sm">
                            ({table.koreanName})
                          </span>
                        )}
                      </div>
                      {table.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {table.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {table.columns?.length || 0} 컬럼
                    </Badge>
                  </button>

                  {/* 컬럼 목록 */}
                  {expandedTables.has(table.id) && (
                    <div className="border-t">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/30">
                            <tr className="text-left text-muted-foreground">
                              <th className="px-4 py-2 font-medium w-1/4">컬럼명</th>
                              <th className="px-4 py-2 font-medium w-1/6">타입</th>
                              <th className="px-4 py-2 font-medium w-1/6">키</th>
                              <th className="px-4 py-2 font-medium">설명</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {table.columns?.map((column: ColumnInfo) => (
                              <tr key={column.id} className="hover:bg-muted/20">
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    <code className="font-mono text-xs">
                                      {column.columnName}
                                    </code>
                                    {column.koreanName && (
                                      <span className="text-muted-foreground text-xs">
                                        ({column.koreanName})
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {column.dataType}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-1">
                                    {column.isPrimaryKey && (
                                      <Badge className="text-[10px] px-1.5 py-0 h-5 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                        <Key className="h-3 w-3 mr-0.5" />
                                        PK
                                      </Badge>
                                    )}
                                    {column.isForeignKey && (
                                      <Badge className="text-[10px] px-1.5 py-0 h-5 bg-blue-500/10 text-blue-600 border-blue-500/30">
                                        <Link2 className="h-3 w-3 mr-0.5" />
                                        FK
                                      </Badge>
                                    )}
                                    {!column.isNullable && !column.isPrimaryKey && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                                        NOT NULL
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-muted-foreground text-xs">
                                  {column.description || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 추출된 테이블명 표시 */}
        {tableNames.length > 0 && (
          <div className="pt-3 border-t text-xs text-muted-foreground">
            <span className="font-medium">SQL에서 추출된 테이블:</span>{' '}
            <span className="font-mono">{tableNames.join(', ')}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
