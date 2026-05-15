import { useEffect, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Lock, ChevronLeft, CheckCircle2, Sparkles, BookOpen, TrendingUp, Boxes, Play, Target, Award, ChevronDown, ChevronUp, Star } from 'lucide-react';
import AppShell from '../components/AppShell';
import { useCurriculum } from '../context/CurriculumContext';
import { fetchCurriculum, getMasterySnapshots, type L1Section, type L1Concept } from '../services/backend';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

interface SectionNode {
  id: string;
  title: string;
  concepts: { id: string; name: string; mastery: number; is_core: boolean }[];
  overallMastery: number; // 0-100
  status: 'locked' | 'active' | 'done';
}

interface MasterySnap {
  concept_id: string;
  concept_name: string;
  mastery_estimate: number;
  mastery_level: string;
}

// ═══════════════════════════════════════════
// Component
// ═══════════════════════════════════════════

export default function RoadmapPage() {
  const navigate = useNavigate();
  const { activeCurriculum, activeSlug, loading: currLoading } = useCurriculum();
  const studentId = localStorage.getItem('apex_current_student') || '';

  const [diagnosticDone, setDiagnosticDone] = useState(false);
  const [overallMastery, setOverallMastery] = useState(0);
  const [diagnosticAccuracy, setDiagnosticAccuracy] = useState(0);
  const [sections, setSections] = useState<SectionNode[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starsTotal, setStarsTotal] = useState(0);

  useEffect(() => {
    if (!studentId) { navigate('/'); return; }
    loadRoadmap();
  }, [studentId, activeSlug]);

  async function loadRoadmap() {
    setLoading(true);

    // 1. Load mastery from API (BKT-computed) — fallback to localStorage
    let masterySnaps: Record<string, MasterySnap> = {};
    let isDiagDone = false;
    let mastery = 0;

    // Try API first (authoritative source)
    try {
      const apiMastery = await getMasterySnapshots(studentId, activeSlug);
      if (apiMastery && apiMastery.length > 0) {
        for (const snap of apiMastery) {
          masterySnaps[snap.concept_id] = {
            concept_id: snap.concept_id,
            concept_name: snap.concept_id,
            mastery_estimate: snap.mastery_estimate,
            mastery_level: snap.mastery_estimate >= 0.75 ? 'proficient' : snap.mastery_estimate >= 0.4 ? 'developing' : 'novice',
          };
        }
        isDiagDone = true; // If there's mastery data, diagnostic was done
        const estimates = apiMastery.map(s => s.mastery_estimate);
        mastery = Math.round((estimates.reduce((a, b) => a + b, 0) / estimates.length) * 100);
      }
    } catch { /* API offline — fall through to localStorage */ }

    // Fetch diagnostic accuracy (% correct — distinct from BKT mastery)
    try {
      const accRes = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/results/${studentId}`);
      if (accRes.ok) {
        const accData = await accRes.json();
        setDiagnosticAccuracy(accData.accuracy || 0);
      }
    } catch { /* ignore */ }

    // Fetch student profile for stars total
    try {
      const meRes = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/auth/me/${studentId}`);
      if (meRes.ok) {
        const me = await meRes.json();
        setStarsTotal(me.stars_total ?? 0);
      }
    } catch { /* ignore */ }

    // Fallback to localStorage
    if (Object.keys(masterySnaps).length === 0) {
      const stored = localStorage.getItem(`apex_student_${studentId}`);
      if (stored) {
        const s = JSON.parse(stored);
        isDiagDone = !!(s.diagnostic_done || s.diagnostic_complete);
        mastery = Math.round((s.overall_mastery || s.accuracy / 100 || 0) * 100);
        masterySnaps = s.mastery_snapshots || {};
      }
    }

    setDiagnosticDone(isDiagDone);
    setOverallMastery(mastery);

    // 2. Load curriculum sections from API
    if (!activeSlug) { setLoading(false); return; }
    
    try {
      const curriculum = await fetchCurriculum(activeSlug);
      if (!curriculum?.chapters) { setLoading(false); return; }

      const sectionNodes: SectionNode[] = [];

      for (const ch of curriculum.chapters) {
        for (const sec of ch.sections) {
          const concepts = (sec.concepts || []).map(c => {
            const snap = masterySnaps[c.id];
            return {
              id: c.id,
              name: c.name,
              mastery: snap ? Math.round(snap.mastery_estimate * 100) : 0,
              is_core: c.is_core,
            };
          });

          // Skip empty sections (0 concepts = junk from PDF parsing)
          if (concepts.length === 0) continue;

          // Calculate section mastery (average of concept masteries)
          const sectionMastery = concepts.length > 0
            ? Math.round(concepts.reduce((sum, c) => sum + c.mastery, 0) / concepts.length)
            : 0;

          // Determine status — ALL sections open after diagnostic
          let status: SectionNode['status'] = 'locked';
          if (isDiagDone) {
            if (sectionMastery >= 75) {
              status = 'done';
            } else {
              status = 'active'; // All sections accessible after diagnostic
            }
          }

          sectionNodes.push({
            id: sec.id,
            title: sec.title,
            concepts,
            overallMastery: sectionMastery,
            status,
          });
        }
      }

      setSections(sectionNodes);
    } catch (e) {
      console.warn('[Roadmap] Failed to load curriculum:', e);
    }

    setLoading(false);
  }

  const doneSections = sections.filter(s => s.status === 'done').length;
  const totalSections = sections.length;
  // Progress = average mastery across ALL sections (not just 'done' count)
  const progressPercent = totalSections > 0
    ? Math.round(sections.reduce((sum, s) => sum + s.overallMastery, 0) / totalSections)
    : 0;

  if (loading || currLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-on-surface-variant">جاري تحميل خارطة الطريق...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-transition max-w-3xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm text-on-surface-variant mb-3 bg-surface-container/50 border border-primary/10">
            <Sparkles size={14} className="text-secondary"/>
            {diagnosticDone
              ? totalSections > 0
                ? `✓ الإتقان: ${progressPercent}%`
                : `✓ الدقة: ${diagnosticAccuracy}% — ${activeCurriculum?.name || 'لا يوجد منهج'}`
              : 'مسار مخصص متاح'}
            {starsTotal > 0 && (
              <>
                <span className="text-on-surface-variant opacity-30">|</span>
                <Star size={13} className="text-[#ffb869] fill-[#ffb869]" />
                <span className="text-[#ffb869] font-semibold">{starsTotal}</span>
              </>
            )}
          </div>
          <h1 className="text-3xl font-bold text-on-surface mb-2">خارطة طريق التعلم</h1>
          <p className="text-on-surface-variant text-base max-w-md mx-auto">
            {diagnosticDone
              ? totalSections > 0
                ? `تم تحليل مستواك — ${doneSections} من ${totalSections} أقسام مكتملة`
                : 'أكملت التشخيص — المنهج قيد التحميل أو لم يُربط بعد'
              : activeCurriculum
                ? `المادة: ${activeCurriculum.name} — أكمل الاختبار لفتح مسارك`
                : 'ارفع مادة دراسية أولاً لبدء رحلة التعلم'}
          </p>
        </div>

        {/* Overall Progress Bar */}
        {diagnosticDone && totalSections > 0 && (
          <div className="glass-card rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-on-surface-variant">{doneSections}/{totalSections} أقسام مكتملة</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-primary">{progressPercent}%</span>
                <Award size={16} className="text-primary" />
                <span className="text-sm font-medium">متوسط الإتقان</span>
              </div>
            </div>
            <div className="w-full h-2.5 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-primary to-tertiary rounded-full transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Roadmap Nodes */}
        <div className="flex flex-col items-center">
          {/* === Diagnostic Node === */}
          <RoadmapNodeCircle
            icon={Brain}
            label="الاختبار التشخيصي"
            status={diagnosticDone ? 'done' : 'active'}
            badge={diagnosticDone ? `دقة ${diagnosticAccuracy}% · إتقان ${overallMastery}%` : 'إلزامي'}
            onClick={() => navigate(diagnosticDone ? '/results' : '/diagnostic')}
          />

          {diagnosticDone && (
            <div className="my-3 insight-card max-w-[320px]">
              <div className="flex items-center gap-2 justify-end mb-2">
                <span className="text-sm font-medium text-tertiary">التشخيص مكتمل</span>
                <Sparkles size={14} className="text-tertiary"/>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                الدقة: <strong className="text-primary">{diagnosticAccuracy}%</strong> · الإتقان (BKT): <strong className="text-primary">{overallMastery}%</strong>.
                {totalSections > 0 ? ' الأقسام أدناه مرتبة حسب المنهج — ابدأ من أول قسم نشط.' : ' اختر منهجاً جاهزاً لعرض الأقسام.'}
              </p>
            </div>
          )}

          {/* === Section Nodes === */}
          {sections.length === 0 && !diagnosticDone && (
            <div className="my-6 text-center">
              <div className="roadmap-connector" />
              <RoadmapNodeCircle
                icon={BookOpen}
                label={activeCurriculum ? 'أقسام المنهج' : 'لا يوجد منهج'}
                status="locked"
                onClick={() => activeCurriculum ? navigate('/diagnostic') : navigate('/upload')}
              />
              <p className="text-xs text-on-surface-variant mt-2 max-w-[250px] mx-auto">
                {activeCurriculum
                  ? 'أكمل الاختبار التشخيصي لفتح أقسام المنهج'
                  : 'ارفع مادة دراسية من صفحة الرفع لبدء رحلة التعلم'}
              </p>
            </div>
          )}

          {sections.map((sec, i) => {
            const isExpanded = expandedSection === sec.id;
            const isDone = sec.status === 'done';
            const isActive = sec.status === 'active';
            const isLocked = sec.status === 'locked';

            return (
              <div key={sec.id} className="flex flex-col items-center w-full max-w-[500px]">
                {/* Connector line */}
                <div className={`roadmap-connector ${isDone || isActive ? 'roadmap-connector-active' : ''}`} />

                {/* Section Card */}
                <div
                  onClick={() => {
                    if (isLocked) return;
                    setExpandedSection(isExpanded ? null : sec.id);
                  }}
                  className={`w-full rounded-2xl border transition-all duration-300 cursor-pointer ${
                    isDone
                      ? 'border-tertiary/30 bg-tertiary/5 hover:bg-tertiary/10'
                      : isActive
                        ? 'border-primary/30 bg-primary/5 hover:bg-primary/10 shadow-glow'
                        : 'border-outline-variant/20 bg-surface-container-low/50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="p-4 flex items-center gap-3">
                    {/* Status Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isDone ? 'bg-tertiary/20' : isActive ? 'bg-primary/20' : 'bg-surface-container'
                    }`}>
                      {isDone
                        ? <CheckCircle2 size={20} className="text-tertiary" />
                        : isActive
                          ? <Play size={18} className="text-primary" />
                          : <Lock size={16} className="text-on-surface-variant opacity-40" />
                      }
                    </div>

                    {/* Title + Mastery */}
                    <div className="flex-1 text-right">
                      <p className={`font-medium text-sm ${isLocked ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                        {sec.title}
                      </p>
                      <div className="flex items-center gap-2 justify-end mt-1">
                        <span className="text-xs text-on-surface-variant">{sec.concepts.length} مفاهيم</span>
                        {!isLocked && (
                          <>
                            <span className="text-xs text-on-surface-variant">•</span>
                            <span className={`text-xs font-bold ${isDone ? 'text-tertiary' : 'text-primary'}`}>
                              {sec.overallMastery}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Mastery bar */}
                    {!isLocked && (
                      <div className="w-16 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isDone ? 'bg-tertiary' : 'bg-primary'}`}
                          style={{ width: `${sec.overallMastery}%` }}
                        />
                      </div>
                    )}

                    {/* Expand chevron */}
                    {!isLocked && (
                      isExpanded
                        ? <ChevronUp size={18} className="text-on-surface-variant" />
                        : <ChevronDown size={18} className="text-on-surface-variant" />
                    )}
                  </div>

                  {/* Expanded: Show concepts */}
                  {isExpanded && (
                    <div className="border-t border-primary/10 p-4 space-y-2" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                      {sec.concepts.map(concept => (
                        <div key={concept.id} className="flex items-center gap-2 py-1.5">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                            concept.mastery >= 70
                              ? 'bg-tertiary/20 text-tertiary'
                              : concept.mastery > 0
                                ? 'bg-[#ffb869]/20 text-[#ffb869]'
                                : 'bg-surface-container text-on-surface-variant'
                          }`}>
                            {concept.mastery >= 70 ? '✓' : concept.is_core ? '★' : '·'}
                          </div>
                          <span className="flex-1 text-right text-xs text-on-surface">{concept.name}</span>
                          <span className={`text-[10px] font-bold ${
                            concept.mastery >= 70 ? 'text-tertiary' : concept.mastery > 0 ? 'text-[#ffb869]' : 'text-on-surface-variant'
                          }`}>{concept.mastery}%</span>
                          <div className="w-12 h-1 bg-surface-container-high rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${concept.mastery >= 70 ? 'bg-tertiary' : concept.mastery > 0 ? 'bg-[#ffb869]' : 'bg-surface-container'}`}
                              style={{ width: `${concept.mastery}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      {/* Start Learning Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/learn?section=${sec.id}&slug=${activeSlug}`); }}
                        className="btn-primary w-full py-2.5 rounded-xl mt-3 text-sm"
                      >
                        <BookOpen size={16} />
                        <span>ابدأ التعلم</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="flex justify-center mt-10 mb-8">
          <button
            onClick={() => {
              if (!activeCurriculum) navigate('/upload');
              else if (!diagnosticDone) navigate('/diagnostic');
              else navigate('/results');
            }}
            className="btn-primary w-full max-w-[400px] py-3.5 text-lg rounded-xl"
          >
            <span>
              {!activeCurriculum ? 'ارفع مادة' : !diagnosticDone ? 'ابدأ الاختبار الآن' : 'عرض النتائج'}
            </span>
            <ChevronLeft size={20}/>
          </button>
        </div>
      </div>
    </AppShell>
  );
}

// ═══════════════════════════════════════════
// Reusable Node Circle
// ═══════════════════════════════════════════

function RoadmapNodeCircle({
  icon: Icon,
  label,
  status,
  badge,
  onClick,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  status: 'locked' | 'active' | 'done';
  badge?: string;
  onClick?: () => void;
}) {
  const isDone = status === 'done';
  const isActive = status === 'active';

  return (
    <div className="flex flex-col items-center cursor-pointer" onClick={onClick}>
      <div className={`roadmap-node ${
        isDone ? 'roadmap-node-done' :
        isActive ? 'roadmap-node-active' :
        'roadmap-node-locked'
      }`}>
        {isDone
          ? <CheckCircle2 className="text-tertiary" size={34}/>
          : <Icon className={isActive ? 'text-primary' : 'text-on-surface-variant'} size={30}/>
        }
      </div>
      <p className={`mt-2 text-sm font-medium ${isDone ? 'text-tertiary' : isActive ? 'text-on-surface' : 'text-on-surface-variant opacity-50'}`}>
        {label}
      </p>
      {badge && (
        <span className={`text-xs mt-1 px-3 py-0.5 rounded-full ${
          isDone ? 'bg-tertiary/10 text-tertiary border border-tertiary/20' : 'bg-primary/10 text-primary border border-primary/20'
        }`}>
          {badge}
        </span>
      )}
    </div>
  );
}
