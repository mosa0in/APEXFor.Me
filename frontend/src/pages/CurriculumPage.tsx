import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Network, AlertTriangle, Sparkles, Zap, BarChart3, Brain, ChevronDown, ChevronUp, CloudUpload, ExternalLink, Star, Link2 } from 'lucide-react';
import { getCurriculumStats, getAllConcepts, getAuthHeader, type CurriculumStats, type L1Concept } from '../services/backend';
import { useCurriculum } from '../context/CurriculumContext';
import AppShell from '../components/AppShell';

const API = import.meta.env.VITE_API_URL ?? '';

interface ExternalConcept {
  concept_id: string;
  name: string;
  description: string;
  relation_type: 'prerequisite' | 'related' | 'extension';
  priority: 1 | 2 | 3;
  insert_after: string;
  question: { question_text: string; question_type: string; difficulty: string };
}

const PRIORITY_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: 'ضروري', color: 'text-error bg-error/10' },
  2: { label: 'مفيد', color: 'text-[#ffb869] bg-[#ffb869]/10' },
  3: { label: 'إثرائي', color: 'text-tertiary bg-tertiary/10' },
};
const RELATION_LABEL: Record<string, string> = {
  prerequisite: 'متطلب سابق',
  related: 'مرتبط',
  extension: 'تعمق',
};

