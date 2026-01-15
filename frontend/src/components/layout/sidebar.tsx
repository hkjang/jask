'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Database,
  MessageSquare,
  History,
  Star,
  Settings,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Layout,
  FileText,
  ShieldAlert,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface SidebarProps {
  className?: string;
}

const navItems = [
  { href: '/query', icon: MessageSquare, label: '질문하기' },
  { href: '/history', icon: History, label: '히스토리' },
  { href: '/favorites', icon: Star, label: '즐겨찾기' },
  { href: '/datasources', icon: Database, label: '데이터소스' },
  { href: '/metadata', icon: Layout, label: '메타데이터' },
];

const adminItems = [
  { href: '/admin/dashboard', icon: Layout, label: '대시보드' },
  { href: '/admin/chat-history', icon: MessageSquare, label: '대화 이력' },
  { href: '/admin/users', icon: Users, label: '사용자 관리' },
  { href: '/admin/settings', icon: Settings, label: '설정' },
  { href: '/admin/sample-queries', icon: FileText, label: '샘플 쿼리' },
  { href: '/admin/policies', icon: ShieldAlert, label: '정책 관리' },
  { href: '/admin/evolution', icon: Sparkles, label: 'AI 진화' },
  { href: '/admin/audit', icon: ShieldAlert, label: '감사 로그' },
];

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    api.clearToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
    router.push('/login');
  };

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              J
            </div>
            <span className="text-xl font-bold">Jask</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              collapsed && 'justify-center'
            )}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}

        <div className="my-4 border-t" />

        {adminItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              collapsed && 'justify-center'
            )}
          >
            <item.icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* Profile & Logout */}
      <div className="border-t p-2 space-y-1">
        <Link
          href="/profile"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
            collapsed && 'justify-center'
          )}
        >
          <User className="h-5 w-5" />
          {!collapsed && <span>프로필</span>}
        </Link>
        <Button
          variant="ghost"
          className={cn('w-full justify-start gap-3', collapsed && 'justify-center')}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>로그아웃</span>}
        </Button>
      </div>
    </aside>
  );
}
