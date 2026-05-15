import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface CurriculumItem {
  id: number;
  slug: string;
  name: string;
  book_title: string;
  language: string;
  total_concepts: number;
  total_exercises: number;
  total_sections: number;
  status: 'processing' | 'ready' | 'error' | 'analyzing_pdf' | 'enriching' | 'storing';
  error_message?: string;
  created_at: string;
}

interface CurriculumContextType {
  curricula: CurriculumItem[];
  activeCurriculum: CurriculumItem | null;
  activeSlug: string | null;
  loading: boolean;
  switchCurriculum: (slug: string) => void;
  refreshCurricula: () => Promise<void>;
}

const API = import.meta.env.VITE_API_URL ?? '';

// ═══════════════════════════════════════════
// Context
// ═══════════════════════════════════════════

const CurriculumContext = createContext<CurriculumContextType>({
  curricula: [],
  activeCurriculum: null,
  activeSlug: null,
  loading: true,
  switchCurriculum: () => {},
  refreshCurricula: async () => {},
});

export function CurriculumProvider({ children }: { children: ReactNode }) {
  const [curricula, setCurricula] = useState<CurriculumItem[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(
    localStorage.getItem('apex_active_curriculum') || null
  );
  const [loading, setLoading] = useState(true);

  const fetchCurricula = async () => {
    try {
      const currentStudent = localStorage.getItem('apex_current_student') || '';
      const url = currentStudent
        ? `${API}/api/curricula?student_id=${encodeURIComponent(currentStudent)}`
        : `${API}/api/curricula`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CurriculumItem[] = await res.json();
      setCurricula(data);

      // Auto-select first ready curriculum WITH actual content if none selected
      if (!activeSlug || !data.find(c => c.slug === activeSlug && c.status === 'ready' && c.total_concepts > 0)) {
        const ready = data.find(c => c.status === 'ready' && c.total_concepts > 0 && c.total_sections > 0);
        if (ready) {
          setActiveSlug(ready.slug);
          localStorage.setItem('apex_active_curriculum', ready.slug);
        }
      }

      // If any curriculum is processing, poll again in 3s
      if (data.some(c => ['processing', 'analyzing_pdf', 'enriching', 'storing'].includes(c.status))) {
        setTimeout(fetchCurricula, 3000);
      }
    } catch (e) {
      console.warn('[Curriculum] API not available:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurricula();
  }, []);

  const switchCurriculum = (slug: string) => {
    setActiveSlug(slug);
    localStorage.setItem('apex_active_curriculum', slug);
  };

  const activeCurriculum = curricula.find(c => c.slug === activeSlug) || null;

  return (
    <CurriculumContext.Provider value={{
      curricula,
      activeCurriculum,
      activeSlug,
      loading,
      switchCurriculum,
      refreshCurricula: fetchCurricula,
    }}>
      {children}
    </CurriculumContext.Provider>
  );
}

export function useCurriculum() {
  return useContext(CurriculumContext);
}
