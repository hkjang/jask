"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Plus, Trash2, Save, GripVertical } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface CodeValueManagerProps {
  columnId: string;
  columnName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CodeValueManager({ columnId, columnName, isOpen, onClose }: CodeValueManagerProps) {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && columnId) {
      loadCodes();
    }
  }, [isOpen, columnId]);

  const loadCodes = async () => {
    setLoading(true);
    try {
      const data = await api.getCodeValues(columnId);
      setCodes(data);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load code values", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCode = async () => {
    // Add a temporary empty row or handle via direct API?
    // Let's add local state and save individual rows.
    const newCode = {
        id: 'new-' + Date.now(),
        code: '',
        value: '',
        description: '',
        isActive: true,
        displayOrder: codes.length + 1,
        isNew: true
    };
    setCodes([...codes, newCode]);
  };

  const handleSaveCode = async (codeItem: any) => {
    if (!codeItem.code || !codeItem.value) {
        toast({ title: "Validation Error", description: "Code and Value are required.", variant: "destructive" });
        return;
    }

    try {
        if (codeItem.isNew) {
            const res = await api.createCodeValue(columnId, {
                code: codeItem.code,
                value: codeItem.value,
                description: codeItem.description,
                displayOrder: parseInt(codeItem.displayOrder) || 0
            });
            // Replace local item with server response
            setCodes(codes.map(c => c.id === codeItem.id ? res : c));
            toast({ title: "Created", description: "Code value created." });
        } else {
            const res = await api.updateCodeValue(codeItem.id, {
                code: codeItem.code,
                value: codeItem.value,
                description: codeItem.description,
                isActive: codeItem.isActive,
                displayOrder: parseInt(codeItem.displayOrder) || 0
            });
             setCodes(codes.map(c => c.id === codeItem.id ? res : c));
             toast({ title: "Updated", description: "Code value updated." });
        }
    } catch (e) {
        toast({ title: "Error", description: "Failed to save code value", variant: "destructive" });
    }
  };

  const handleDeleteCode = async (id: string, isNew: boolean) => {
      if (isNew) {
          setCodes(codes.filter(c => c.id !== id));
          return;
      }
      if (!confirm("Are you sure you want to delete this code value?")) return;
      try {
          await api.deleteCodeValue(id);
          setCodes(codes.filter(c => c.id !== id));
          toast({ title: "Deleted", description: "Code value deleted." });
      } catch (e) {
         toast({ title: "Error", description: "Failed to delete code value", variant: "destructive" });
      }
  };

  const handleChange = (id: string, field: string, value: any) => {
      setCodes(codes.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Code Values: {columnName}</DialogTitle>
          <DialogDescription>
            Define allowed values and their meanings for this column. This helps AI understand cryptic codes (e.g., 'Y' = 'Yes').
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto py-4">
             <div className="border rounded-md">
                <table className="w-full text-sm">
                    <thead className="bg-muted text-muted-foreground sticky top-0">
                        <tr>
                            <th className="p-2 w-10">#</th>
                            <th className="p-2 text-left">Code</th>
                            <th className="p-2 text-left">Value (Meaning)</th>
                            <th className="p-2 text-left">Description</th>
                            <th className="p-2 text-center w-16">Active</th>
                            <th className="p-2 w-24">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading && <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr>}
                        {!loading && codes.length === 0 && (
                            <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No codes defined. Add one below.</td></tr>
                        )}
                        {codes.map((code, idx) => (
                            <tr key={code.id} className="hover:bg-muted/50">
                                <td className="p-2 text-center text-muted-foreground">
                                    <Input 
                                        className="h-7 w-12 text-center p-0" 
                                        type="number"
                                        value={code.displayOrder}
                                        onChange={(e) => handleChange(code.id, 'displayOrder', e.target.value)}
                                    />
                                </td>
                                <td className="p-2">
                                    <Input 
                                        className="h-8" 
                                        placeholder="Code (e.g. Y)" 
                                        value={code.code} 
                                        onChange={(e) => handleChange(code.id, 'code', e.target.value)}
                                    />
                                </td>
                                <td className="p-2">
                                    <Input 
                                        className="h-8" 
                                        placeholder="Meaning (e.g. Active)" 
                                        value={code.value}
                                        onChange={(e) => handleChange(code.id, 'value', e.target.value)}
                                    />
                                </td>
                                <td className="p-2">
                                    <Input 
                                        className="h-8" 
                                        placeholder="Optional description" 
                                        value={code.description || ''}
                                        onChange={(e) => handleChange(code.id, 'description', e.target.value)}
                                    />
                                </td>
                                <td className="p-2 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={code.isActive} 
                                        onChange={(e) => handleChange(code.id, 'isActive', e.target.checked)}
                                        className="h-4 w-4 accent-primary"
                                    />
                                </td>
                                <td className="p-2 flex gap-1 justify-center">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleSaveCode(code)}>
                                        <Save className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteCode(code.id, code.isNew)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
        </div>

        <DialogFooter className="justify-between sm:justify-between items-center">
             <Button variant="outline" size="sm" onClick={handleAddCode}>
                <Plus className="h-4 w-4 mr-2" />
                Add Code Value
             </Button>
             <Button variant="secondary" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
