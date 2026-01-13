"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Search, FileSymlink, MessageSquare, Database } from "lucide-react";

interface SampleQuery {
  id: string;
  naturalQuery: string;
  sqlQuery: string;
  description?: string;
  createdAt: string;
}

interface SampleQueryManagerProps {
  dataSourceId: string;
}

export function SampleQueryManager({ dataSourceId }: SampleQueryManagerProps) {
  const [samples, setSamples] = useState<SampleQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [newSample, setNewSample] = useState({
    naturalQuery: "",
    sqlQuery: "",
    description: ""
  });

  useEffect(() => {
    if (dataSourceId) {
      loadSamples();
    }
  }, [dataSourceId]);

  const loadSamples = async () => {
    setLoading(true);
    try {
      const data = await api.getSampleQueries(dataSourceId);
      setSamples(data as SampleQuery[]);
    } catch (e: any) {
      toast({ title: "Error", description: "Failed to load sample queries", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditOpen = (sample: SampleQuery) => {
    setNewSample({
      naturalQuery: sample.naturalQuery,
      sqlQuery: sample.sqlQuery,
      description: sample.description || ""
    });
    setEditingId(sample.id);
    setCreateOpen(true);
  };

  const handleSave = async () => {
    if (!newSample.naturalQuery || !newSample.sqlQuery) {
      toast({ title: "Validation Error", description: "Natural Query and SQL Query are required.", variant: "destructive" });
      return;
    }

    try {
      if (editingId) {
        // Update
        await api.updateSampleQuery(editingId, {
            ...newSample,
            dataSourceId
        });
        toast({ title: "Updated", description: "Sample query updated successfully." });
      } else {
        // Create
        await api.createSampleQuery({
            ...newSample,
            dataSourceId
        });
        toast({ title: "Created", description: "Sample query added successfully." });
      }
      setCreateOpen(false);
      setEditingId(null);
      setNewSample({ naturalQuery: "", sqlQuery: "", description: "" });
      loadSamples();
    } catch (e: any) {
        toast({ title: "Error", description: e.message || "Failed to save sample query", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sample query?")) return;
    try {
      await api.deleteSampleQuery(id);
      toast({ title: "Deleted", description: "Sample query deleted." });
      loadSamples();
    } catch (e: any) {
      toast({ title: "Error", description: "Failed to delete sample query", variant: "destructive" });
    }
  };

  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredSamples = samples.filter(s => 
    s.naturalQuery.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center bg-card shadow-sm z-10">
        <div>
           <h1 className="text-xl font-bold flex items-center gap-2">
             <FileSymlink className="h-5 w-5 text-primary" />
             Sample Queries
           </h1>
           <p className="text-sm text-muted-foreground">Manage example queries to improve AI accuracy (RAG).</p>
        </div>
        <Button onClick={() => {
            setEditingId(null);
            setNewSample({ naturalQuery: "", sqlQuery: "", description: "" });
            setCreateOpen(true);
        }} size="sm">
            <Plus className="h-4 w-4 mr-2" /> Add Sample
        </Button>
      </div>

      <div className="p-4 bg-muted/5 border-b">
         <div className="relative max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search sample queries..." 
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {loading ? (
             <p className="text-center text-muted-foreground py-10">Loading...</p>
        ) : filteredSamples.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-lg">
                <FileSymlink className="h-10 w-10 mb-2 opacity-20" />
                <p>No sample queries found.</p>
                <Button variant="link" onClick={() => {
                     setEditingId(null);
                     setNewSample({ naturalQuery: "", sqlQuery: "", description: "" });
                     setCreateOpen(true);
                }}>Add your first sample query</Button>
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-4">
                {filteredSamples.map((sample) => (
                    <Card key={sample.id} className="group relative transition-all hover:border-primary/50">
                        <CardHeader className="pb-2">
                           <div className="flex justify-between items-start">
                               <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                        <MessageSquare className="h-3.5 w-3.5" /> Natural Language
                                    </div>
                                    <p className="font-semibold">{sample.naturalQuery}</p>
                               </div>
                               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <Button variant="ghost" size="icon" onClick={() => handleEditOpen(sample)}>
                                        <FileSymlink className="h-4 w-4 text-primary" />
                                   </Button>
                                   <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(sample.id)}>
                                        <Trash2 className="h-4 w-4" />
                                   </Button>
                               </div>
                           </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <Database className="h-3.5 w-3.5" /> SQL
                                </div>
                                <div className="bg-slate-950 text-slate-50 p-3 rounded-md font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                                    {sample.sqlQuery}
                                </div>
                             </div>
                             {sample.description && (
                                 <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                                     {sample.description}
                                 </div>
                             )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Sample Query" : "Add Sample Query"}</DialogTitle>
            <DialogDescription>
              Provide a natural language question and the corresponding correct SQL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="space-y-2">
                <Label>Natural Language Question</Label>
                <Input 
                  placeholder="e.g. Find users who signed up last week" 
                  value={newSample.naturalQuery}
                  onChange={(e) => setNewSample({...newSample, naturalQuery: e.target.value})}
                />
             </div>
             <div className="space-y-2">
                <Label>SQL Query</Label>
                <Textarea 
                  className="font-mono min-h-[150px]"
                  placeholder="SELECT * FROM users WHERE ..." 
                  value={newSample.sqlQuery}
                  onChange={(e) => setNewSample({...newSample, sqlQuery: e.target.value})}
                />
             </div>
             <div className="space-y-2">
                <Label>Description <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                <Input 
                  placeholder="Brief Context about why this query is important" 
                  value={newSample.description}
                  onChange={(e) => setNewSample({...newSample, description: e.target.value})}
                />
             </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingId ? "Save Changes" : "Create Sample"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
