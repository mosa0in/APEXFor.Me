import { useEffect, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Lock, ChevronLeft, CheckCircle2, Sparkles, BookOpen, TrendingUp, Boxes, Play, Target, Award, ChevronDown, ChevronUp, Star, CloudUpload, ExternalLink, Layers } from 'lucide-react';
import AppShell from '../components/AppShell';
import { useCurriculum } from '../context/CurriculumContext';
import { fetchCurriculum, getMasterySnapshots, getAuthHeader, type L1Section, type L1Concept } from '../services/backend';

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

interface ExtConcept {
  concept_id: string;
  name: string;
  description: string;
  relation_type: 'prerequisite' | 'related' | 'extension';
  priority: 1 | 2 | 3;
  insert_after: string; // internal concept_id
  question: { question_text: string; question_type: string; difficulty: string };
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
  const [extConcepts, setExtConcepts] = useState<ExtConcept[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedExt, setExpandedExt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starsTotal, setStarsTotal] = useState(0);

  useEffect(() => {
    if (!studentId) { navigate('/'); return; }
    if (currLoading) return; // Wait for context to verify which curricula belong to this user
    loadRoadmap();
  }, [studentId, activeSlug, currLoading]);

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
      const accRes = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/results/${studentId}`, { headers: getAuthHeader() });
      if (accRes.ok) {
        const accData = await accRes.json();
        setDiagnosticAccuracy(accData.accuracy || 0);
      }
    } catch { /* ignore */ }

    // Fetch student profile for stars total
    try {
      const meRes = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/auth/me/${studentId}`, { headers: getAuthHeader() });
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

    // Load external concepts (non-blocking)
    try {
      const API = import.meta.env.VITE_API_URL ?? '';
      const extRes = await fetch(`${API}/api/diagnostic/${activeSlug}/external-concepts`, { headers: getAuthHeader() });
      if (extRes.ok) {
        const extData = await extRes.json();
        setExtConcepts(extData.external_concepts || []);
      }
    } catch { /* ignore */ }

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

  if (!activeSlug || sections.length === 0) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-32 text-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <BookOpen size={36} className="text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-on-surface mb-2">لا يوجد منهج بعد</h2>
            <p className="text-on-surface-variant max-w-sm">ارفع كتابك الدراسي وسيقوم الذكاء الاصطناعي ببناء خارطة طريقك التعليمية تلقائياً.</p>
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

          {diagnosticDone && (() => {
            const firstActive = sections.find(s => s.status === 'active');
            return (
              <>
                <div className="my-3 insight-card max-w-[320px]">
                  <div className="flex items-center gap-2 justify-end mb-2">
                    <span className="text-sm font-medium text-tertiary">التشخيص مكتمل</span>
                    <Sparkles size={14} className="text-tertiary"/>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    الدقة: <strong className="text-primary">{diagnosticAccuracy}%</strong> · الإتقان (BKT): <strong className="text-primary">{overallMastery}%</strong>.
                    {totalSections > 0 ? ' الأقسام أدناه مرتبة حسب المنهج.' : ' اختر منهجاً جاهزاً لعرض الأقسام.'}
                  </p>
                </div>
                {firstActive && (
                  <button
                    onClick={() => {
                      localStorage.setItem('apex_active_section', firstActive.id);
                      navigate(`/learn?section=${firstActive.id}&slug=${activeSlug}`);
                    }}
                    className="btn-primary mb-2 px-8 py-3 rounded-2xl flex items-center gap-3 text-base shadow-glow"
                  >
                    <Play size={18} className="shrink-0" />
                    <div className="text-right">
                      <p className="text-sm font-bold leading-tight">ابدأ التعلم</p>
                      <p className="text-[11px] opacity-70 font-normal leading-tight">{firstActive.title}</p>
                    </div>
                  </button>
                )}
              </>
            );
          })()}

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

          {(() => {
            let masteredIdx = 0;
            // Build lookup: concept_id → section_id
            const conceptToSection: Record<string, string> = {};
            sections.forEach(sec => sec.concepts.forEach(c => { conceptToSection[c.id] = sec.id; }));
            // Group external concepts by which section they follow
            const extBySectionId: Record<string, ExtConcept[]> = {};
            extConcepts.forEach(ec => {
              const secId = conceptToSection[ec.insert_after] || '__before__';
              if (!extBySectionId[secId]) extBySectionId[secId] = [];
              extBySectionId[secId].push(ec);
            });

            const EXT_COLOR: Record<string, string> = {
              prerequisite: 'text-error border-error/40 bg-error/10',
              related: 'text-[#ffb869] border-[#ffb869]/40 bg-[#ffb869]/10',
              extension: 'text-tertiary border-tertiary/40 bg-tertiary/10',
            };

            const EXT_ACCENT: Record<string, { color: string; glow: string; bg: string }> = {
              prerequisite: { color: '#ffb4ab', glow: 'rgba(255,180,171,0.35)', bg: 'rgba(255,180,171,0.08)' },
              related:      { color: '#ffb869', glow: 'rgba(255,184,105,0.35)', bg: 'rgba(255,184,105,0.08)' },
              extension:    { color: '#d0bcff', glow: 'rgba(208,188,255,0.35)', bg: 'rgba(208,188,255,0.08)' },
            };

            const renderExtConcepts = (secId: string, side: 'left' | 'right') => {
              const ecs = extBySectionId[secId];
              if (!ecs || ecs.length === 0) return null;
              return (
                <div className="flex flex-col items-center w-full" style={{maxWidth:560}}>
                  {ecs.map((ec, idx) => {
                    const isR = (idx % 2 === 0) === (side === 'right');
                    const isOpen = expandedExt === ec.concept_id;
                    const accent = EXT_ACCENT[ec.relation_type] || EXT_ACCENT.related;
                    // Find the section this external concept is anchored to
                    const targetSecId = conceptToSection[ec.insert_after] || (secId !== '__before__' ? secId : null);
                    return (
                      <div key={ec.concept_id} className="flex flex-col items-center w-full">
                        {/* Short connector from spine */}
                        <div className="w-[3px] rounded-full mx-auto" style={{height:20, background:`linear-gradient(180deg, ${accent.color}50, ${accent.color}20)`}} />
                        <div className={`flex items-center w-full gap-0 ${isR ? 'flex-row' : 'flex-row-reverse'}`}>
                          {/* Spine anchor dot */}
                          <div className="flex flex-col items-center shrink-0 w-6">
                            <div className="w-2.5 h-2.5 rounded-full" style={{background: accent.color, boxShadow:`0 0 6px ${accent.glow}`, border:`1.5px solid ${accent.color}`}} />
                          </div>
                          {/* Solid horizontal connector */}
                          <div className="shrink-0" style={{width:28, height:2, background:`linear-gradient(to ${isR?'right':'left'}, ${accent.color}90, ${accent.color}30)`, borderRadius:1}} />
                          {/* Circle node */}
                          <div
                            onClick={() => {
                              if (targetSecId) {
                                localStorage.setItem('apex_active_section', targetSecId);
                                navigate(`/learn?section=${targetSecId}&slug=${activeSlug}&extId=${ec.concept_id}&extName=${encodeURIComponent(ec.name)}&extDesc=${encodeURIComponent(ec.description)}`);
                              } else {
                                setExpandedExt(isOpen ? null : ec.concept_id);
                              }
                            }}
                            className="w-14 h-14 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110 shrink-0"
                            style={{
                              background: accent.bg,
                              border: `2px solid ${accent.color}`,
                              boxShadow: `0 0 12px ${accent.glow}`,
                            }}
                          >
                            <Layers size={15} style={{color: accent.color}} className="mb-0.5" />
                            <span className="text-[7px] font-bold text-center leading-tight px-1 line-clamp-2" style={{color: accent.color}}>
                              {ec.name.split(' ').slice(0,2).join(' ')}
                            </span>
                          </div>
                          {/* Info card (only when no section to navigate to) */}
                          {isOpen && !targetSecId && (
                            <div className="ml-2 mr-2 rounded-xl p-2.5 text-right" style={{maxWidth:180, animation:'fadeUp 0.2s ease-out', background: accent.bg, border:`1px solid ${accent.color}40`}}>
                              <p className="text-[10px] font-bold leading-tight mb-1" style={{color: accent.color}}>{ec.name}</p>
                              <p className="text-[9px] opacity-80 leading-snug line-clamp-3 text-on-surface-variant">{ec.description}</p>
                            </div>
                          )}
                          <div className="flex-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            };

            return sections.map((sec) => {
              const isExpanded = expandedSection === sec.id;
              const isDone = sec.status === 'done';
              const isActive = sec.status === 'active';
              const isLocked = sec.status === 'locked';

              // ── MASTERED → side bubble ────────────────────────────────
              if (isDone) {
                const isRight = masteredIdx % 2 === 0;
                masteredIdx++;
                return (
                  <div key={sec.id} className="flex flex-col items-center w-full" style={{maxWidth:560}}>
                    {renderExtConcepts(sec.id, isRight ? 'left' : 'right')}
                    {/* Connector (tertiary dashed) */}
                    <div className="roadmap-connector roadmap-connector-mastered" />

                    {/* Side row */}
                    <div className={`flex items-center w-full gap-0 ${isRight ? 'flex-row' : 'flex-row-reverse'}`}>
                      {/* Spine anchor dot */}
                      <div className="flex flex-col items-center shrink-0 w-6">
                        <div className="w-2.5 h-2.5 rounded-full bg-tertiary/50 border border-tertiary/30" />
                      </div>

                      {/* Dashed horizontal connector */}
                      <div className="h-px w-8 shrink-0" style={{borderTop:'2px dashed rgba(255,184,105,0.5)'}} />

                      {/* Mastered card */}
                      <div
                        onClick={() => setExpandedSection(isExpanded ? null : sec.id)}
                        className="flex-1 rounded-xl border border-tertiary/30 bg-tertiary/5 hover:bg-tertiary/10 cursor-pointer transition-all p-3"
                        style={{maxWidth:220}}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-tertiary/20 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={14} className="text-tertiary" />
                          </div>
                          <div className="flex-1 text-right min-w-0">
                            <p className="text-[11px] font-semibold text-tertiary leading-tight line-clamp-2">{sec.title}</p>
                            <div className="flex items-center gap-1.5 justify-end mt-0.5">
                              <span className="text-[9px] text-on-surface-variant">متقن</span>
                              <span className="text-[10px] font-bold text-tertiary">{sec.overallMastery}%</span>
                            </div>
                          </div>
                          {isExpanded
                            ? <ChevronUp size={13} className="text-tertiary shrink-0" />
                            : <ChevronDown size={13} className="text-tertiary shrink-0" />}
                        </div>

                        {/* Expanded concepts */}
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-tertiary/15 space-y-1" style={{animation:'fadeUp 0.25s ease-out'}}>
                            {sec.concepts.map(concept => (
                              <div key={concept.id} className="flex items-center gap-1.5">
                                <span className="text-[10px] text-tertiary">✓</span>
                                <span className="flex-1 text-right text-[10px] text-on-surface">{concept.name}</span>
                                <span className="text-[10px] font-bold text-tertiary">{concept.mastery}%</span>
                              </div>
                            ))}
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/learn?section=${sec.id}&slug=${activeSlug}`); }}
                              className="w-full mt-1.5 py-1.5 rounded-lg text-[11px] text-tertiary border border-tertiary/30 hover:bg-tertiary/15 transition-all"
                            >
                              تعمق في المحتوى
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Spacer on opposite side (keeps spine centered) */}
                      <div className="flex-1" style={{maxWidth:220}} />
                    </div>
                  </div>
                );
              }

              // ── NON-MASTERED → main path ──────────────────────────────
              return (
                <div key={sec.id} className="flex flex-col items-center w-full max-w-[500px]">
                  {renderExtConcepts(sec.id, masteredIdx % 2 === 0 ? 'right' : 'left')}
                  <div className={`roadmap-connector ${isActive ? 'roadmap-connector-active' : ''}`} />
                  <div
                    className={`w-full rounded-2xl border transition-all duration-300 ${
                      isActive
                        ? 'border-primary/30 bg-primary/5 shadow-glow'
                        : 'border-outline-variant/20 bg-surface-container-low/50 opacity-50'
                    }`}
                  >
                    <div className="p-4 flex items-center gap-3">
                      {/* Play button — navigates directly */}
                      <button
                        onClick={() => {
                          if (isLocked) return;
                          localStorage.setItem('apex_active_section', sec.id);
                          navigate(`/learn?section=${sec.id}&slug=${activeSlug}`);
                        }}
                        disabled={isLocked}
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${isActive ? 'bg-primary/20 hover:bg-primary/35 hover:scale-110' : 'bg-surface-container cursor-not-allowed'}`}
                      >
                        {isActive
                          ? <Play size={18} className="text-primary" />
                          : <Lock size={16} className="text-on-surface-variant opacity-40" />}
                      </button>

                      {/* Section info — clicking this expands/collapses */}
                      <div
                        className={`flex-1 text-right ${isActive ? 'cursor-pointer' : ''}`}
                        onClick={() => { if (!isLocked) setExpandedSection(isExpanded ? null : sec.id); }}
                      >
                        <p className={`font-medium text-sm ${isLocked ? 'text-on-surface-variant' : 'text-on-surface'}`}>{sec.title}</p>
                        <div className="flex items-center gap-2 justify-end mt-1">
                          <span className="text-xs text-on-surface-variant">{sec.concepts.length} مفاهيم</span>
                          {!isLocked && (
                            <>
                              <span className="text-xs text-on-surface-variant">•</span>
                              <span className="text-xs font-bold text-primary">{sec.overallMastery}%</span>
                            </>
                          )}
                        </div>
                      </div>

                      {!isLocked && (
                        <div className="w-16 h-1.5 bg-surface-container-high rounded-full overflow-hidden shrink-0">
                          <div className="h-full bg-primary rounded-full transition-all" style={{width:`${sec.overallMastery}%`}} />
                        </div>
                      )}

                      {/* Chevron for expand/collapse */}
                      {!isLocked && (
                        <button
                          onClick={() => setExpandedSection(isExpanded ? null : sec.id)}
                          className="shrink-0 p-1 rounded-lg hover:bg-primary/10 transition-all"
                        >
                          {isExpanded
                            ? <ChevronUp size={16} className="text-on-surface-variant" />
                            : <ChevronDown size={16} className="text-on-surface-variant" />}
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-primary/10 p-4 space-y-1" style={{animation:'fadeUp 0.3s ease-out'}}>
                        {sec.concepts.map(concept => (
                          <button
                            key={concept.id}
                            className="w-full flex items-center gap-2 py-1.5 rounded-lg px-2 hover:bg-primary/5 transition-all cursor-pointer text-right"
                            onClick={() => {
                              localStorage.setItem('apex_active_section', sec.id);
                              navigate(`/learn?section=${sec.id}&slug=${activeSlug}&startConcept=${concept.id}`);
                            }}
                          >
                            <div className="w-12 h-1 bg-surface-container-high rounded-full overflow-hidden shrink-0">
                              <div className={`h-full rounded-full ${concept.mastery >= 70 ? 'bg-tertiary' : concept.mastery > 0 ? 'bg-[#ffb869]' : 'bg-surface-container'}`} style={{width:`${concept.mastery}%`}} />
                            </div>
                            <span className={`text-[10px] font-bold shrink-0 ${concept.mastery >= 70 ? 'text-tertiary' : concept.mastery > 0 ? 'text-[#ffb869]' : 'text-on-surface-variant'}`}>{concept.mastery}%</span>
                            <span className="flex-1 text-right text-xs text-on-surface">{concept.name}</span>
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                              concept.mastery >= 70 ? 'bg-tertiary/20 text-tertiary'
                              : concept.mastery > 0 ? 'bg-[#ffb869]/20 text-[#ffb869]'
                              : 'bg-surface-container text-on-surface-variant'}`}>
                              {concept.mastery >= 70 ? '✓' : concept.is_core ? '★' : '·'}
                            </div>
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            localStorage.setItem('apex_active_section', sec.id);
                            navigate(`/learn?section=${sec.id}&slug=${activeSlug}`);
                          }}
                          className="btn-primary w-full py-2.5 rounded-xl mt-3 text-sm"
                        >
                          <Play size={15} /><span>ابدأ التعلم</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()}

          {/* External concepts with no insert_after (global prerequisites) */}
          {extConcepts.filter(ec => !ec.insert_after || ec.insert_after === '').map((ec, idx) => {
            const isR = idx % 2 === 0;
            const EXT_ACCENT_MAP: Record<string, { color: string; glow: string; bg: string }> = {
              prerequisite: { color: '#ffb4ab', glow: 'rgba(255,180,171,0.35)', bg: 'rgba(255,180,171,0.08)' },
              related:      { color: '#ffb869', glow: 'rgba(255,184,105,0.35)', bg: 'rgba(255,184,105,0.08)' },
              extension:    { color: '#d0bcff', glow: 'rgba(208,188,255,0.35)', bg: 'rgba(208,188,255,0.08)' },
            };
            const accent = EXT_ACCENT_MAP[ec.relation_type] || EXT_ACCENT_MAP.related;
            const firstSection = sections.find(s => s.status === 'active') || sections[0];
            return (
              <div key={ec.concept_id} className="flex flex-col items-center w-full" style={{maxWidth:560}}>
                <div className={`flex items-center w-full gap-0 ${isR ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className="flex flex-col items-center shrink-0 w-6">
                    <div className="w-2.5 h-2.5 rounded-full" style={{background: accent.color, boxShadow:`0 0 5px ${accent.glow}`}} />
                  </div>
                  <div className="shrink-0" style={{width:24, height:2, background:`linear-gradient(to ${isR?'right':'left'}, ${accent.color}80, ${accent.color}20)`, borderRadius:1}} />
                  <div
                    onClick={() => {
                      if (firstSection) {
                        localStorage.setItem('apex_active_section', firstSection.id);
                        navigate(`/learn?section=${firstSection.id}&slug=${activeSlug}&extId=${ec.concept_id}&extName=${encodeURIComponent(ec.name)}&extDesc=${encodeURIComponent(ec.description)}`);
                      }
                    }}
                    className="w-14 h-14 rounded-full flex flex-col items-center justify-center cursor-pointer hover:scale-110 transition-all shrink-0"
                    style={{ background: accent.bg, border: `2px solid ${accent.color}`, boxShadow: `0 0 12px ${accent.glow}` }}
                  >
                    <Layers size={15} style={{color: accent.color}} className="mb-0.5" />
                    <span className="text-[7px] font-bold text-center leading-tight px-1 line-clamp-2" style={{color: accent.color}}>
                      {ec.name.split(' ').slice(0,2).join(' ')}
                    </span>
                  </div>
                  <div className="flex-1" />
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="flex justify-center mt-10 mb-8">
          {(() => {
            const firstActive = sections.find(s => s.status === 'active');
            if (!activeCurriculum) {
              return (
                <button onClick={() => navigate('/upload')} className="btn-primary w-full max-w-[400px] py-3.5 text-lg rounded-xl">
                  <span>ارفع مادة</span><ChevronLeft size={20}/>
                </button>
              );
            }
            if (!diagnosticDone) {
              return (
                <button onClick={() => navigate('/diagnostic')} className="btn-primary w-full max-w-[400px] py-3.5 text-lg rounded-xl">
                  <span>ابدأ الاختبار الآن</span><ChevronLeft size={20}/>
                </button>
              );
            }
            if (firstActive) {
              return (
                <button
                  onClick={() => {
                    localStorage.setItem('apex_active_section', firstActive.id);
                    navigate(`/learn?section=${firstActive.id}&slug=${activeSlug}`);
                  }}
                  className="btn-primary w-full max-w-[400px] py-3.5 text-lg rounded-xl"
                >
                  <Play size={20}/><span>ابدأ التعلم</span>
                </button>
              );
            }
            return (
              <button onClick={() => navigate('/results')} className="btn-secondary w-full max-w-[400px] py-3.5 text-lg rounded-xl">
                <span>عرض النتائج</span><ChevronLeft size={20}/>
              </button>
            );
          })()}
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
