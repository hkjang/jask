"use client"; 

import { Button } from "@/components/ui/button";
import { Database, Table, Search, MoreHorizontal, Pencil, Trash2, Plus, Sparkles, FileSymlink, Circle, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle } from "lucide-react";

interface MetadataSidebarProps {
  dataSources: any[];
  selectedDataSource: any;
  onSelectDataSource: (ds: any) => void;
  onRefreshDataSources: () => void; // Callback to refresh list after update/delete
  tables: any[];
  selectedTableId: string | null;
  onSelectTable: (id: string) => void;
}

export function MetadataSidebar({
  dataSources,
  selectedDataSource,
  onSelectDataSource,
  onRefreshDataSources,
  tables,
  selectedTableId,
  onSelectTable,
}: MetadataSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const { toast } = useToast();
  const router = useRouter();

  // State for Edit Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDataSource, setEditingDataSource] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    type: "postgresql",
    host: "",
    port: 5432,
    database: "",
    username: "",
    password: "",
    schema: "public"
  });
  const [isTesting, setIsTesting] = useState(false);
  
  // State for Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dataSourceToDelete, setDataSourceToDelete] = useState<any>(null);


  const filteredTables = tables.filter(t => {
    const matchesSearch = t.tableName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || (t.metadataStatus || 'DRAFT') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleEditClick = (ds: any) => {
      setEditingDataSource(ds);
      setEditForm({ 
        name: ds.name || "", 
        description: ds.description || "",
        type: ds.type || "postgresql",
        host: ds.host || "localhost",
        port: ds.port || 5432,
        database: ds.database || "",
        username: ds.username || "",
        password: "", // Don't show existing password
        schema: ds.schema || "public"
      });
      setEditDialogOpen(true);
  };

  const confirmDeleteClick = (ds: any) => {
      setDataSourceToDelete(ds);
      setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
      if (!dataSourceToDelete) return;
      try {
          await api.deleteDataSource(dataSourceToDelete.id);
          toast({ title: "Deleted", description: "Data source deleted." });
          if (selectedDataSource?.id === dataSourceToDelete.id) {
              onSelectDataSource(null);
          }
          onRefreshDataSources();
          setDeleteDialogOpen(false);
          setDataSourceToDelete(null);
      } catch (e: any) {
          toast({ title: "Error", description: e.message || "Failed to delete data source", variant: "destructive" });
      }
  };

  const handleTestConnection = async () => {
      setIsTesting(true);
      try {
          await api.testConnection(editForm);
          toast({ title: "Connection Successful", description: "Successfully connected to the database." });
      } catch (e: any) {
          toast({ title: "Connection Failed", description: e.message || "Failed to connect.", variant: "destructive" });
      } finally {
          setIsTesting(false);
      }
  };

  const handleSaveEdit = async () => {
      if (!editingDataSource) return;
      try {
          const updateData: any = { ...editForm };
          if (!updateData.password) delete updateData.password; // Don't send empty password if not changed

          await api.updateDataSource(editingDataSource.id, updateData);
          toast({ title: "Updated", description: "Data source updated." });
          setEditDialogOpen(false);
          onRefreshDataSources();
      } catch (e: any) {
          console.error(e);
          toast({ title: "Error", description: e.message || "Failed to update data source", variant: "destructive" });
      }
  };

  const handleTranslateMetadata = async (ds: any) => {
    try {
      toast({ title: "Translation Started", description: "AI is translating metadata. This may take a while." });
      await api.translateMetadata(ds.id);
      toast({ title: "Translation Completed", description: "Metadata has been translated." });
      onRefreshDataSources(); // Refresh to show new descriptions? Or maybe we need to refresh tables explicitly if they are loaded separately.
      // Ideally we should reload tables for the selected datasource if it matches.
      if (selectedDataSource?.id === ds.id) {
          onSelectDataSource(ds); // Re-trigger selection logic to fetch tables
          // actually onSelectDataSource might just set state. check implementation.
          // The parent likely handles fetching tables. We might need a way to trigger parent refresh.
          // onRefreshDataSources is for the list of datasources. 
          // If tables are passed as props, parent needs to refresh. 
          // onRefreshDataSources might be enough if parent refetches everything.
      }
    } catch (e: any) {
      toast({ title: "Translation Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleCreateClick = () => {
      // For create, redirect to main datasources page as it's complex 
      // OR implement simple create here. 
      // Context implies "Connected ones CUD".. usually implies management.
      // Redirecting is safer for consistent flows.
      router.push('/datasources');
  };

  return (
    <>
    <div className="w-72 border-r bg-muted/10 flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex justify-between items-center">
            <h2 className="font-semibold flex items-center gap-2">
            <Database className="h-4 w-4" /> Data Sources
            </h2>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCreateClick} title="Manage/Create Data Sources">
                <Plus className="h-4 w-4" />
            </Button>
        </div>
        
        {/* DataSource Selector List */}
        <div className="flex flex-col gap-1 overflow-y-auto max-h-[150px]">
           {dataSources.map((ds) => (
             <div key={ds.id} className="flex items-center gap-1 group">
                 <Button 
                    variant={selectedDataSource?.id === ds.id ? "default" : "outline"}
                    className="flex-1 h-8 text-xs justify-start truncate"
                    onClick={() => onSelectDataSource(ds)}
                    >
                    {ds.name}
                 </Button>
                 <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                             <MoreHorizontal className="h-3 w-3" />
                         </Button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditClick(ds)}>
                              <Pencil className="h-3 w-3 mr-2" /> Edit Info
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTranslateMetadata(ds)}>
                              <Sparkles className="h-3 w-3 mr-2" /> Translate (AI)
                          </DropdownMenuItem>
                         <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => confirmDeleteClick(ds)}>
                             <Trash2 className="h-3 w-3 mr-2" /> Delete
                         </DropdownMenuItem>
                     </DropdownMenuContent>
                 </DropdownMenu>
             </div>
           ))}
        </div>
      </div>
      
      {selectedDataSource ? (
        <div className="flex-1 flex flex-col overflow-hidden">
           <div className="p-2 border-b space-y-2 bg-slate-50/50">
               <Button 
                   variant={selectedTableId === '__SAMPLE_QUERIES__' ? "secondary" : "outline"}
                   className="w-full justify-start text-xs h-8 border-dashed bg-white"
                   onClick={() => onSelectTable('__SAMPLE_QUERIES__')}
               >
                   <FileSymlink className="h-3.5 w-3.5 mr-2 text-primary" />
                   Manage Sample Queries
               </Button>
               <div className="relative">
                   <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                   <Input 
                     placeholder="Search tables..." 
                     className="h-8 pl-8 text-xs bg-background"
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                   />
               </div>
               
               <Select value={statusFilter} onValueChange={setStatusFilter}>
                   <SelectTrigger className="h-7 text-xs w-full">
                       <SelectValue placeholder="All Status" />
                   </SelectTrigger>
                   <SelectContent>
                       <SelectItem value="ALL">All Status</SelectItem>
                       <SelectItem value="DRAFT">Draft</SelectItem>
                       <SelectItem value="PENDING_REVIEW">Review Needed</SelectItem>
                       <SelectItem value="VERIFIED">Verified</SelectItem>
                   </SelectContent>
               </Select>
           </div>
           <div className="flex-1 overflow-auto p-2 space-y-0.5">
             <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-1 flex justify-between">
               <span>Tables ({filteredTables.length})</span>
             </div>
             {filteredTables.map((t) => (
                <Button
                  key={t.id}
                  variant={selectedTableId === t.id ? "secondary" : "ghost"}
                  size="sm"
                  className={`w-full justify-start text-xs h-8 ${t.isExcluded ? 'opacity-50 line-through' : ''}`}
                  onClick={() => onSelectTable(t.id)}
                >
                  <StatusIcon status={t.metadataStatus} score={t.completenessScore} />
                  <span className="truncate flex-1 text-left ml-2">{t.tableName}</span>
                  {t.importanceLevel === 'HIGH' && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 ml-1" />}
                  {t.importanceLevel === 'CRITICAL' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 ml-1" />}
                </Button>
             ))}
           </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
           Select a data source to view tables.
        </div>
      )}
    </div>

    {/* Edit Dialog */}
    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Edit Data Source</DialogTitle>
                <DialogDescription>Update the connection details.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={editForm.type} onValueChange={(val) => setEditForm({...editForm, type: val})}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                                <SelectItem value="mysql">MySQL</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Host</Label>
                        <Input value={editForm.host} onChange={(e) => setEditForm({...editForm, host: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Port</Label>
                        <Input type="number" value={editForm.port} onChange={(e) => setEditForm({...editForm, port: parseInt(e.target.value) || 0})} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Database</Label>
                        <Input value={editForm.database} onChange={(e) => setEditForm({...editForm, database: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Schema</Label>
                        <Input value={editForm.schema} onChange={(e) => setEditForm({...editForm, schema: e.target.value})} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Username</Label>
                        <Input value={editForm.username} onChange={(e) => setEditForm({...editForm, username: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Password</Label>
                        <Input type="password" placeholder="Leave empty to keep current" value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})} />
                    </div>
                </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
                 <Button type="button" variant="outline" onClick={handleTestConnection} disabled={isTesting} className="mr-auto">
                    {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Test Connection
                </Button>
                <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveEdit}>Save Changes</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    {/* Delete Alert Dialog */}
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the data source 
                    <span className="font-semibold text-foreground"> {dataSourceToDelete?.name} </span>
                    and remove all associated metadata.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

function StatusIcon({ status, score }: { status?: string, score?: number }) {
    if (status === 'VERIFIED') {
        return <CheckCircle className="h-3 w-3 text-green-500" />;
    }
    if (status === 'PENDING_REVIEW' || (score && score > 50 && score < 90)) {
        return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
    }
    return <Circle className="h-3 w-3 text-muted-foreground" />;
}
