"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Network, Plus, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";

interface RelationshipManagerProps {
  tableId: string;
  dataSourceId: string;
}

export function RelationshipManager({ tableId, dataSourceId }: RelationshipManagerProps) {
  const [relationships, setRelationships] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState<any[]>([]); // For selection
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newRel, setNewRel] = useState({ targetTableId: "", type: "ONE_TO_MANY" });
  
  const { toast } = useToast();

  useEffect(() => {
    if (tableId) {
      loadRelationships();
    }
  }, [tableId]);

  useEffect(() => {
      if (isAddOpen && dataSourceId) {
          loadTables();
      }
  }, [isAddOpen, dataSourceId]);

  const loadTables = async () => {
      try {
          const data = await api.getTables(dataSourceId);
          // Filter out current table
          setTables(data.filter((t: any) => t.id !== tableId));
      } catch (e) {
          console.error(e);
      }
  };

  const loadRelationships = async () => {
    setLoading(true);
    try {
      const data = await api.getTableRelationships(tableId);
      setRelationships(data);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load relationships", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
      try {
          await api.deleteRelationship(id);
          setRelationships(relationships.filter(r => r.id !== id));
          toast({ title: "Deleted", description: "Relationship removed." });
      } catch (e) {
          toast({ title: "Error", description: "Failed to delete relationship", variant: "destructive" });
      }
  };

  const handleCreate = async () => {
      if (!newRel.targetTableId) {
          toast({ title: "Validation Error", description: "Select a target table.", variant: "destructive" });
          return;
      }
      try {
          await api.createRelationship(tableId, {
              targetTableId: newRel.targetTableId,
              relationType: newRel.type
          });
          toast({ title: "Created", description: "Relationship created." });
          setIsAddOpen(false);
          loadRelationships();
      } catch (e) {
          toast({ title: "Error", description: "Failed to create relationship", variant: "destructive" });
      }
  };

  return (
    <div className="h-full flex flex-col p-6 space-y-4">
       <div className="flex justify-between items-center">
           <h3 className="font-semibold text-lg flex items-center gap-2">
               <Network className="h-5 w-5" /> Relationships
           </h3>
           <Button size="sm" variant="outline" onClick={() => setIsAddOpen(true)}>
               <Plus className="h-4 w-4 mr-2" /> Add Relationship
           </Button>
       </div>

       {isAddOpen && (
           <Card className="mb-4 border-primary">
               <CardContent className="p-4 flex gap-4 items-end">
                   <div className="flex-1 space-y-2">
                       <label className="text-xs font-medium">Target Table</label>
                       <select 
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                            value={newRel.targetTableId}
                            onChange={(e) => setNewRel({...newRel, targetTableId: e.target.value})}
                       >
                           <option value="">Select table...</option>
                           {tables.map(t => <option key={t.id} value={t.id}>{t.tableName}</option>)}
                       </select>
                   </div>
                   <div className="w-40 space-y-2">
                       <label className="text-xs font-medium">Type</label>
                       <select 
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                            value={newRel.type}
                            onChange={(e) => setNewRel({...newRel, type: e.target.value})}
                       >
                           <option value="ONE_TO_ONE">One to One</option>
                           <option value="ONE_TO_MANY">One to Many</option>
                           <option value="MANY_TO_ONE">Many to One</option>
                        </select>
                   </div>
                   <Button size="sm" onClick={handleCreate}>Add</Button>
                   <Button size="sm" variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
               </CardContent>
           </Card>
       )}

       <div className="flex-1 overflow-auto space-y-3">
           {loading && <div className="text-center p-4">Loading...</div>}
           {!loading && relationships.length === 0 && !isAddOpen && (
               <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
                   No relationships defined. Add one to help AI join tables correctly.
               </div>
           )}

           {relationships.map((rel) => {
               // Determine direction. 
               // The API returns relationships where current table is either Source or Target.
               const isSource = rel.sourceTableId === tableId;
               const otherTableName = isSource ? rel.targetTable?.tableName : rel.sourceTable?.tableName || "Unknown";
               const type = rel.relationType; 
               
               return (
                   <Card key={rel.id} className="bg-card hover:bg-accent/5 transition-colors">
                       <CardContent className="p-4 flex items-center justify-between">
                           <div className="flex items-center gap-4">
                               <div className="flex items-center gap-2 text-sm font-medium">
                                   <span className={isSource ? "text-primary" : "text-muted-foreground"}>Current Table</span>
                                   <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                   <span className={!isSource ? "text-primary" : "text-muted-foreground"}>{otherTableName}</span>
                               </div>
                               <span className="text-xs bg-muted px-2 py-1 rounded border">
                                   {type}
                               </span>
                           </div>
                           <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(rel.id)}>
                               <Trash2 className="h-4 w-4" />
                           </Button>
                       </CardContent>
                   </Card>
               );
           })}
       </div>
    </div>
  );
}
