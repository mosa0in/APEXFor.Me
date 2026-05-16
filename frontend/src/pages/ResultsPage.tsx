import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Target, Clock, BarChart3, Sparkles, Brain, AlertTriangle, Lightbulb } from 'lucide-react';
import AppShell from '../components/AppShell';
import { useCurriculum } from '../context/CurriculumContext';
import { getAuthHeader } from '../services/backend';

const API = import.meta.env.VITE_API_URL ?? '';

interface ConceptResult {
  name: string;
  mastery: number;
  correct: boolean;
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const studentId = localStorage.getItem('apex_current_student') || '';
  const { activeSlug } = useCurriculum();
  const [accuracy, setAccuracy] = useState(0);
  const [timeMin, setTimeMin] = useState(0);
  const [totalQ, setTotalQ] = useState(0);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [concepts, setConcepts] = useState<ConceptResult[]>([]);
  const [mindsetGaps, setMindsetGaps] = useState<any[]>([]);
  const [personalityTraits, setPersonalityTraits] = useState<any>({});

  useEffect(() => {
    if (!studentId) { navigate('/'); return; }
    loadResults();
  }, [studentId, navigate, activeSlug]);

  async function loadResults() {
    // Try API first (authoritative source — BKT-computed)
    try {
      const slugParam = activeSlug ? `?slug=${encodeURIComponent(activeSlug)}` : '';
      const res = await fetch(`${API}/api/results/${studentId}${slugParam}`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setAccuracy(data.accuracy || 0);
        setTimeMin(data.time_minutes || 1);
        setTotalQ(data.total_questions || 0);
        setStrengths(data.strengths || []);
        setWeaknesses(data.weaknesses || []);
        setConcepts((data.concepts || []).map((c: any) => ({
          name: c.name || c.concept_id,
          mastery: c.mastery_pct || Math.round((c.mastery || 0) * 100),
          correct: (c.mastery || 0) >= 0.5,
        })));
        console.log('[ResultsPage] Data loaded from API (BKT-computed)');

        // Load mindset gaps
        if (data.mindset_gaps) setMindsetGaps(data.mindset_gaps);

        // Load personality traits from coach analyzer
        try {
          const analysisRes = await fetch(`${API}/api/student-analysis/${studentId}`, { headers: getAuthHeader() });
          if (analysisRes.ok) {
            const analysisData = await analysisRes.json();
            setPersonalityTraits(analysisData.personality_traits || {});
          }
        } catch { /* ignore */ }

        return;
      }
    } catch { /* API offline — fall through */ }

    // Fallback: localStorage
    const stored = localStorage.getItem(`apex_student_${studentId}`);
    if (!stored) { navigate('/'); return; }
    const s = JSON.parse(stored);
    console.log('[ResultsPage] Data loaded from localStorage (fallback)');
    setAccuracy(Math.round(s.accuracy || (s.overall_mastery||0)*100));
    const timeSec = s.total_time_seconds || Math.round((s.total_time_ms||0)/1000);
    setTimeMin(Math.max(1, Math.round(timeSec / 60)));
    setTotalQ(s.total_questions || (s.diagnostic_responses||[]).length || Object.keys(s.mastery_snapshots||{}).length);
    setStrengths(s.strongest_concepts || []);
    setWeaknesses(s.weakest_concepts || []);
    const snaps = Object.values(s.mastery_snapshots || {}) as any[];
    setConcepts(snaps.map((snap:any) => ({
      name: snap.concept_name || '',
      mastery: Math.round((snap.mastery_estimate||0)*100),
      correct: snap.mastery_estimate >= 0.5,
    })));
  }

