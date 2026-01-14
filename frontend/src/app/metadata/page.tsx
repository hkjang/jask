"use client";

import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

import { MetadataSidebar } from "./_components/metadata-sidebar";
import { MetadataBuilder } from "./_components/metadata-builder";
import { MetadataPreview } from "./_components/metadata-preview";
import { SampleQueryManager } from "./_components/sample-query-manager";

export default function MetadataPage() {
  const [dataSources, setDataSources] = useState<any[]>([]);
  const [selectedDataSource, setSelectedDataSource] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [schemaContext, setSchemaContext] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadDataSources();
  }, []);

  const loadDataSources = async () => {
    try {
      const data = await api.getDataSources();
      setDataSources(data);
    } catch (error) {
      console.error(error);
      toast({ title: "오류", description: "데이터 소스를 불러오는데 실패했습니다.", variant: "destructive" });
    }
  };

  const handleSelectDataSource = async (ds: any) => {
    setSelectedDataSource(ds);
    setSelectedTableId(null);
    setSchemaContext("");
    try {
      // Fetch Tables
      const tablesData = await api.getTables(ds.id);
      setTables(tablesData);
      
      // Fetch Context
      const { context } = await api.getSchemaContext(ds.id);
      setSchemaContext(context);
    } catch (error) {
      console.error(error);
      toast({ title: "오류", description: "메타데이터를 불러오는데 실패했습니다.", variant: "destructive" });
    }
  };

  const handleUpdateTable = async () => {
    if (selectedDataSource) {
        // Refresh context and tables to reflect changes
        // Using lightweight update might be better but for safety re-fetch
        try {
            const { context } = await api.getSchemaContext(selectedDataSource.id);
            setSchemaContext(context);
            // Optionally refresh tables list if name/desc changed in list view
             const tablesData = await api.getTables(selectedDataSource.id);
             setTables(tablesData);
        } catch(e) { console.error(e); }
    }
  };

  const selectedTable = tables.find((t: any) => t.id === selectedTableId);

  return (
    <MainLayout>
      <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col"> 
        {/* Adjust height if header is present in MainLayout (100vh) - sidebar is usually full height. 
            MainLayout main has flex-1 overflow-auto.
            We want to FILL that space. h-full should work if parent has height.
        */}
        <div className="flex flex-1 overflow-hidden h-full"> 
           <MetadataSidebar 
             dataSources={dataSources} 
             selectedDataSource={selectedDataSource} 
             onSelectDataSource={handleSelectDataSource}
             onRefreshDataSources={loadDataSources}
             tables={tables}
             selectedTableId={selectedTableId}
             onSelectTable={setSelectedTableId}
           />
           {selectedTableId === '__SAMPLE_QUERIES__' ? (
             <SampleQueryManager dataSourceId={selectedDataSource?.id} />
           ) : (
             <MetadataBuilder 
               table={selectedTable} 
               onUpdate={handleUpdateTable}
             />
           )}
           <MetadataPreview 
             dataSourceId={selectedDataSource?.id}
             context={schemaContext} 
           />
        </div>
      </div>
    </MainLayout>
  );
}
