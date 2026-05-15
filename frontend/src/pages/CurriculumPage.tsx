import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Network, AlertTriangle, Sparkles, Zap, BarChart3, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { getCurriculumStats, getAllConcepts, type CurriculumStats, type L1Concept } from '../services/backend';
import AppShell from '../components/AppShell';

export default function CurriculumPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<CurriculumStats | null>(null);
  const [concepts, setConcepts] = useState<L1Concept[]>([]);
  const [expandedSec, setExpandedSec] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCurriculumStats(), getAllConcepts()]).then(([s, c]) => {
      setStats(s);
      setConcepts(c);
      setLoading(false);
    });
  }, []);

  if (loading || !stats) {
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
          {/* Book Title */}
          <div className="col-span-2 stat-card flex items-center justify-between text-right">
            <BookOpen size={28} className="text-primary"/>
            <div>
              <p className="text-xs text-on-surface-variant">الكتاب</p>
              <p className="text-lg font-semibold text-on-surface">{stats.book_title}</p>
              {stats.chapters > 0 && <p className="text-sm text-primary">فصول: {stats.chapters} · أقسام: {stats.sections}</p>}
              {stats.concepts === 0 && <p className="text-sm text-error">⚠ لا يوجد محتوى — جرّب رفع PDF آخر</p>}
            </div>
          </div>
          {/* Concepts */}
          <div className="stat-card stat-card-accent">
            <p className="text-xs text-on-surface-variant mb-1">المفاهيم</p>
            <p className="text-4xl font-bold text-primary">{stats.concepts}</p>
            <p className="text-xs text-primary">{stats.core_concepts} أساسي</p>
          </div>
          {/* Exercises */}
          <div className="stat-card">
            <BarChart3 size={22} className="text-secondary mx-auto mb-1"/>
            <p className="text-xs text-on-surface-variant mb-1">التمارين</p>
            <p className="text-3xl font-bold text-on-surface">{stats.exercises}</p>
          </div>
        </div>

        {/* Second Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="stat-card flex items-center gap-3 justify-end text-right" style={{borderColor: 'rgba(255,184,105,0.2)', background: 'rgba(255,184,105,0.06)'}}>
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

        {/* Difficulty Distribution */}
        <div className="glass-card rounded-2xl p-4 mb-6">
          <p className="text-sm font-medium text-right mb-3 text-on-surface">توزيع الصعوبة</p>
          <div className="flex gap-2 h-4 rounded-full overflow-hidden">
            <div className="bg-tertiary rounded-full transition-all" style={{width:`${(stats.difficulty_distribution.easy/stats.concepts)*100}%`}} title={`سهل: ${stats.difficulty_distribution.easy}`}/>
            <div className="rounded-full transition-all" style={{width:`${(stats.difficulty_distribution.medium/stats.concepts)*100}%`, background:'#ffb869'}} title={`متوسط: ${stats.difficulty_distribution.medium}`}/>
            <div className="bg-error rounded-full transition-all" style={{width:`${(stats.difficulty_distribution.hard/stats.concepts)*100}%`}} title={`صعب: ${stats.difficulty_distribution.hard}`}/>
          </div>
          <div className="flex justify-between mt-2 text-xs text-on-surface-variant">
            <span>صعب ({stats.difficulty_distribution.hard})</span>
            <span>متوسط ({stats.difficulty_distribution.medium})</span>
            <span>سهل ({stats.difficulty_distribution.easy})</span>
          </div>
        </div>

        {/* Sections Accordion */}
        <div className="mb-8">
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
                  {/* Section Header */}
                  <button
                    onClick={() => setExpandedSec(isOpen ? null : sec.id)}
                    className="accordion-header"
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronUp size={16} className="text-primary"/> : <ChevronDown size={16} className="text-on-surface-variant"/>}
                      <span className="text-xs text-on-surface-variant">{sec.concept_count} مفاهيم · {sec.exercise_count} تمرين</span>
                    </div>
                    <span className="font-medium text-sm text-on-surface">{sec.title}</span>
                  </button>

                  {/* Concepts List */}
                  {isOpen && (
                    <div className="px-4 pb-4 space-y-2">
                      {secCons.map(con => (
                        <div key={con.id} className="p-3 rounded-lg flex items-center justify-between bg-surface-container/30 border border-outline-variant/10">
                          <div className="flex items-center gap-3">
                            {/* Difficulty badge */}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              con.difficulty_level < 0.35 ? 'bg-tertiary/10 text-tertiary' :
                              con.difficulty_level < 0.65 ? 'bg-[#ffb869]/10 text-[#ffb869]' :
                              'bg-error/10 text-error'
                            }`}>
                              {con.difficulty_level < 0.35 ? 'سهل' : con.difficulty_level < 0.65 ? 'متوسط' : 'صعب'}
                            </span>
                            {con.is_core && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">أساسي</span>
                            )}
                            {con.prerequisites?.length > 0 && (
                              <span className="text-[10px] text-on-surface-variant">→ {con.prerequisites.length} متطلب</span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-on-surface">{con.name}</p>
                            <p className="text-xs text-on-surface-variant truncate max-w-[350px]">{con.description.slice(0, 80)}...</p>
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

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={() => navigate('/roadmap')}
            className="btn-primary py-3.5 px-12 rounded-xl text-base inline-flex"
          >
            عرض خارطة الطريق
          </button>
        </div>
      </div>
    </AppShell>
  );
}
