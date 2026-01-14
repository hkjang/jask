'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Loader2, MessageSquare, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function AdminChatHistoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setTimeout(() => setDebouncedSearch(e.target.value), 500);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-threads', page, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
          page: page.toString(),
          limit: '20',
          q: debouncedSearch
      });
      // Need valid auth token for this request
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/threads?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">전체 대화 이력</h1>
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="제목, 사용자명, 이메일 검색..."
              className="pl-8"
              value={search}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>제목</TableHead>
                <TableHead>사용자</TableHead>
                <TableHead>메시지 수</TableHead>
                <TableHead>생성일</TableHead>
                <TableHead>최근 활동</TableHead>
                <TableHead className="w-[80px]">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : data?.items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    대화 이력이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                data?.items?.map((thread: any) => (
                  <TableRow key={thread.id}>
                    <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate max-w-[300px]" title={thread.title}>{thread.title}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex flex-col">
                            <span className="font-medium text-sm">{thread.owner?.name || 'Unknown'}</span>
                            <span className="text-xs text-muted-foreground">{thread.owner?.email}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="secondary">{thread._count.messages}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(thread.createdAt), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(thread.updatedAt), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                    <TableCell>
                        <Link href={`/query?threadId=${thread.id}`} target="_blank">
                            <Button variant="ghost" size="icon" title="대화 보기">
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                        </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination Controls could be added here */}
        <div className="flex justify-center gap-2">
            <Button 
                variant="outline" 
                disabled={page <= 1} 
                onClick={() => setPage(p => p - 1)}
            >
                이전
            </Button>
            <span className="self-center text-sm text-muted-foreground">Page {page}</span>
            <Button 
                variant="outline" 
                disabled={!data || data.items.length < 20} 
                onClick={() => setPage(p => p + 1)}
            >
                다음
            </Button>
        </div>

      </div>
    </MainLayout>
  );
}
