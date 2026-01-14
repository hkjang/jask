'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MessageSquare, Trash2, MoreVertical, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Thread {
  id: string;
  title: string;
  updatedAt: string;
}

export function ThreadSidebar({ 
  activeThreadId, 
  onThreadSelect 
}: { 
  activeThreadId?: string;
  onThreadSelect: (threadId: string) => void;
}) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
        fetchThreads();
    }, 300); // Debounce
    return () => clearTimeout(timer);
  }, [activeThreadId, search]);

  const fetchThreads = async () => {
    try {
      const res = await fetch(`/api/threads?q=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setThreads(data);
      }
    } catch (e) {
      console.error('Failed to fetch threads', e);
    }
  };

  const handleCreateThread = () => {
    onThreadSelect('');
  };

  const handleDeleteThread = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await fetch(`/api/threads/${threadId}`, { method: 'DELETE' });
      if (activeThreadId === threadId) {
        onThreadSelect(''); // Clear active thread
      }
      fetchThreads();
    } catch (e) {
      console.error('Failed to delete thread', e);
    }
  };

  return (
    <div className="w-64 border-r flex flex-col h-full bg-muted/10">
      <div className="p-4 border-b space-y-3">
        <div className="relative">
             <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
             <Input 
                placeholder="Search history..." 
                className="h-8 pl-8 text-xs" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
             />
        </div>
        <Button onClick={handleCreateThread} className="w-full gap-2" variant="default">
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {threads.length === 0 && (
            <div className="text-sm text-muted-foreground p-4 text-center">
              No history found.
            </div>
          )}
          {threads.map((thread) => (
            <div
              key={thread.id}
              onClick={() => onThreadSelect(thread.id)}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                activeThreadId === thread.id ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <div className="flex-1 truncate text-left">
                {thread.title}
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => handleDeleteThread(e, thread.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
