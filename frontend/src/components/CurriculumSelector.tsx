import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useCurriculum, type CurriculumItem } from '../context/CurriculumContext';

export default function CurriculumSelector() {
  const { curricula, activeCurriculum, switchCurriculum } = useCurriculum();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleSwitch = (item: CurriculumItem) => {
    if (item.status !== 'ready') return;
    const currentSlug = activeCurriculum?.slug;
    if (currentSlug) {
      const cur = localStorage.getItem('apex_active_section');
      if (cur) localStorage.setItem(`apex_draft_${currentSlug}`, cur);
    }
    switchCurriculum(item.slug);
    setOpen(false);
    const draft = localStorage.getItem(`apex_draft_${item.slug}`);
    if (draft) localStorage.setItem('apex_active_section', draft);
    else localStorage.removeItem('apex_active_section');
    navigate('/roadmap');
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const readyCurricula = curricula.filter(c => c.status === 'ready');
  const pendingCurricula = curricula.filter(c => c.status !== 'ready' && c.status !== 'error');

  if (curricula.length === 0) {
    return (
      <button
        onClick={() => navigate('/upload')}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
        style={{ background: 'rgba(208,188,255,0.1)', border: '1px solid rgba(208,188,255,0.2)' }}
      >
        <Plus size={14} className="text-primary" />
        <span className="text-on-surface">رفع مادة</span>
      </button>
    );
  }

  // Abbreviate name for icon label (first 2 words)
  const abbrev = (name: string) => name.split(/\s+/).slice(0, 2).join(' ');

  return (
    <div ref={ref} className="relative">
      {/* Trigger pill */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
        style={{
          background: open ? 'rgba(208,188,255,0.12)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${open ? 'rgba(208,188,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
        }}
      >
        <BookOpen size={14} className="text-primary shrink-0" />
        <span className="max-w-[130px] truncate text-[#e7e0ed] font-medium text-sm">
          {activeCurriculum?.name || 'اختر مادة'}
        </span>
        {curricula.length > 1 && (
          <span className="text-[10px] font-bold text-primary bg-primary/15 rounded-full w-4 h-4 flex items-center justify-center shrink-0">
            {curricula.length}
          </span>
        )}
      </button>

      {/* iOS-folder-style popup */}
      {open && (
        <div
          className="absolute top-full mt-2 right-0 z-50 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            width: 220,
            background: 'rgba(16,13,22,0.96)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
            <span className="text-[9px] text-[#5e5668] font-semibold tracking-widest uppercase">
              {readyCurricula.length}
            </span>
            <span className="text-[11px] font-semibold text-[#c8c0d4]">المواد الدراسية</span>
          </div>

          {/* Ready curricula — iOS app-icon grid */}
          {readyCurricula.length > 0 && (
            <div
              className="px-3 pb-2.5"
              style={{
                display: 'grid',
                gridTemplateColumns: readyCurricula.length === 1 ? '1fr 1fr' : 'repeat(3, 1fr)',
                gap: '10px',
              }}
            >
              {readyCurricula.map(item => {
                const isActive = item.slug === activeCurriculum?.slug;
                return (
                  <button
                    key={item.slug}
                    onClick={() => handleSwitch(item)}
                    className="flex flex-col items-center gap-1.5 relative group"
                  >
                    {/* App icon */}
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all relative ${
                        isActive ? 'ring-2 ring-primary/60' : 'group-hover:scale-105'
                      }`}
                      style={{
                        background: isActive
                          ? 'linear-gradient(135deg, rgba(208,188,255,0.25) 0%, rgba(173,198,255,0.2) 100%)'
                          : 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
                        border: isActive ? '1px solid rgba(208,188,255,0.3)' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <BookOpen size={18} className={isActive ? 'text-primary' : 'text-[#9aa5a5]'} />
                      {isActive && (
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle2 size={9} className="text-[#0d0b14]" />
                        </div>
                      )}
                    </div>
                    {/* Label */}
                    <span
                      className={`text-[9px] text-center leading-tight line-clamp-2 w-full px-0.5 ${
                        isActive ? 'text-primary font-semibold' : 'text-[#9aa5a5]'
                      }`}
                    >
                      {abbrev(item.name)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Processing */}
          {pendingCurricula.length > 0 && (
            <>
              <div className="px-3.5 py-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-[9px] text-[#5e5668] font-semibold tracking-widest uppercase">قيد التحليل</span>
              </div>
              <div className="px-3 pb-2 space-y-1">
                {pendingCurricula.map(item => (
                  <div key={item.slug} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <Loader2 size={11} className="text-primary animate-spin shrink-0" />
                    <p className="text-[10px] text-[#7a7285] truncate flex-1 text-right">{item.name}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Add new */}
          <button
            onClick={() => { setOpen(false); navigate('/upload'); }}
            className="w-full flex items-center gap-2 justify-center py-2.5 text-[12px] text-primary transition-all hover:bg-primary/8"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Plus size={13} />
            <span>رفع مادة جديدة</span>
          </button>
        </div>
      )}
    </div>
  );
}
