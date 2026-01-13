'use client';

import { useState } from 'react';
import { Copy, Check, Play, AlertTriangle, Edit2 } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface SqlPreviewProps {
  sql: string;
  warnings?: string[];
  onExecute?: (sql: string) => void;
  onPreview?: (sql: string) => void;
  isExecuting?: boolean;
  editable?: boolean;
  className?: string;
}

export function SqlPreview({
  sql,
  warnings = [],
  onExecute,
  onPreview,
  isExecuting = false,
  editable = true,
  className,
}: SqlPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSql, setEditedSql] = useState(sql);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    setIsEditing(false);
  };

  const currentSql = isEditing ? editedSql : sql;

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">생성된 SQL</CardTitle>
        <div className="flex items-center gap-2">
          {editable && !isEditing && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4 mr-1" />
              수정
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              {warnings.map((warning, i) => (
                <p key={i}>{warning}</p>
              ))}
            </div>
          </div>
        )}

        {/* SQL Editor / Viewer */}
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editedSql}
              onChange={(e) => setEditedSql(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                setEditedSql(sql);
                setIsEditing(false);
              }}>
                취소
              </Button>
              <Button size="sm" onClick={handleSave}>
                저장
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden">
            <SyntaxHighlighter
              language="sql"
              style={oneDark}
              customStyle={{
                margin: 0,
                padding: '1rem',
                fontSize: '0.875rem',
                borderRadius: '0.5rem',
              }}
            >
              {currentSql}
            </SyntaxHighlighter>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          {onPreview && (
            <Button
              variant="outline"
              onClick={() => onPreview(editedSql || sql)}
              disabled={isExecuting}
            >
              미리보기
            </Button>
          )}
          {onExecute && (
            <Button
              onClick={() => onExecute(editedSql || sql)}
              disabled={isExecuting}
            >
              <Play className="h-4 w-4 mr-1" />
              {isExecuting ? '실행 중...' : '실행'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
