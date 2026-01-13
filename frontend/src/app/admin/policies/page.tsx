'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, Edit, ShieldAlert } from 'lucide-react';

// Types (should be in a shared type file but defining here for now)
type PolicyType = 'QUERY' | 'SQL' | 'METADATA' | 'MODEL' | 'DOMAIN';

interface Policy {
  id: string;
  name: string;
  type: PolicyType;
  description?: string;
  config: any;
  isActive: boolean;
  priority: number;
}

export default function PoliciesPage() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    type: PolicyType;
    description: string;
    config: string; // JSON string
    isActive: boolean;
    priority: number;
  }>({
    name: '',
    type: 'SQL',
    description: '',
    config: '{\n  "maxJoins": 3\n}',
    isActive: true,
    priority: 0,
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const res = await fetch('/api/admin/policies'); // Need to ensure API route /api/admin/* is handled by backend proxy or direct call
      // Assuming existing pattern uses backend URL
      // If client-side fetching from NestJS: usually http://localhost:4000/admin/policies
      // But let's assume a proxy or absolute URL setup exists. 
      // Checking other files... usually fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/policies`)
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/admin/policies`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}` // Simple auth assumption
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPolicies(data);
      }
    } catch (error) {
      console.error('Failed to fetch policies', error);
      toast({
        title: '정책 목록을 불러오지 못했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      let parsedConfig;
      try {
        parsedConfig = JSON.parse(formData.config);
      } catch (e) {
        toast({
          title: 'Config JSON 형식이 올바르지 않습니다.',
          variant: 'destructive',
        });
        return;
      }

      const payload = {
        ...formData,
        config: parsedConfig,
        priority: Number(formData.priority),
      };

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const method = editingPolicy ? 'PUT' : 'POST';
      const url = editingPolicy 
        ? `${apiUrl}/admin/policies/${editingPolicy.id}` 
        : `${apiUrl}/admin/policies`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast({
        title: editingPolicy ? '정책이 수정되었습니다.' : '새 정책이 생성되었습니다.',
      });
      setIsDialogOpen(false);
      setEditingPolicy(null);
      fetchPolicies();
    } catch (error) {
      toast({
        title: '저장에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      await fetch(`${apiUrl}/admin/policies/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      toast({
        title: '정책이 삭제되었습니다.',
      });
      fetchPolicies();
    } catch (error) {
      toast({
        title: '삭제 실패',
        variant: 'destructive',
      });
    }
  };

  const openEdit = (policy: Policy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      type: policy.type,
      description: policy.description || '',
      config: JSON.stringify(policy.config, null, 2),
      isActive: policy.isActive,
      priority: policy.priority,
    });
    setIsDialogOpen(true);
  };

  const openCreate = () => {
    setEditingPolicy(null);
    setFormData({
      name: '',
      type: 'SQL',
      description: '',
      config: '{\n  "maxJoins": 3\n}',
      isActive: true,
      priority: 0,
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Policies & Governance</h2>
          <p className="text-muted-foreground">
            NL2SQL 엔진의 동작 정책과 위험 제어를 관리합니다.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> 정책 추가
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Policies</CardTitle>
          <CardDescription>
            현재 적용 중인 거버넌스 정책 목록입니다. 높은 우선순위(Priority) 정책이 먼저 검사됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Config Summary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                            등록된 정책이 없습니다.
                        </TableCell>
                    </TableRow>
                ) : (
                    policies.map((policy) => (
                    <TableRow key={policy.id}>
                        <TableCell>
                            <Badge variant="outline">{policy.priority}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-blue-500" />
                                {policy.name}
                            </div>
                            {policy.description && <div className="text-xs text-muted-foreground mt-1">{policy.description}</div>}
                        </TableCell>
                        <TableCell>
                            <Badge variant="secondary">{policy.type}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate font-mono text-xs">
                            {JSON.stringify(policy.config)}
                        </TableCell>
                        <TableCell>
                            <Switch checked={policy.isActive} disabled />
                        </TableCell>
                        <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(policy)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(policy.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                        </TableCell>
                    </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? '정책 수정' : '새 정책 생성'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Name</Label>
              <Input 
                className="col-span-3" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={(val: PolicyType) => setFormData({...formData, type: val})}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SQL">SQL Logic</SelectItem>
                  <SelectItem value="QUERY">User Query (Keyword)</SelectItem>
                  <SelectItem value="METADATA">Metadata Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Priority</Label>
              <Input 
                type="number" 
                className="col-span-3"
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: Number(e.target.value)})}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Status</Label>
                <div className="col-span-3 flex items-center gap-2">
                    <Switch 
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData({...formData, isActive: checked})}
                    />
                    <span className="text-sm text-muted-foreground">{formData.isActive ? 'Active' : 'Inactive'}</span>
                </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <Label className="text-right mt-2">Description</Label>
              <Textarea 
                className="col-span-3" 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <Label className="text-right mt-2">Config (JSON)</Label>
              <div className="col-span-3">
                <Textarea 
                    className="font-mono text-xs min-h-[150px]" 
                    value={formData.config}
                    onChange={(e) => setFormData({...formData, config: e.target.value})}
                />
                <p className="text-xs text-muted-foreground mt-1">
                    예시: &#123; "maxJoins": 3, "forbiddenKeywords": ["DROP"] &#125;
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>Save Policy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
