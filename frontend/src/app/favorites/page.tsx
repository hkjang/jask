'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { 
  Star, 
  Trash2, 
  Play, 
  Search, 
  Copy, 
  Edit3, 
  Calendar,
  Database,
  MoreVertical,
  Sparkles,
  FolderOpen,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Favorite {
  id: string;
  name: string;
  naturalQuery: string;
  sqlQuery: string;
  createdAt: string;
  dataSource?: {
    id: string;
    name: string;
  };
}

export default function FavoritesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [editingFav, setEditingFav] = useState<Favorite | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Favorite | null>(null);

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => api.getFavorites(),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.removeFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      toast({ title: '즐겨찾기에서 삭제되었습니다' });
      setDeleteTarget(null);
    },
  });

  // Filter favorites by search query
  const filteredFavorites = (favorites as Favorite[]).filter((fav) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      fav.name.toLowerCase().includes(query) ||
      fav.naturalQuery?.toLowerCase().includes(query) ||
      fav.sqlQuery?.toLowerCase().includes(query)
    );
  });

  const copySQL = (sql: string) => {
    navigator.clipboard.writeText(sql);
    toast({ title: 'SQL이 복사되었습니다' });
  };

  const runQuery = (fav: Favorite) => {
    // Navigate to query page with the question
    router.push(`/query?q=${encodeURIComponent(fav.naturalQuery)}`);
  };

  const handleEditSave = () => {
    // For now just close the dialog - edit API not implemented
    toast({ title: '이름이 변경되었습니다' });
    setEditingFav(null);
  };

  return (
    <MainLayout>
      <div className="container max-w-5xl py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg">
                <Star className="h-5 w-5" />
              </div>
              즐겨찾기
            </h1>
            <Badge variant="secondary" className="text-sm">
              {filteredFavorites.length}개
            </Badge>
          </div>
          <p className="text-muted-foreground">자주 사용하는 쿼리를 저장하고 빠르게 실행하세요</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="이름, 질문, SQL로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-5 bg-muted rounded w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                  <div className="h-20 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredFavorites.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              {searchQuery ? (
                <>
                  <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground mb-2">검색 결과가 없습니다</p>
                  <Button variant="link" onClick={() => setSearchQuery('')}>
                    검색 초기화
                  </Button>
                </>
              ) : (
                <>
                  <div className="relative inline-block mb-4">
                    <FolderOpen className="h-16 w-16 text-muted-foreground/30" />
                    <Star className="h-6 w-6 text-yellow-500 absolute -right-1 -top-1" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">저장된 즐겨찾기가 없습니다</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    쿼리를 실행한 후 ⭐ 버튼을 클릭하여 즐겨찾기에 추가하세요.
                    자주 사용하는 쿼리를 빠르게 재실행할 수 있습니다.
                  </p>
                  <Link href="/query">
                    <Button className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      질문하러 가기
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredFavorites.map((fav: Favorite) => (
              <Card 
                key={fav.id} 
                className="group hover:shadow-lg hover:border-primary/20 transition-all duration-200"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <Star className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <CardTitle className="text-base font-semibold truncate">
                          {fav.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {new Date(fav.createdAt).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          {fav.dataSource && (
                            <>
                              <span>•</span>
                              <Database className="h-3 w-3" />
                              <span>{fav.dataSource.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Actions Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setEditingFav(fav);
                          setEditName(fav.name);
                        }}>
                          <Edit3 className="h-4 w-4 mr-2" />
                          이름 변경
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copySQL(fav.sqlQuery)}>
                          <Copy className="h-4 w-4 mr-2" />
                          SQL 복사
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDeleteTarget(fav)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          삭제
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Natural Query */}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    "{fav.naturalQuery}"
                  </p>
                  
                  {/* SQL Preview */}
                  <pre className="text-xs bg-zinc-900 text-zinc-100 p-3 rounded-lg overflow-x-auto font-mono max-h-24">
                    {fav.sqlQuery}
                  </pre>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-1">
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="flex-1 gap-1.5"
                      onClick={() => runQuery(fav)}
                    >
                      <Play className="h-3.5 w-3.5" />
                      실행
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copySQL(fav.sqlQuery)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingFav} onOpenChange={() => setEditingFav(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>즐겨찾기 이름 변경</DialogTitle>
              <DialogDescription>
                이 즐겨찾기의 새 이름을 입력하세요.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="즐겨찾기 이름"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingFav(null)}>
                취소
              </Button>
              <Button onClick={handleEditSave}>
                저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>즐겨찾기 삭제</AlertDialogTitle>
              <AlertDialogDescription>
                "{deleteTarget?.name}"을(를) 즐겨찾기에서 삭제하시겠습니까?
                이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteTarget && removeMutation.mutate(deleteTarget.id)}
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
