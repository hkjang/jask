"use client";

import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { api } from "@/lib/api";
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line
} from 'recharts';
import { 
    Activity, 
    Users, 
    Database, 
    AlertTriangle, 
    ThumbsUp, 
    ThumbsDown,
    ShieldCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/dashboard');
      setStats(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <MainLayout><div>Loading...</div></MainLayout>;
  if (!stats) return <MainLayout><div>Failed to load stats</div></MainLayout>;

  // Transform Data for Charts
  const statusData = Object.keys(stats.queryStats).map(key => ({
      name: key,
      value: stats.queryStats[key]
  }));

  const riskData = Object.keys(stats.riskStats || {}).map(key => ({
      name: key,
      value: stats.riskStats[key]
  }));

  const feedbackData = [
      { name: 'Positive', value: stats.feedbackStats?.POSITIVE || 0, color: '#22c55e' },
      { name: 'Negative', value: stats.feedbackStats?.NEGATIVE || 0, color: '#ef4444' }
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
  const RISK_COLORS: Record<string, string> = {
      'LOW': '#22c55e',
      'MEDIUM': '#eab308',
      'HIGH': '#f97316',
      'CRITICAL': '#ef4444'
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">System Overview & Monitoring</p>
        </div>

        {/* Top Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalQueries}</div>
              <p className="text-xs text-muted-foreground">+20.1% from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDataSources}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Trust Score</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(stats.avgTrustScore * 100).toFixed(0)}%</div>
               <p className="text-xs text-muted-foreground">Based on successful queries</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Query Status Overview</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151' }} />
                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <Card className="col-span-3">
             <CardHeader>
              <CardTitle>Risk Level Distribution</CardTitle>
              <CardDescription>Risk analysis of generated SQL</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={riskData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {riskData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151' }} />
                        </PieChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="flex justify-center gap-4 text-xs">
                    {riskData.map((entry) => (
                        <div key={entry.name} className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RISK_COLORS[entry.name] }}></div>
                            <span>{entry.name}</span>
                        </div>
                    ))}
                 </div>
            </CardContent>
          </Card>
        </div>

        {/* Feedback & Recent Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-3">
                 <CardHeader>
                  <CardTitle>User Feedback</CardTitle>
                  <CardDescription>Positive vs Negative reactions</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="flex justify-around items-center h-[200px]">
                        <div className="text-center">
                            <ThumbsUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
                            <div className="text-2xl font-bold">{stats.feedbackStats?.POSITIVE || 0}</div>
                            <div className="text-sm text-muted-foreground">Positive</div>
                        </div>
                        <div className="text-center">
                             <ThumbsDown className="h-8 w-8 text-red-500 mx-auto mb-2" />
                            <div className="text-2xl font-bold">{stats.feedbackStats?.NEGATIVE || 0}</div>
                            <div className="text-sm text-muted-foreground">Negative</div>
                        </div>
                     </div>
                </CardContent>
            </Card>

             <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Recent Queries</CardTitle>
                  <CardDescription>Latest system activity</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {stats.recentQueries.map((query: any) => (
                            <div key={query.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                                <div>
                                    <div className="font-medium text-sm truncate max-w-[200px]">{query.user.name}</div>
                                    <div className="text-xs text-muted-foreground truncate max-w-[250px]">{query.dataSource.name}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                     {query.riskLevel && <Badge variant="outline" className="text-[10px]">{query.riskLevel}</Badge>}
                                     <Badge variant={query.status === 'SUCCESS' ? 'secondary' : 'destructive'} className="text-[10px]">
                                        {query.status}
                                     </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
             </Card>
        </div>
      </div>
    </MainLayout>
  );
}