  return (
    <AppShell>
      <div className="page-transition">
        {/* Hero */}
        <div className="text-center mb-8" style={{ animation: 'fadeUp 0.5s ease-out' }}>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/15 flex items-center justify-center border border-primary/20">
            <Sparkles className="text-primary" size={28}/>
          </div>
          <h1 className="text-3xl font-bold text-on-surface mb-2">عمل رائع! خريطتك التعليمية جاهزة</h1>
          <p className="text-on-surface-variant max-w-lg mx-auto">لقد قمنا بتحليل استجاباتك وتخصيص مسارك بناءً على أدائك.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            {icon: Target, label:'معدل الدقة', value:`${accuracy}%`, color:'text-primary'},
            {icon: Clock, label:'الوقت المستغرق', value:`${timeMin} دقائق`, color:'text-[#ffb869]'},
            {icon: BarChart3, label:'عدد الأسئلة', value:String(totalQ), color:'text-secondary'},
          ].map(s => (
            <div key={s.label} className="stat-card">
              <s.icon size={24} className={`mx-auto mb-2 ${s.color}`}/>
              <p className="text-xs text-on-surface-variant mb-1">{s.label}</p>
              <p className="text-3xl font-bold text-on-surface">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Chart + Strengths */}
        <div className="glass-card rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-2 justify-end mb-6">
            <h2 className="text-lg font-semibold text-on-surface">تحليل المهارات الذكي</h2>
            <BarChart3 size={20} className="text-primary"/>
          </div>

          {/* Bar Chart */}
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="flex items-end gap-1 h-[220px] pb-[70px] min-w-fit mx-auto justify-center" style={{ minWidth: `${Math.max(concepts.length * 90, 300)}px` }}>
              {concepts.map((c, i) => (
                <div key={i} className="flex flex-col items-center relative" style={{ minWidth: '80px' }}>
                  {/* Mastery value */}
                  <span className={`text-[10px] font-bold mb-1 ${c.correct ? 'text-primary' : 'text-[#ffb869]'}`}>{c.mastery}%</span>
                  <div
                    className={`w-10 rounded-t-lg transition-all duration-700 ${c.correct ? 'bg-primary' : 'bg-[#ffb869]'}`}
                    style={{height: `${Math.max(20, c.mastery * 1.4)}px`}}
                  />
                  <span
                    className="absolute -bottom-[60px] text-[10px] text-on-surface-variant text-center leading-tight max-w-[100px] line-clamp-3 break-words"
                    title={c.name}
                  >{c.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths / Weaknesses */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-tertiary/20 bg-tertiary/5">
              <div className="flex items-center gap-2 justify-end mb-3">
                <span className="font-semibold text-sm text-on-surface">نقاط القوة</span>
                <CheckCircle2 size={16} className="text-tertiary"/>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {strengths.map((s, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-tertiary/10 border border-tertiary/20 text-tertiary text-xs">
                    {s}
                  </span>
                ))}
                {strengths.length === 0 && <span className="text-xs text-on-surface-variant">—</span>}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-[#ffb869]/20 bg-[#ffb869]/5">
              <div className="flex items-center gap-2 justify-end mb-3">
                <span className="font-semibold text-sm text-on-surface">يحتاج مراجعة</span>
                <Target size={16} className="text-[#ffb869]"/>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {weaknesses.map((w, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-[#ffb869]/10 border border-[#ffb869]/20 text-[#ffb869] text-xs">
                    {w}
                  </span>
                ))}
                {weaknesses.length === 0 && <span className="text-xs text-on-surface-variant">—</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Mindset Gaps — Feature #3 */}
        {mindsetGaps.length > 0 && (
          <div className="glass-card rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-2 justify-end mb-4">
              <h2 className="text-lg font-semibold text-on-surface">تحليل الفجوات المعرفية</h2>
              <Brain size={20} className="text-secondary" />
            </div>
            <p className="text-xs text-on-surface-variant mb-4 text-right">
              نظام Mindset Analyzer™ اكتشف الفجوات التالية بين إجابتك وتفسيرك:
            </p>
            <div className="space-y-3">
              {mindsetGaps.map((gap, i) => (
                <div key={i} className={`p-3 rounded-xl border ${
                  gap.gap_type === 'conceptual'
                    ? 'border-error/20 bg-error/5'
                    : 'border-[#ffb869]/20 bg-[#ffb869]/5'
                }`}>
                  <div className="flex items-center gap-2 justify-end mb-1">
                    <span className="text-sm font-medium text-on-surface">{gap.concept || gap.concept_id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      gap.gap_type === 'conceptual'
                        ? 'bg-error/15 text-error'
                        : 'bg-[#ffb869]/15 text-[#ffb869]'
                    }`}>
                      {gap.gap_type === 'conceptual' ? '🧠 مفاهيمي' : '⚙️ إجرائي'}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant text-right">
                    {gap.gap_type === 'conceptual'
                      ? 'ثقة عالية + إجابة خاطئة = مفهوم خاطئ راسخ يحتاج تصحيح'
                      : 'المفهوم واضح لكن التطبيق فيه خلل — تحتاج تمرين أكثر'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personality Traits */}
        {Object.keys(personalityTraits).length > 0 && (
          <div className="glass-card rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-2 justify-end mb-4">
              <h2 className="text-lg font-semibold text-on-surface">ملفك التعليمي</h2>
              <Lightbulb size={20} className="text-[#ffb869]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'needs_encouragement', label: 'يحتاج تشجيع', icon: '💪' },
                { key: 'attention_span', label: 'فترة الانتباه', icon: '⏱️' },
                { key: 'learning_speed', label: 'سرعة التعلم', icon: '🚀' },
                { key: 'confidence_calibration', label: 'دقة الثقة', icon: '🎯' },
              ].map(t => {
                const val = personalityTraits[t.key] || 'N/A';
                const color = val === 'high' || val === 'long' || val === 'fast' || val === 'calibrated'
                  ? 'text-tertiary bg-tertiary/10 border-tertiary/20'
                  : val === 'low' || val === 'short' || val === 'slow'
                    ? 'text-error bg-error/10 border-error/20'
                    : 'text-[#ffb869] bg-[#ffb869]/10 border-[#ffb869]/20';
                return (
                  <div key={t.key} className={`p-3 rounded-xl border ${color}`}>
                    <span className="text-lg">{t.icon}</span>
                    <p className="text-xs text-on-surface-variant mt-1">{t.label}</p>
                    <p className="text-sm font-bold">{val === 'high' ? 'عالي' : val === 'low' ? 'منخفض' : val === 'medium' ? 'متوسط' : val === 'long' ? 'طويلة' : val === 'short' ? 'قصيرة' : val === 'fast' ? 'سريع' : val === 'slow' ? 'بطيء' : val === 'calibrated' ? 'دقيقة' : val}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col items-center gap-3">
          <button onClick={()=>navigate('/roadmap')} className="btn-primary py-3.5 px-10 rounded-xl text-base">
            <ArrowRight size={18}/>عرض الخارطة المحدثة
          </button>
          <p className="text-xs text-on-surface-variant">سيتم حفظ النتائج وتحديث مسارك التعليمي تلقائياً</p>
        </div>
      </div>
    </AppShell>
  );
}
