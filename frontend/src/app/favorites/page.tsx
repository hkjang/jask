'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Folder,
  FolderPlus,
  Plus,
  Tag,
  BarChart3,
  SortAsc,
  SortDesc,
  Grid3X3,
  List,
  X,
  ChevronRight,
  Hash,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface FavoriteFolder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  displayOrder: number;
  _count: { favorites: number };
}

interface Favorite {
  id: string;
  name: string;
  naturalQuery: string;
  sqlQuery: string;
  createdAt: string;
  useCount: number;
  lastUsedAt?: string;
  tags: string[];
  description?: string;
  folderId?: string;
  folder?: {
    id: string;
    name: string;
    color?: string;
  };
  dataSource?: {
    id: string;
    name: string;
  };
}

type SortBy = 'createdAt' | 'useCount' | 'name' | 'displayOrder';
type ViewMode = 'grid' | 'list';

export default function FavoritesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  // Dialogs
  const [editingFav, setEditingFav] = useState<Favorite | null>(null);
  const [editForm, setEditForm] = useState({ name: '', folderId: '', tags: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState<Favorite | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FavoriteFolder | null>(null);
  const [folderForm, setFolderForm] = useState({ name: '', color: '#6366f1' });
  const [deleteTargetFolder, setDeleteTargetFolder] = useState<FavoriteFolder | null>(null);

  // Queries
  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['favorites', { folderId: selectedFolder, tag: selectedTag, sortBy, sortOrder }],
    queryFn: () => api.getFavorites({ 
      folderId: selectedFolder || undefined, 
      tag: selectedTag || undefined,
      sortBy, 
      sortOrder 
    }),
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['favoriteFolders'],
    queryFn: () => api.getFavoriteFolders(),
  });

  const { data: stats } = useQuery({
    queryKey: ['favoriteStats'],
    queryFn: () => api.getFavoriteStats(),
  });

  // Mutations
  const removeMutation = useMutation({
    mutationFn: (id: string) => api.removeFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['favoriteFolders'] });
      queryClient.invalidateQueries({ queryKey: ['favoriteStats'] });
      toast({ title: '즐겨찾기에서 삭제되었습니다' });
      setDeleteTarget(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateFavorite(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['favoriteFolders'] });
      queryClient.invalidateQueries({ queryKey: ['favoriteStats'] });
      toast({ title: '즐겨찾기가 수정되었습니다' });
      setEditingFav(null);
    },
  });

  const useMutation2 = useMutation({
    mutationFn: (id: string) => api.useFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['favoriteStats'] });
    },
  });

  // Folder mutations
  const createFolderMutation = useMutation({
    mutationFn: (data: { name: string; color?: string }) => api.createFavoriteFolder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favoriteFolders'] });
      toast({ title: '폴더가 생성되었습니다' });
      setFolderDialogOpen(false);
      setFolderForm({ name: '', color: '#6366f1' });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateFavoriteFolder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favoriteFolders'] });
      toast({ title: '폴더가 수정되었습니다' });
      setEditingFolder(null);
      setFolderDialogOpen(false);
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => api.deleteFavoriteFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favoriteFolders'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      toast({ title: '폴더가 삭제되었습니다' });
      setDeleteTargetFolder(null);
      if (selectedFolder) setSelectedFolder(null);
    },
  });

  // Computed
  const filteredFavorites = useMemo(() => {
    if (!searchQuery) return favorites as Favorite[];
    const query = searchQuery.toLowerCase();
    return (favorites as Favorite[]).filter((fav) =>
      fav.name.toLowerCase().includes(query) ||
      fav.naturalQuery?.toLowerCase().includes(query) ||
      fav.sqlQuery?.toLowerCase().includes(query) ||
      fav.tags?.some(t => t.toLowerCase().includes(query))
    );
  }, [favorites, searchQuery]);

  const allTags = useMemo(() => {
    const tagMap: Record<string, number> = {};
    (favorites as Favorite[]).forEach((fav) => {
      fav.tags?.forEach((tag) => {
        tagMap[tag] = (tagMap[tag] || 0) + 1;
      });
    });
    return Object.entries(tagMap).sort((a, b) => b[1] - a[1]);
  }, [favorites]);

  const totalCount = (folders as FavoriteFolder[]).reduce((acc, f) => acc + f._count.favorites, 0) + 
    (favorites as Favorite[]).filter(f => !f.folderId).length;

  // Handlers
  const copySQL = (sql: string) => {
    navigator.clipboard.writeText(sql);
    toast({ title: 'SQL이 복사되었습니다' });
  };

  const runQuery = (fav: Favorite) => {
    useMutation2.mutate(fav.id);
    router.push(`/query?q=${encodeURIComponent(fav.naturalQuery)}`);
  };

  const openEditDialog = (fav: Favorite) => {
    setEditingFav(fav);
    setEditForm({
      name: fav.name,
      folderId: fav.folderId || '',
      tags: fav.tags?.join(', ') || '',
      description: fav.description || '',
    });
  };

  const handleEditSave = () => {
    if (!editingFav) return;
    const tags = editForm.tags.split(',').map(t => t.trim()).filter(Boolean);
    updateMutation.mutate({
      id: editingFav.id,
      data: {
        name: editForm.name,
        folderId: editForm.folderId || null,
        tags,
        description: editForm.description || undefined,
      },
    });
  };

  const openFolderDialog = (folder?: FavoriteFolder) => {
    if (folder) {
      setEditingFolder(folder);
      setFolderForm({ name: folder.name, color: folder.color || '#6366f1' });
    } else {
      setEditingFolder(null);
      setFolderForm({ name: '', color: '#6366f1' });
    }
    setFolderDialogOpen(true);
  };

  const handleFolderSave = () => {
    if (editingFolder) {
      updateFolderMutation.mutate({ id: editingFolder.id, data: folderForm });
    } else {
      createFolderMutation.mutate(folderForm);
    }
  };

  const folderColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', 
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
  ];

  return (
    <MainLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <div className="w-64 border-r bg-muted/30 p-4 space-y-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              즐겨찾기
            </h2>
            <Button variant="ghost" size="icon" onClick={() => openFolderDialog()}>
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>

          {/* Folders */}
          <div className="space-y-1">
            <button
              onClick={() => { setSelectedFolder(null); setSelectedTag(null); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                !selectedFolder && !selectedTag ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                전체
              </span>
              <Badge variant="secondary" className="text-xs">{stats?.total || 0}</Badge>
            </button>

            {(folders as FavoriteFolder[]).map((folder) => (
              <div key={folder.id} className="group relative">
                <button
                  onClick={() => { setSelectedFolder(folder.id); setSelectedTag(null); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedFolder === folder.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Folder className="h-4 w-4" style={{ color: folder.color }} />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  <Badge variant="secondary" className="text-xs">{folder._count.favorites}</Badge>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openFolderDialog(folder)}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      수정
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => setDeleteTargetFolder(folder)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Tag className="h-3 w-3" />
                태그
              </h3>
              <div className="flex flex-wrap gap-1">
                {allTags.slice(0, 10).map(([tag, count]) => (
                  <button
                    key={tag}
                    onClick={() => { setSelectedTag(tag); setSelectedFolder(null); }}
                    className={`text-xs px-2 py-1 rounded-full transition-colors ${
                      selectedTag === tag 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    #{tag} ({count})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div className="pt-4 border-t space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                통계
              </h3>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">총 즐겨찾기</span>
                  <span className="font-medium">{stats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">폴더 분류됨</span>
                  <span className="font-medium">{stats.withFolder}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {selectedFolder ? (
                  <>
                    <Folder 
                      className="h-6 w-6" 
                      style={{ color: (folders as FavoriteFolder[]).find(f => f.id === selectedFolder)?.color }}
                    />
                    {(folders as FavoriteFolder[]).find(f => f.id === selectedFolder)?.name}
                  </>
                ) : selectedTag ? (
                  <>
                    <Hash className="h-6 w-6 text-primary" />
                    {selectedTag}
                  </>
                ) : (
                  <>
                    <Star className="h-6 w-6 text-yellow-500" />
                    모든 즐겨찾기
                  </>
                )}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {filteredFavorites.length}개의 즐겨찾기
              </p>
            </div>

            {/* View Controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center border rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="이름, 질문, SQL, 태그로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">생성일</SelectItem>
                <SelectItem value="useCount">사용 횟수</SelectItem>
                <SelectItem value="name">이름</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'desc' ? <SortDesc className="h-4 w-4" /> : <SortAsc className="h-4 w-4" />}
            </Button>

            {(selectedTag || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSelectedTag(null); setSearchQuery(''); }}
              >
                <X className="h-4 w-4 mr-1" />
                필터 초기화
              </Button>
            )}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className={viewMode === 'grid' ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-3' : 'space-y-3'}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-3">
                    <div className="h-5 bg-muted rounded w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                    <div className="h-16 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredFavorites.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                {searchQuery || selectedTag ? (
                  <>
                    <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground mb-2">검색 결과가 없습니다</p>
                    <Button variant="link" onClick={() => { setSearchQuery(''); setSelectedTag(null); }}>
                      필터 초기화
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="relative inline-block mb-4">
                      <FolderOpen className="h-16 w-16 text-muted-foreground/30" />
                      <Star className="h-6 w-6 text-yellow-500 absolute -right-1 -top-1" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">
                      {selectedFolder ? '이 폴더에 즐겨찾기가 없습니다' : '저장된 즐겨찾기가 없습니다'}
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      쿼리를 실행한 후 ⭐ 버튼을 클릭하여 즐겨찾기에 추가하세요.
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
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(fav.createdAt).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Play className="h-3 w-3" />
                              {fav.useCount}회
                            </span>
                            {fav.folder && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                <Folder className="h-2.5 w-2.5 mr-1" style={{ color: fav.folder.color }} />
                                {fav.folder.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
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
                          <DropdownMenuItem onClick={() => openEditDialog(fav)}>
                            <Edit3 className="h-4 w-4 mr-2" />
                            편집
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copySQL(fav.sqlQuery)}>
                            <Copy className="h-4 w-4 mr-2" />
                            SQL 복사
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
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
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      "{fav.naturalQuery}"
                    </p>

                    {fav.tags && fav.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {fav.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                            #{tag}
                          </Badge>
                        ))}
                        {fav.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            +{fav.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <pre className="text-xs bg-zinc-900 text-zinc-100 p-3 rounded-lg overflow-x-auto font-mono max-h-20">
                      {fav.sqlQuery}
                    </pre>
                    
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
          ) : (
            // List View
            <div className="space-y-2">
              {filteredFavorites.map((fav: Favorite) => (
                <Card key={fav.id} className="group hover:shadow-md transition-all">
                  <div className="flex items-center p-4 gap-4">
                    <Star className="h-5 w-5 text-yellow-500 shrink-0" />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{fav.name}</span>
                        {fav.folder && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            <Folder className="h-2.5 w-2.5 mr-1" style={{ color: fav.folder.color }} />
                            {fav.folder.name}
                          </Badge>
                        )}
                        {fav.tags?.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {fav.naturalQuery}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
                      <span className="flex items-center gap-1">
                        <Play className="h-3 w-3" />
                        {fav.useCount}
                      </span>
                      <span>
                        {new Date(fav.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => runQuery(fav)}>
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copySQL(fav.sqlQuery)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(fav)}>
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(fav)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Favorite Dialog */}
      <Dialog open={!!editingFav} onOpenChange={() => setEditingFav(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>즐겨찾기 편집</DialogTitle>
            <DialogDescription>
              즐겨찾기의 정보를 수정하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="즐겨찾기 이름"
              />
            </div>
            <div className="space-y-2">
              <Label>폴더</Label>
              <Select value={editForm.folderId} onValueChange={(v) => setEditForm({ ...editForm, folderId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="폴더 선택 (선택사항)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">없음</SelectItem>
                  {(folders as FavoriteFolder[]).map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <span className="flex items-center gap-2">
                        <Folder className="h-4 w-4" style={{ color: folder.color }} />
                        {folder.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>태그</Label>
              <Input
                value={editForm.tags}
                onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                placeholder="쉼표로 구분 (예: 매출, 월간보고)"
              />
            </div>
            <div className="space-y-2">
              <Label>설명 (선택사항)</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="메모나 설명을 입력하세요"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFav(null)}>
              취소
            </Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingFolder ? '폴더 수정' : '새 폴더 만들기'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>폴더 이름</Label>
              <Input
                value={folderForm.name}
                onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                placeholder="폴더 이름"
              />
            </div>
            <div className="space-y-2">
              <Label>색상</Label>
              <div className="flex gap-2 flex-wrap">
                {folderColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setFolderForm({ ...folderForm, color })}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      folderForm.color === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              취소
            </Button>
            <Button 
              onClick={handleFolderSave} 
              disabled={!folderForm.name || createFolderMutation.isPending || updateFolderMutation.isPending}
            >
              {editingFolder ? '수정' : '만들기'}
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

      {/* Delete Folder Confirmation */}
      <AlertDialog open={!!deleteTargetFolder} onOpenChange={() => setDeleteTargetFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>폴더 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTargetFolder?.name}" 폴더를 삭제하시겠습니까?
              폴더 내 즐겨찾기는 삭제되지 않고 "전체"로 이동합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTargetFolder && deleteFolderMutation.mutate(deleteTargetFolder.id)}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
