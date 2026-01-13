"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Layout, Save, Info, Plus, Columns, Network, Tag, 
  Trash2, SlidersHorizontal, AlertCircle 
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

import { CodeValueManager } from "./code-value-manager";
import { RelationshipManager } from "./relationship-manager";
import { MetadataQualityScore } from "./metadata-quality-score";

interface MetadataBuilderProps {
  table: any;
  onUpdate: () => void;
}

export function MetadataBuilder({ table, onUpdate }: MetadataBuilderProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [formData, setFormData] = useState<any>({});
  const [columns, setColumns] = useState<any[]>([]);
  const [scoreData, setScoreData] = useState<any>({ score: 0, status: 'DRAFT', details: {} });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (table) {
      setFormData({
        description: table.description || "",
        tags: table.tags || [],
        importanceLevel: table.importanceLevel || "MEDIUM",
        isSyncedWithAI: table.isSyncedWithAI,
        isExcluded: table.isExcluded,
        reviewNotes: table.reviewNotes
      });
      setColumns(table.columns || []);
      setScoreData({
          score: table.completenessScore || 0,
          status: table.metadataStatus || 'DRAFT',
          details: {} // Can't reconstruct details easily without recalc, but score is enough
      });
    }
  }, [table]);

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    try {
        const res: any = await api.post(`/metadata/tables/${table.id}/ai-draft`, {});
        
        // Update local state with generated data
        if (res.description) {
            setFormData((prev: any) => ({ ...prev, description: res.description }));
        }
        
        if (res.columns) {
            setColumns((prev: any) => prev.map((col: any) => {
               const gen = res.columns[col.columnName];
               if (gen) {
                   return {
                       ...col,
                       semanticName: gen.semanticName || col.semanticName,
                       description: gen.description || col.description,
                       unit: gen.unit || col.unit,
                       sensitivityLevel: gen.sensitivity || col.sensitivityLevel
                   };
               }
               return col;
            }));
        }

        toast({ title: "Draft Generated", description: "Review the suggested metadata." });
    } catch(e) {
        console.error(e);
        toast({ title: "Error", description: "Failed to generate draft", variant: "destructive" });
    } finally {
        setIsGenerating(false);
    }
  };

  const handleSaveTable = async () => {
    try {
      await api.updateTableExtendedMetadata(table.id, formData);
      toast({ title: "Saved", description: "Table metadata updated." });
      onUpdate();
    } catch (e) {
      toast({ title: "Error", description: "Failed to save table metadata", variant: "destructive" });
    }
  };

  const handleColumnChange = (id: string, field: string, value: any) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    // Auto-save or wait for explicit save? Explicit save for bulk is better, but individual row save works too.
    // Ideally we track dirty state.
    // For simplicity, let's implement instant save on blur/change for extended fields or a "Save Columns" button.
    // "Save Columns" button is safer.
  };

  const handleSaveColumns = async () => {
    try {
        // Bulk update or individual? API is individual.
        // Parallel requests.
        const promises = columns.map(col => {
            // Only send extended fields to save bandwidth if possible, but API takes DTO.
            return api.updateColumnExtendedMetadata(col.id, {
                description: col.description,
                semanticName: col.semanticName,
                unit: col.unit,
                isCode: col.isCode,
                sensitivityLevel: col.sensitivityLevel
            });
        });
        await Promise.all(promises);
        toast({ title: "Saved", description: "Columns updated successfully." });
        onUpdate();
    } catch (e) {
        console.error(e);
      toast({ title: "Error", description: "Failed to save columns", variant: "destructive" });
    }
  };

  const [codeManagerOpen, setCodeManagerOpen] = useState(false);
  const [activeColumnForCodes, setActiveColumnForCodes] = useState<{id: string, name: string} | null>(null);

  const openCodeManager = (col: any) => {
      setActiveColumnForCodes({ id: col.id, name: col.columnName });
      setCodeManagerOpen(true);
  };

  if (!table) return (
    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
      <Layout className="h-16 w-16 mb-4 opacity-20" />
      <p>Select a table to edit metadata</p>
    </div>
  );

  return (
    <>
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center bg-card shadow-sm z-10">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Layout className="h-5 w-5 text-primary" />
            {table.tableName}
            {formData.isExcluded && <Badge variant="destructive" className="ml-2">Excluded</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">{table.schemaName} • {table.rowCount?.toLocaleString()} rows</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={async () => {
             // Re-validate score
             try {
                const res = await api.post(`/metadata/tables/${table.id}/validate`, {});
                setScoreData(res);
                onUpdate();
             } catch(e) {}
          }}>
            Refresh Score
          </Button>
          <Button size="sm" variant="outline"><Info className="h-4 w-4 mr-1"/> Schema</Button>
          {(activeTab === 'general') && (
            <Button size="sm" onClick={handleSaveTable}><Save className="h-4 w-4 mr-1" /> Save General</Button>
          )}
           {(activeTab === 'columns') && (
            <Button size="sm" onClick={handleSaveColumns}><Save className="h-4 w-4 mr-1" /> Save Columns</Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
          {/* Score Section */}
          <div className="px-6 pt-6 pb-2">
              <MetadataQualityScore 
                 score={scoreData.score} 
                 status={scoreData.status} 
                 details={scoreData.details}
                 onValidate={async () => {
                     const res = await api.post(`/metadata/tables/${table.id}/validate`, {});
                     setScoreData(res);
                 }}
              />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-2 border-b bg-muted/10">
              <TabsList>
                <TabsTrigger value="general" className="gap-2"><SlidersHorizontal className="h-4 w-4"/> General</TabsTrigger>
                <TabsTrigger value="columns" className="gap-2"><Columns className="h-4 w-4"/> Columns</TabsTrigger>
                <TabsTrigger value="relationships" className="gap-2"><Network className="h-4 w-4"/> Relationships</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="general" className="flex-1 overflow-auto p-6 space-y-6 mt-0">
              <Card className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg flex items-center gap-2">Basic Information</h3>
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        className="gap-2 text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-200 border"
                        onClick={handleAutoGenerate}
                        disabled={isGenerating}
                    >
                        {isGenerating ? "Generating..." : <><span className="text-lg">✨</span> AI Auto-Fill Draft</>}
                    </Button>
                </div>
                
                <div className="space-y-2">
                   <Label>Description</Label>
                   <Textarea 
                     className="min-h-[100px]" 
                     placeholder="Describe the purpose of this table..." 
                     value={formData.description}
                     onChange={(e) => setFormData({...formData, description: e.target.value})}
                   />
                   <p className="text-xs text-muted-foreground">This description is critical for AI understanding.</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label>Importance Level</Label>
                      <select 
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={formData.importanceLevel}
                        onChange={(e) => setFormData({...formData, importanceLevel: e.target.value})}
                      >
                         <option value="LOW">Low</option>
                         <option value="MEDIUM">Medium</option>
                         <option value="HIGH">High</option>
                         <option value="CRITICAL">Critical</option>
                      </select>
                   </div>
                   <div className="space-y-2">
                      <Label>Tags</Label>
                      <Input 
                         placeholder="e.g. user, finance (comma separated)" 
                         value={formData.tags?.join(', ')}
                         onChange={(e) => setFormData({...formData, tags: e.target.value.split(',').map((t: string) => t.trim())})}
                      />
                   </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Switch 
                    id="exclude" 
                    checked={formData.isExcluded} 
                    onCheckedChange={(c) => setFormData({...formData, isExcluded: c})} 
                  />
                  <Label htmlFor="exclude">Exclude from AI Context</Label>
                  <Switch 
                    id="sync" 
                    checked={formData.isSyncedWithAI} 
                    className="ml-4"
                    onCheckedChange={(c) => setFormData({...formData, isSyncedWithAI: c})} 
                  />
                  <Label htmlFor="sync">Explicitly Synced with AI</Label>
                </div>
                    
                <div className="pt-4 border-t">
                    <Label>Review Notes</Label>
                    <Textarea 
                         className="mt-2 min-h-[60px]" 
                         placeholder="Add notes for reviewers..." 
                         value={formData.reviewNotes || ""}
                         onChange={(e) => setFormData({...formData, reviewNotes: e.target.value})}
                    />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="columns" className="flex-1 overflow-auto p-0 mt-0">
              <div className="w-full h-full p-4">
                <div className="border rounded-md overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground text-xs uppercase sticky top-0">
                            <tr>
                                <th className="p-3 font-medium w-[20%]">Column</th>
                                <th className="p-3 font-medium w-[10%]">Type</th>
                                <th className="p-3 font-medium w-[15%]">Semantic Name</th>
                                <th className="p-3 font-medium w-[25%]">Description</th>
                                <th className="p-3 font-medium w-[10%]">Unit</th>
                                <th className="p-3 font-medium text-center w-[10%]">Code</th>
                                <th className="p-3 font-medium w-[10%]">Sensitivity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {columns.map((col: any) => (
                                <tr key={col.id} className="hover:bg-muted/50 group">
                                    <td className="p-3 font-medium font-mono text-xs">
                                        <div className="flex items-center gap-2">
                                            {col.columnName}
                                            {col.isPrimaryKey && <span className="text-[10px] text-primary bg-primary/10 px-1 rounded">PK</span>}
                                            {col.isForeignKey && <span className="text-[10px] text-blue-500 bg-blue-500/10 px-1 rounded">FK</span>}
                                        </div>
                                    </td>
                                    <td className="p-3 text-muted-foreground text-xs truncate">{col.dataType}</td>
                                    <td className="p-3">
                                        <Input 
                                            className="h-7 text-xs bg-transparent border-transparent hover:border-input focus:border-primary transition-colors" 
                                            placeholder="Name" 
                                            value={col.semanticName || ""} 
                                            onChange={(e) => handleColumnChange(col.id, 'semanticName', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-3">
                                        <Input 
                                            className="h-7 text-xs bg-transparent border-transparent hover:border-input focus:border-primary transition-colors" 
                                            placeholder="Description..." 
                                            value={col.description || ""} 
                                            onChange={(e) => handleColumnChange(col.id, 'description', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-3">
                                         <Input 
                                            className="h-7 text-xs w-20 bg-transparent border-transparent hover:border-input focus:border-primary transition-colors" 
                                            placeholder="-" 
                                            value={col.unit || ""} 
                                            onChange={(e) => handleColumnChange(col.id, 'unit', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                checked={col.isCode || false} 
                                                onChange={(e) => handleColumnChange(col.id, 'isCode', e.target.checked)}
                                                className="accent-primary h-4 w-4"
                                            />
                                            {col.isCode && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-6 w-6" 
                                                    title="Manage Codes"
                                                    onClick={() => openCodeManager(col)}
                                                >
                                                    <Tag className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                       <select 
                                         className="h-7 text-xs bg-transparent border-transparent hover:border-input focus:border-primary rounded w-full"
                                         value={col.sensitivityLevel}
                                         onChange={(e) => handleColumnChange(col.id, 'sensitivityLevel', e.target.value)}
                                       >
                                          <option value="PUBLIC">Public</option>
                                          <option value="INTERNAL">Internal</option>
                                          <option value="CONFIDENTIAL">Confid.</option>
                                          <option value="STRICT">Strict</option>
                                       </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="relationships" className="flex-1 overflow-auto bg-muted/5 mt-0">
                 <RelationshipManager tableId={table.id} dataSourceId={table.dataSourceId} />
            </TabsContent>
          </Tabs>
      </div>
    </div>

    {activeColumnForCodes && (
        <CodeValueManager 
            isOpen={codeManagerOpen}
            onClose={() => setCodeManagerOpen(false)}
            columnId={activeColumnForCodes.id}
            columnName={activeColumnForCodes.name}
        />
    )}
    </>
  );
}
