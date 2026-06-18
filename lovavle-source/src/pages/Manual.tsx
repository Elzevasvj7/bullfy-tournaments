import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ManualSidebar from "@/components/manual/ManualSidebar";
import ManualViewer from "@/components/manual/ManualViewer";
import ManualEditor from "@/components/manual/ManualEditor";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export interface ManualSection {
  id: string;
  category: string;
  title: string;
  slug: string;
  content: string;
  icon: string;
  display_order: number;
  tags: string[];
  is_new: boolean;
  updated_at: string;
  created_at: string;
}

const Manual = () => {
  const [sections, setSections] = useState<ManualSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ManualSection | null>(null);
  const [creating, setCreating] = useState(false);
  const { isAdmin } = useAuth();

  const activeSlug = searchParams.get("s") || "";

  const fetchSections = async () => {
    const { data } = await supabase
      .from("manual_sections")
      .select("*")
      .order("category")
      .order("display_order");
    if (data) setSections(data as ManualSection[]);
    setLoading(false);
  };

  useEffect(() => { fetchSections(); }, []);

  const categories = useMemo(() => {
    const map = new Map<string, ManualSection[]>();
    sections.forEach((s) => {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    });
    return map;
  }, [sections]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    const map = new Map<string, ManualSection[]>();
    categories.forEach((items, cat) => {
      const filtered = items.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.content.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
      if (filtered.length) map.set(cat, filtered);
    });
    return map;
  }, [categories, search]);

  const activeSection = sections.find((s) => s.slug === activeSlug) || (sections.length ? sections[0] : null);

  const selectSection = (slug: string) => setSearchParams({ s: slug });

  const handleSaved = () => {
    setEditing(null);
    setCreating(false);
    fetchSections();
  };

  if (editing || creating) {
    return (
      <DashboardLayout>
        <ManualEditor
          section={editing}
          onCancel={() => { setEditing(null); setCreating(false); }}
          onSaved={handleSaved}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)]">
        <ManualSidebar
          categories={filteredCategories}
          activeSlug={activeSection?.slug || ""}
          onSelect={selectSection}
          search={search}
          onSearchChange={setSearch}
          loading={loading}
        />
        <div className="flex-1 overflow-y-auto">
          {isAdmin && (
            <div className="flex justify-end p-4 pb-0">
              <Button size="sm" onClick={() => setCreating(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Nueva sección
              </Button>
            </div>
          )}
          <ManualViewer
            section={activeSection}
            loading={loading}
            onEdit={isAdmin ? (s) => setEditing(s) : undefined}
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Manual;
