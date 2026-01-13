'use client';

import { useState } from 'react';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ResultTableProps {
  rows: any[];
  fields?: { name: string; type: string }[];
  rowCount: number;
  executionTime?: number;
  truncated?: boolean;
  summary?: string;
  className?: string;
}

export function ResultTable({
  rows,
  fields = [],
  rowCount,
  executionTime,
  truncated = false,
  summary,
  className,
}: ResultTableProps) {
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const totalPages = Math.ceil(rows.length / pageSize);

  const columns = fields.length > 0
    ? fields.map(f => f.name)
    : rows.length > 0
      ? Object.keys(rows[0])
      : [];

  const paginatedRows = rows.slice(page * pageSize, (page + 1) * pageSize);

  const handleExport = () => {
    const headers = columns.join(',');
    const csvRows = rows.map(row =>
      columns.map(col => {
        const value = row[col];
        if (value === null) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      }).join(',')
    );
    const csv = [headers, ...csvRows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `query_result_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold">결과</CardTitle>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{rowCount.toLocaleString()}개 결과</span>
            {executionTime && <span>{executionTime}ms</span>}
            {truncated && <span className="text-yellow-600">(결과가 잘림)</span>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" />
          CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        {summary && (
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-1">요약</p>
            <p className="text-muted-foreground">{summary}</p>
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border overflow-auto max-h-[400px]">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2 text-left font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, i) => (
                <tr key={i} className="border-t hover:bg-muted/50">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2 whitespace-nowrap">
                      {row[col] === null ? (
                        <span className="text-muted-foreground italic">NULL</span>
                      ) : (
                        String(row[col])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {page * pageSize + 1} - {Math.min((page + 1) * pageSize, rows.length)} / {rows.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