export default function CurriculumPage() {
  const navigate = useNavigate();
  const { activeSlug, loading: ctxLoading } = useCurriculum();
  const [stats, setStats] = useState<CurriculumStats | null>(null);
  const [concepts, setConcepts] = useState<L1Concept[]>([]);
  const [extConcepts, setExtConcepts] = useState<ExternalConcept[]>([]);
  const [extLoading, setExtLoading] = useState(false);
  const [expandedSec, setExpandedSec] = useState<string | null>(null);
  const [extOpen, setExtOpen] = useState(false);
  const [selectedExtId, setSelectedExtId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ctxLoading) return;
    if (!activeSlug) { setLoading(false); return; }

    setLoading(true);
    Promise.all([getCurriculumStats(activeSlug), getAllConcepts(activeSlug)]).then(([s, c]) => {
      setStats(s);
      setConcepts(c);
      setLoading(false);
    });

    // Fetch external concepts (non-blocking)
    setExtLoading(true);
    fetch(`${API}/api/diagnostic/${activeSlug}/external-concepts`, { headers: getAuthHeader() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setExtConcepts(d.external_concepts || []); })
      .catch(() => {})
      .finally(() => setExtLoading(false));
  }, [activeSlug, ctxLoading]);

  if (ctxLoading || (loading && activeSlug)) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <Brain className="text-primary mx-auto mb-4 animate-pulse" size={48}/>
            <p className="text-on-surface-variant">جاري تحميل بيانات المنهج...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!activeSlug || !stats) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-32 text-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <BookOpen size={36} className="text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-on-surface mb-2">لا يوجد منهج بعد</h2>
            <p className="text-on-surface-variant max-w-sm">ارفع كتابك الدراسي PDF وسيقوم الذكاء الاصطناعي ببناء خارطة طريق التعليمية تلقائياً.</p>
          </div>
          <button onClick={() => navigate('/upload')} className="btn-primary py-3 px-8 rounded-xl inline-flex items-center gap-2">
            <CloudUpload size={18} />
            <span>ارفع منهجاً الآن</span>
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-transition">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm text-on-surface-variant mb-4 bg-surface-container/50 border border-primary/10">
            <Sparkles size={14} className="text-secondary"/>
            <span>مُستخرج تلقائياً من PDF بالذكاء الاصطناعي</span>
          </div>
          <h1 className="text-3xl font-bold text-on-surface mb-2">ذكاء المنهج الدراسي</h1>
          <p className="text-on-surface-variant max-w-lg mx-auto">تحليل ذكي يعتمد على خرائط المعرفة لتفكيك المنهج وبناء مسار تعلم مثالي.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="col-span-2 stat-card flex items-center justify-between text-right">
            <BookOpen size={28} className="text-primary"/>
            <div>
              <p className="text-xs text-on-surface-variant">الكتاب</p>
              <p className="text-lg font-semibold text-on-surface">{stats.book_title}</p>
              {stats.chapters > 0 && <p className="text-sm text-primary">فصول: {stats.chapters} · أقسام: {stats.sections}</p>}
            </div>
          </div>
          <div className="stat-card stat-card-accent">
            <p className="text-xs text-on-surface-variant mb-1">المفاهيم</p>
            <p className="text-4xl font-bold text-primary">{stats.concepts}</p>
            <p className="text-xs text-primary">{stats.core_concepts} أساسي</p>
          </div>
          <div className="stat-card">
            <BarChart3 size={22} className="text-secondary mx-auto mb-1"/>
            <p className="text-xs text-on-surface-variant mb-1">التمارين</p>
            <p className="text-3xl font-bold text-on-surface">{stats.exercises}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="stat-card flex items-center gap-3 justify-end text-right" style={{borderColor:'rgba(255,184,105,0.2)',background:'rgba(255,184,105,0.06)'}}>
            <div>
              <p className="text-xs text-on-surface-variant">المتطلبات السابقة</p>
              <p className="text-xl font-bold" style={{color:'#ffb869'}}>{stats.prerequisites_count} مفهوم مترابط</p>
            </div>
            <AlertTriangle size={22} style={{color:'#ffb869'}}/>
          </div>
          <div className="stat-card flex items-center gap-3 justify-end text-right">
            <div>
              <p className="text-xs text-on-surface-variant">الأقسام</p>
              <p className="text-xl font-bold text-on-surface">{stats.sections} أقسام</p>
            </div>
            <Network size={22} className="text-secondary"/>
          </div>
          <div className="stat-card flex items-center gap-3 justify-end text-right">
            <div>
              <p className="text-xs text-on-surface-variant">متوسط الصعوبة</p>
              <p className="text-xl font-bold text-on-surface">{(stats.difficulty_avg * 100).toFixed(0)}%</p>
            </div>
            <Zap size={22} className="text-primary"/>
          </div>
        </div>

        {/* Difficulty bar */}
        <div className="glass-card rounded-2xl p-4 mb-8">
          <p className="text-sm font-medium text-right mb-3 text-on-surface">توزيع الصعوبة</p>
          <div className="flex gap-2 h-4 rounded-full overflow-hidden">
            <div className="bg-tertiary rounded-full" style={{width:`${(stats.difficulty_distribution.easy/stats.concepts)*100}%`}}/>
            <div className="rounded-full" style={{width:`${(stats.difficulty_distribution.medium/stats.concepts)*100}%`,background:'#ffb869'}}/>
            <div className="bg-error rounded-full" style={{width:`${(stats.difficulty_distribution.hard/stats.concepts)*100}%`}}/>
          </div>
          <div className="flex justify-between mt-2 text-xs text-on-surface-variant">
            <span>صعب ({stats.difficulty_distribution.hard})</span>
            <span>متوسط ({stats.difficulty_distribution.medium})</span>
            <span>سهل ({stats.difficulty_distribution.easy})</span>
          </div>
        </div>

        {/* ── TWO COLUMNS ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">

          {/* Column 1 — Internal Sections (wider) */}
          <div className="lg:col-span-3">
            <h2 className="text-lg font-semibold text-right mb-4 flex items-center gap-2 justify-end text-on-surface">
              <span>أقسام المنهج</span>
              <BookOpen size={18} className="text-primary"/>
            </h2>
            <div className="space-y-3">
              {stats.sections_data.map(sec => {
                const secCons = sec.concept_ids?.length
                  ? concepts.filter(c => sec.concept_ids!.includes(c.id))
                  : concepts.filter(c => c.section_title === sec.title);
                const isOpen = expandedSec === sec.id;
                return (
                  <div key={sec.id} className="accordion-item">
                    <button onClick={() => setExpandedSec(isOpen ? null : sec.id)} className="accordion-header">
                      <div className="flex items-center gap-2">
                        {isOpen ? <ChevronUp size={16} className="text-primary"/> : <ChevronDown size={16} className="text-on-surface-variant"/>}
                        <span className="text-xs text-on-surface-variant">{sec.concept_count} مفاهيم · {sec.exercise_count} تمرين</span>
                      </div>
                      <span className="font-medium text-sm text-on-surface">{sec.title}</span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 space-y-2">
                        {secCons.map(con => (
                          <div key={con.id} className="p-3 rounded-lg flex items-center justify-between bg-surface-container/30 border border-outline-variant/10">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                con.difficulty_level < 0.35 ? 'bg-tertiary/10 text-tertiary' :
                                con.difficulty_level < 0.65 ? 'bg-[#ffb869]/10 text-[#ffb869]' :
                                'bg-error/10 text-error'
                              }`}>
                                {con.difficulty_level < 0.35 ? 'سهل' : con.difficulty_level < 0.65 ? 'متوسط' : 'صعب'}
                              </span>
                              {con.is_core && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">أساسي</span>}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-on-surface">{con.name}</p>
                              <p className="text-xs text-on-surface-variant truncate max-w-[260px]">{con.description?.slice(0, 80)}...</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2 — External Concepts compact collapsible folder */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-right mb-4 flex items-center gap-2 justify-end text-on-surface">
              <span>مفاهيم خارجية مقترحة</span>
              <ExternalLink size={18} className="text-secondary"/>
            </h2>

            {extLoading ? (
              <div className="glass-card rounded-2xl p-4 animate-pulse space-y-3">
                <div className="h-4 bg-surface-container-high rounded w-2/3 ml-auto"/>
                <div className="flex gap-2 flex-wrap justify-end">
                  {[1,2,3].map(i => <div key={i} className="h-5 w-14 bg-surface-container-high rounded-full"/>)}
                </div>
              </div>
            ) : extConcepts.length === 0 ? (
              <div className="glass-card rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
                <Brain size={24} className="text-on-surface-variant/40"/>
                <p className="text-xs text-on-surface-variant/60">ستظهر المفاهيم بعد اكتمال التوليد</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(16,13,22,0.7)', border: '1px solid rgba(255,255,255,0.08)' }}>

                {/* Folder header / toggle */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-right transition-colors hover:bg-white/[0.03]"
                  onClick={() => setExtOpen(o => !o)}
                >
                  <span className="flex items-center gap-1.5">
                    {extOpen
                      ? <ChevronUp size={14} className="text-secondary"/>
                      : <ChevronDown size={14} className="text-on-surface-variant"/>}
                    <span className="text-[11px] text-on-surface-variant">{extConcepts.length} مفهوم</span>
                  </span>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {[1,2,3].map(p => {
                      const count = extConcepts.filter(e => e.priority === p).length;
                      if (!count) return null;
                      const { label, color } = PRIORITY_LABEL[p];
                      return <span key={p} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${color}`}>{count} {label}</span>;
                    })}
                    <span className="text-sm font-semibold text-on-surface">مفاهيم مقترحة</span>
                  </div>
                </button>

                {/* Expandable concept grid */}
                {extOpen && (
                  <div className="px-3 pb-3 border-t border-white/[0.06]">
                    <div
                      className="grid gap-2 mt-3"
                      style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
                    >
                      {extConcepts.map((ec, i) => {
                        const isSelected = selectedExtId === ec.concept_id;
                        const accentColor =
                          ec.relation_type === 'prerequisite' ? '#ef4444' :
                          ec.relation_type === 'extension'    ? '#d0bcff' : '#ffb869';
                        const accentRgba =
                          ec.relation_type === 'prerequisite' ? 'rgba(239,68,68,' :
                          ec.relation_type === 'extension'    ? 'rgba(208,188,255,' : 'rgba(255,184,105,';
                        return (
                          <button
                            key={ec.concept_id}
                            onClick={() => setSelectedExtId(isSelected ? null : ec.concept_id)}
                            className="flex flex-col items-center gap-1 group"
                            style={{ animation: `fadeUp 0.2s ease-out ${i * 0.03}s both` }}
                          >
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-105"
                              style={{
                                background: isSelected
                                  ? `linear-gradient(135deg, ${accentRgba}0.18) 0%, rgba(255,255,255,0.04) 100%)`
                                  : 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)',
                                border: `1.5px solid ${isSelected ? accentColor : 'rgba(255,255,255,0.08)'}`,
                                boxShadow: isSelected ? `0 0 10px ${accentRgba}0.35)` : 'none',
                              }}
                            >
                              <Sparkles size={15} style={{ color: accentColor }} />
                            </div>
                            <span className="text-[8px] text-center leading-tight line-clamp-2 text-on-surface-variant w-full px-0.5">
                              {ec.name.split(/\s+/).slice(0, 3).join(' ')}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected concept detail panel */}
                    {selectedExtId && (() => {
                      const ec = extConcepts.find(e => e.concept_id === selectedExtId);
                      if (!ec) return null;
                      const p = PRIORITY_LABEL[ec.priority] || PRIORITY_LABEL[2];
                      return (
                        <div
                          className="mt-3 p-3 rounded-xl text-right"
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            animation: 'fadeUp 0.15s ease-out',
                          }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${p.color}`}>{p.label} · {RELATION_LABEL[ec.relation_type] || ec.relation_type}</span>
                            <p className="text-xs font-bold text-on-surface">{ec.name}</p>
                          </div>
                          <p className="text-[10px] text-on-surface-variant leading-relaxed mb-2">
                            {ec.description?.slice(0, 150)}{ec.description?.length > 150 ? '...' : ''}
                          </p>
                          {ec.question?.question_text && (
                            <div className="pt-2 border-t border-white/[0.06]">
                              <p className="text-[9px] text-secondary mb-1">سؤال تشخيصي</p>
                              <p className="text-[10px] text-on-surface-variant/80 leading-relaxed">
                                {ec.question.question_text.slice(0, 100)}{ec.question.question_text.length > 100 ? '...' : ''}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button onClick={() => navigate('/roadmap')} className="btn-primary py-3.5 px-12 rounded-xl text-base inline-flex">
            عرض خارطة الطريق
          </button>
        </div>
      </div>
    </AppShell>
  );
}
