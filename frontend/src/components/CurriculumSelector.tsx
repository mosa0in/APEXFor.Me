import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronDown, Plus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useCurriculum, type CurriculumItem } from '../context/CurriculumContext';

export default function CurriculumSelector() {
  const { curricula, activeCurriculum, switchCurriculum } = useCurriculum();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const statusIcon = (item: CurriculumItem) => {
    if (item.status === 'ready') return <CheckCircle2 size={14} className="text-emerald-400" />;
    if (item.status === 'error') return <AlertCircle size={14} className="text-red-400" />;
    return <Loader2 size={14} className="text-cyan-300 animate-spin" />;
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      processing: 'جاري التحليل...',
      analyzing_pdf: 'تحليل PDF...',
      enriching: 'إثراء بالذكاء الاصطناعي...',
      storing: 'حفظ البيانات...',
      ready: 'جاهز',
      error: 'خطأ',
    };
    return map[s] || s;
  };

  if (curricula.length === 0) {
    return (
      <button
        onClick={() => navigate('/upload')}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
        style={{ background: 'rgba(140,237,243,0.1)', border: '1px solid rgba(140,237,243,0.2)' }}
      >
        <Plus size={14} className="text-cyan-300" />
        <span className="text-cyan-200">رفع مادة</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all hover:bg-white/10"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <BookOpen size={14} className="text-cyan-300" />
        <span className="max-w-[180px] truncate text-[#e7e0ed] font-medium">
          {activeCurriculum?.name || 'اختر مادة'}
        </span>
        <ChevronDown size={14} className={`text-[#bdc9c9] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full mt-2 right-0 w-72 rounded-xl overflow-hidden shadow-2xl z-50"
          style={{
            background: 'rgba(21,18,27,0.98)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <p className="text-xs text-[#958ea0] font-medium">المواد الدراسية</p>
          </div>

          {/* Items */}
          <div className="max-h-64 overflow-y-auto">
            {curricula.map(item => (
              <button
                key={item.slug}
                onClick={() => {
                  if (item.status === 'ready') {
                    switchCurriculum(item.slug);
                    setOpen(false);
                  }
                }}
                disabled={item.status !== 'ready'}
                className={`w-full px-4 py-3 flex items-center gap-3 justify-between text-right transition-all ${
                  item.slug === activeCurriculum?.slug
                    ? 'bg-cyan-500/10'
                    : item.status === 'ready'
                      ? 'hover:bg-white/5'
                      : 'opacity-60 cursor-not-allowed'
                }`}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div className="flex items-center gap-2">
                  {statusIcon(item)}
                  {item.status !== 'ready' && (
                    <span className="text-[10px] text-[#958ea0]">{statusLabel(item.status)}</span>
                  )}
                </div>
                <div className="flex-1 text-right min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    item.slug === activeCurriculum?.slug ? 'text-cyan-300' : 'text-[#e7e0ed]'
                  }`}>
                    {item.name}
                  </p>
                  <p className="text-[10px] text-[#958ea0]">
                    {item.total_concepts > 0 ? `${item.total_concepts} مفهوم · ${item.total_exercises} تمرين` : '—'}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Add New */}
          <button
            onClick={() => { setOpen(false); navigate('/upload'); }}
            className="w-full px-4 py-3 flex items-center gap-2 justify-center text-sm text-cyan-300 hover:bg-cyan-500/10 transition-all"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Plus size={14} />
            <span>رفع مادة جديدة</span>
          </button>
        </div>
      )}
    </div>
  );
}
