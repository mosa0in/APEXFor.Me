import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Brain, ChevronLeft, CheckCircle2, Sparkles, Target, Award,
  BookOpen, ArrowRight, MessageCircle, Lightbulb, XCircle, Zap, Star
} from 'lucide-react';
import AppShell from '../components/AppShell';
import SessionCoachModal from '../components/SessionCoachModal';

const API = import.meta.env.VITE_API_URL ?? '';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

interface Question {
  id: string;
  text: string;
  options: string[];
  correct_answer: string;
  difficulty: string;
  concept_id: string;
  concept_name: string;
  section_title: string;
  student_mastery: number;
}

interface Response {
  questionId: string;
  conceptId: string;
  conceptName: string;
  isCorrect: boolean;
  confidenceBefore: number;
  reflection: string;
  usedHint: boolean;
  usedSolution: boolean;
  rephraseCount: number;
  coachUsed: boolean;
}

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

/** Detect stub question text like 'Exercise 2', 'Exercise 47', etc. */
function isStubText(text: string | undefined): boolean {
  if (!text) return true;
  return /^Exercise\s+\d+$/i.test(text.trim()) || text.trim().length < 5;
}

/** Build a display-friendly question text */
function getDisplayText(q: Question | undefined): string {
  if (!q) return '';
  if (!isStubText(q.text)) return q.text;
  // Fallback: meaningful description from concept + difficulty
  const diffLabel = q.difficulty === 'easy' ? 'سهل' : q.difficulty === 'hard' ? 'صعب' : 'متوسط';
  return `تمرين — ${q.concept_name || 'مفهوم'}\nالصعوبة: ${diffLabel}\nاكتب حلك ثم قيّم إجابتك ذاتياً`;
}

// ═══════════════════════════════════════════
// Component
// ═══════════════════════════════════════════

export default function LearnSessionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sectionId = params.get('section') || '';
  const slug = params.get('slug') || '';
  const studentId = localStorage.getItem('apex_current_student') || '';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [sectionTitle, setSectionTitle] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Per-question state
  const [phase, setPhase] = useState<'confidence' | 'answer' | 'reflection' | 'self_assess' | 'result'>('confidence');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(3);
  const [reflection, setReflection] = useState('');
  const [showCorrect, setShowCorrect] = useState(false);
  const [responses, setResponses] = useState<Response[]>([]);
  const [freeAnswer, setFreeAnswer] = useState('');

  // Session state
  const [sessionComplete, setSessionComplete] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [starsEarned, setStarsEarned] = useState(0);
  const [transitionData, setTransitionData] = useState<any | null>(null);

  // Coach state
  const [coachOpen, setCoachOpen] = useState(false);

  // Load questions
  useEffect(() => {
    if (!sectionId || !slug) { navigate('/roadmap'); return; }
    loadQuestions();
  }, [sectionId, slug]);

  async function loadQuestions() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/section-questions/${slug}/${sectionId}?student_id=${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
        setSectionTitle(data.section_title || sectionId);
      }
    } catch (e) {
      console.error('[Learn] Failed to load questions:', e);
    }
    setLoading(false);
  }

  const currentQ = questions[currentIndex];
  const totalQ = questions.length;
  const progress = totalQ > 0 ? Math.round(((currentIndex) / totalQ) * 100) : 0;

  // Handle confidence selection
  function handleConfidence(level: number) {
    setConfidence(level);
    setPhase('answer');
  }

  // Handle answer selection
  function handleAnswer(optIdx: number) {
    if (showCorrect) return;
    setSelectedOption(optIdx);
  }

  // Submit answer → go to self-assessment or auto-check
  function submitAnswer() {
    if (!currentQ) return;
    const hasMCQ = currentQ.options && currentQ.options.length > 0;
    const hasCorrect = currentQ.correct_answer && currentQ.correct_answer.trim() !== '';

    if (hasMCQ && hasCorrect) {
      // MCQ with known answer
      if (selectedOption === null) return;
      const selected = currentQ.options[selectedOption];
      const correct = selected === currentQ.correct_answer;
      setShowCorrect(true);
      const resp: Response = {
        questionId: currentQ.id, conceptId: currentQ.concept_id, conceptName: currentQ.concept_name,
        isCorrect: correct, confidenceBefore: confidence, reflection: '',
        usedHint: false, usedSolution: false, rephraseCount: 0, coachUsed: false,
      };
      setResponses(prev => [...prev, resp]);
      setPhase('reflection');
    } else {
      // Open-ended / no correct answer → self-assessment
      setPhase('self_assess');
    }
  }

  // Student self-assesses
  function handleSelfAssess(correct: boolean) {
    const resp: Response = {
      questionId: currentQ?.id || '', conceptId: currentQ?.concept_id || '', conceptName: currentQ?.concept_name || '',
      isCorrect: correct, confidenceBefore: confidence, reflection: freeAnswer,
      usedHint: false, usedSolution: false, rephraseCount: 0, coachUsed: false,
    };
    setResponses(prev => [...prev, resp]);
    setShowCorrect(true);
    setPhase('result');
  }

  // Submit reflection (MCQ path)
  function submitReflection() {
    setResponses(prev => {
      const updated = [...prev];
      if (updated.length > 0) updated[updated.length - 1].reflection = reflection;
      return updated;
    });
    setPhase('result');
  }

  // Move to next question
  function nextQuestion() {
    if (currentIndex + 1 >= totalQ) {
      finishSession();
      return;
    }
    setCurrentIndex(prev => prev + 1);
    setPhase('confidence');
    setSelectedOption(null);
    setConfidence(3);
    setReflection('');
    setFreeAnswer('');
    setShowCorrect(false);
  }

  // Submit session to pipeline
  async function finishSession() {
    setSubmitting(true);
    try {
      const sessionId = `learn_${sectionId}_${Date.now()}`;
      const res = await fetch(`${API}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          sessionId,
          responses,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setPipelineResult(result);
        setStarsEarned(result.stars_earned ?? 0);
      }
    } catch (e) {
      console.error('[Learn] Session submit error:', e);
    }
    try {
      const tRes = await fetch(`${API}/api/section-progress/${studentId}/${slug}`);
      if (tRes.ok) setTransitionData(await tRes.json());
    } catch { /* ignore */ }
    setSubmitting(false);
    setSessionComplete(true);
  }

  // ═══ Loading ═══
  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-on-surface-variant">جاري تحميل الأسئلة...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  // ═══ No Questions ═══
  if (questions.length === 0) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <XCircle size={48} className="mx-auto mb-4 text-on-surface-variant opacity-40" />
            <h2 className="text-xl font-bold text-on-surface mb-2">لا توجد أسئلة لهذا القسم</h2>
            <p className="text-on-surface-variant mb-6">هذا القسم لا يحتوي على أسئلة حالياً</p>
            <button onClick={() => navigate('/roadmap')} className="btn-primary px-6 py-2 rounded-xl">
              <ChevronLeft size={18} />
              <span>العودة للخارطة</span>
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // ═══ Session Complete ═══
  if (sessionComplete) {
    const correct = responses.filter(r => r.isCorrect).length;
    const total = responses.length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const pipeline = pipelineResult?.pipeline;
    const gatesPassed = pipeline?.gates_passed ?? 0;

    return (
      <AppShell>
        <div className="page-transition max-w-lg mx-auto text-center">
          {/* Award icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-tertiary/15 flex items-center justify-center border border-tertiary/20" style={{ animation: 'fadeUp 0.5s ease-out' }}>
            <Award size={32} className="text-tertiary" />
          </div>
          <h1 className="text-2xl font-bold text-on-surface mb-2">أحسنت! أنهيت الجلسة</h1>
          <p className="text-on-surface-variant mb-4">{sectionTitle}</p>

          {/* Stars earned */}
          {starsEarned > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#ffb869]/15 border border-[#ffb869]/30 mb-6" style={{ animation: 'fadeUp 0.6s ease-out' }}>
              <Star size={16} className="text-[#ffb869] fill-[#ffb869]" />
              <span className="text-sm font-bold text-[#ffb869]">+{starsEarned} نجمة</span>
            </div>
          )}

          {/* Gates celebration */}
          {gatesPassed > 0 && (
            <div className="glass-card rounded-xl p-4 mb-4 border border-tertiary/30 bg-tertiary/5">
              <p className="text-sm font-semibold text-tertiary flex items-center justify-center gap-2">
                <Sparkles size={16} />
                <span>تجاوزت {gatesPassed} بوابة إتقان!</span>
                <Sparkles size={16} />
              </p>
              <p className="text-xs text-on-surface-variant mt-1">وصلت لمستوى إتقان عالٍ في {gatesPassed} مفهوم</p>
            </div>
          )}

          {/* Section Transition — show if this section is now complete */}
          {transitionData?.next_section && (
            <div className="glass-card rounded-xl p-4 mb-4 border border-secondary/30 bg-secondary/5">
              <p className="text-sm font-semibold text-secondary flex items-center justify-center gap-2 mb-3">
                <ArrowRight size={16} />
                <span>القسم التالي جاهز</span>
              </p>
              <p className="text-xs text-on-surface-variant mb-3">
                {transitionData.next_section.title}
              </p>
              <button
                onClick={() => navigate(`/learn?section=${transitionData.next_section.id || transitionData.next_section.title}&slug=${slug}`)}
                className="btn-primary w-full py-2.5 rounded-xl text-sm"
              >
                <span>ابدأ القسم التالي</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="glass-card rounded-xl p-4">
              <Target size={20} className="mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold text-on-surface">{accuracy}%</p>
              <p className="text-xs text-on-surface-variant">الدقة</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <BookOpen size={20} className="mx-auto mb-2 text-secondary" />
              <p className="text-2xl font-bold text-on-surface">{total}</p>
              <p className="text-xs text-on-surface-variant">أسئلة</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <Brain size={20} className="mx-auto mb-2 text-tertiary" />
              <p className="text-2xl font-bold text-on-surface">
                {pipeline ? `${Math.round(pipeline.overall_mastery * 100)}%` : '—'}
              </p>
              <p className="text-xs text-on-surface-variant">الإتقان (BKT)</p>
            </div>
          </div>

          {/* Mindset Gaps */}
          {pipeline?.mindset_gaps?.length > 0 && (
            <div className="glass-card rounded-xl p-4 mb-4 text-right">
              <p className="text-sm font-medium text-on-surface mb-3 flex items-center gap-2 justify-end">
                <span>تحليل الفجوات</span>
                <Lightbulb size={16} className="text-[#ffb869]" />
              </p>
              {pipeline.mindset_gaps.map((gap: any, i: number) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    gap.gap_type === 'conceptual' ? 'bg-error/15 text-error' : 'bg-[#ffb869]/15 text-[#ffb869]'
                  }`}>
                    {gap.gap_type === 'conceptual' ? 'مفاهيمي' : 'إجرائي'}
                  </span>
                  <p className="text-xs text-on-surface-variant flex-1">{gap.insight}</p>
                </div>
              ))}
            </div>
          )}

          {/* Coach analysis button */}
          {pipeline?.mindset_gaps?.length > 0 && (
            <button
              onClick={() => setCoachOpen(true)}
              className="w-full py-2.5 rounded-xl mb-4 flex items-center justify-center gap-2 border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-all"
            >
              <Brain size={16} />
              <span>اسأل المدرب عن هذه الفجوات</span>
            </button>
          )}

          <div className="flex gap-3">
            <button onClick={() => navigate('/roadmap')} className="btn-primary flex-1 py-3 rounded-xl">
              <ChevronLeft size={18} />
              <span>خارطة الطريق</span>
            </button>
            <button onClick={() => {
              setSessionComplete(false); setCurrentIndex(0); setResponses([]); setPhase('confidence');
              setShowCorrect(false); setSelectedOption(null); setStarsEarned(0); setTransitionData(null); loadQuestions();
            }} className="btn-outline flex-1 py-3 rounded-xl">
              <span>أعد الجلسة</span>
            </button>
          </div>
        </div>

        {/* Socratic coach modal — first gap as context */}
        {coachOpen && pipeline?.mindset_gaps?.[0] && (
          <SessionCoachModal
            conceptName={pipeline.mindset_gaps[0].concept}
            gapType={pipeline.mindset_gaps[0].gap_type}
            explanation=""
            onClose={() => setCoachOpen(false)}
          />
        )}
      </AppShell>
    );
  }

  // ═══ Main Session UI ═══
  const lastResp = responses[responses.length - 1];
  const coachContext = lastResp && !lastResp.isCorrect && lastResp.confidenceBefore >= 4 ? lastResp : null;

  return (
    <AppShell>
      <div className="page-transition max-w-2xl mx-auto">
        {/* Header: Progress */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/roadmap')} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 mx-4">
            <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1">
              <span>{sectionTitle}</span>
              <span>{currentIndex + 1}/{totalQ}</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-primary to-tertiary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          {/* Stars counter */}
          <div className="flex items-center gap-1 text-xs text-[#ffb869] font-medium">
            <Star size={13} className="fill-[#ffb869]" />
            <span>{responses.filter(r => r.isCorrect).length * 10}</span>
          </div>
        </div>

        {/* Socratic coach modal */}
        {coachOpen && coachContext && (
          <SessionCoachModal
            conceptName={coachContext.conceptName}
            gapType="conceptual"
            explanation={coachContext.reflection}
            onClose={() => setCoachOpen(false)}
          />
        )}

        {/* ═══ PHASE: Confidence ═══ */}
        {phase === 'confidence' && (
          <div className="glass-card rounded-2xl p-6 text-center" style={{ animation: 'fadeUp 0.3s ease-out' }}>
            <p className="text-sm text-on-surface-variant mb-3">قبل ما تجاوب — كم ثقتك بهالمفهوم؟</p>
            <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-xs text-primary font-medium mb-1">{currentQ?.concept_name}</p>
              <p className="text-base text-on-surface leading-relaxed text-right whitespace-pre-line" dir="auto">
                {getDisplayText(currentQ)}
              </p>
              {isStubText(currentQ?.text) && currentQ?.correct_answer && (
                <p className="text-xs text-on-surface-variant mt-2 border-t border-primary/10 pt-2">
                  💡 الإجابة المرجعية: <strong dir="auto">{currentQ.correct_answer}</strong>
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map(level => (
                <button
                  key={level}
                  onClick={() => handleConfidence(level)}
                  className={`w-12 h-12 rounded-xl border-2 text-lg font-bold transition-all hover:scale-110 ${
                    level <= 2 ? 'border-error/30 text-error hover:bg-error/10' :
                    level === 3 ? 'border-[#ffb869]/30 text-[#ffb869] hover:bg-[#ffb869]/10' :
                    'border-tertiary/30 text-tertiary hover:bg-tertiary/10'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-on-surface-variant mt-2 px-2">
              <span>ما أعرف</span>
              <span>متأكد تماماً</span>
            </div>
          </div>
        )}

        {/* ═══ PHASE: Answer ═══ */}
        {(phase === 'answer' || phase === 'self_assess' || phase === 'reflection' || phase === 'result') && (
          <div style={{ animation: 'fadeUp 0.3s ease-out' }}>
            {/* Question */}
            <div className="glass-card rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 justify-end mb-3">
                <span className="text-xs text-primary">ثقتك: {confidence}/5</span>
                <Zap size={14} className="text-primary" />
              </div>
              <p className="text-base text-on-surface leading-relaxed text-right whitespace-pre-line" dir="auto">
                {getDisplayText(currentQ)}
              </p>
              {isStubText(currentQ?.text) && currentQ?.correct_answer && (
                <p className="text-xs text-on-surface-variant mt-3 border-t border-primary/10 pt-2">
                  💡 الإجابة المرجعية: <strong dir="auto">{currentQ.correct_answer}</strong>
                </p>
              )}
            </div>

            {/* Options — MCQ or Open-ended */}
            {currentQ?.options && currentQ.options.length > 0 ? (
              <div className="space-y-2 mb-4">
                {currentQ.options.map((opt, idx) => {
                  const isSelected = selectedOption === idx;
                  const isCorrectAnswer = opt === currentQ.correct_answer;

                  let style = 'border-outline-variant/20 bg-surface-container-low/50 hover:bg-surface-container/80';
                  if (showCorrect) {
                    if (isCorrectAnswer) style = 'border-tertiary/50 bg-tertiary/10';
                    else if (isSelected && !isCorrectAnswer) style = 'border-error/50 bg-error/10';
                  } else if (isSelected) {
                    style = 'border-primary/50 bg-primary/10';
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(idx)}
                      disabled={showCorrect}
                      className={`w-full rounded-xl border p-3.5 text-right transition-all ${style}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          showCorrect && isCorrectAnswer ? 'bg-tertiary/20 text-tertiary' :
                          showCorrect && isSelected && !isCorrectAnswer ? 'bg-error/20 text-error' :
                          isSelected ? 'bg-primary/20 text-primary' :
                          'bg-surface-container text-on-surface-variant'
                        }`}>
                          {showCorrect && isCorrectAnswer ? <CheckCircle2 size={16} /> :
                           showCorrect && isSelected && !isCorrectAnswer ? <XCircle size={16} /> :
                           String.fromCharCode(65 + idx)}
                        </div>
                        <span className="flex-1 text-sm text-on-surface" dir="auto">{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Open-ended question */
              <div className="mb-4">
                <textarea
                  value={freeAnswer}
                  onChange={e => setFreeAnswer(e.target.value)}
                  placeholder="اكتب إجابتك هنا..."
                  disabled={showCorrect}
                  className="w-full h-24 bg-surface-container-low border border-outline-variant/20 rounded-xl p-4 text-sm text-on-surface text-right resize-none focus:outline-none focus:border-primary/40"
                  dir="rtl"
                />
              </div>
            )}

            {/* Submit answer button */}
            {!showCorrect && (selectedOption !== null || freeAnswer.trim().length > 0) && (
              <button onClick={submitAnswer} className="btn-primary w-full py-3 rounded-xl text-base">
                <span>تأكيد الإجابة</span>
              </button>
            )}

            {/* ═══ PHASE: Self-Assessment ═══ */}
            {phase === 'self_assess' && (
              <div className="glass-card rounded-2xl p-5 mt-4" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                <p className="text-sm text-on-surface-variant mb-3 text-right">هل أجبت بشكل صحيح؟ (تقييم ذاتي)</p>
                <div className="flex gap-3">
                  <button onClick={() => handleSelfAssess(true)}
                    className="flex-1 py-3 rounded-xl border-2 border-tertiary/30 text-tertiary hover:bg-tertiary/10 transition-all font-medium text-sm">
                    ✅ نعم، أجبت صح
                  </button>
                  <button onClick={() => handleSelfAssess(false)}
                    className="flex-1 py-3 rounded-xl border-2 border-error/30 text-error hover:bg-error/10 transition-all font-medium text-sm">
                    ❌ لا، أخطأت أو ما عرفت
                  </button>
                </div>
              </div>
            )}

            {/* ═══ PHASE: Reflection (MCQ only) ═══ */}
            {phase === 'reflection' && (
              <div className="glass-card rounded-2xl p-5 mt-4" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                <p className="text-sm text-on-surface-variant mb-3 text-right flex items-center gap-2 justify-end">
                  <span>كيف وصلت لهذه الإجابة؟</span>
                  <MessageCircle size={16} className="text-secondary" />
                </p>
                <textarea
                  value={reflection}
                  onChange={e => setReflection(e.target.value)}
                  placeholder="اكتب تفسيرك هنا... (هذا يساعدنا نفهم تفكيرك)"
                  className="w-full h-20 bg-surface-container-low border border-outline-variant/20 rounded-xl p-3 text-sm text-on-surface text-right resize-none focus:outline-none focus:border-primary/40"
                  dir="rtl"
                />
                <button
                  onClick={submitReflection}
                  className="btn-primary w-full py-2.5 rounded-xl mt-3"
                >
                  <span>{reflection.length > 0 ? 'إرسال التفسير' : 'تخطي'}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* ═══ PHASE: Result ═══ */}
            {phase === 'result' && (() => {
              const lastResp = responses[responses.length - 1];
              const isConceptualGap = lastResp && !lastResp.isCorrect && lastResp.confidenceBefore >= 4;
              return (
                <div className="glass-card rounded-2xl p-5 mt-4" style={{ animation: 'fadeUp 0.3s ease-out' }}>
                  <div className={`text-center p-4 rounded-xl mb-3 ${
                    lastResp?.isCorrect
                      ? 'bg-tertiary/10 border border-tertiary/20'
                      : 'bg-error/10 border border-error/20'
                  }`}>
                    {lastResp?.isCorrect ? (
                      <>
                        <CheckCircle2 size={28} className="mx-auto mb-2 text-tertiary" />
                        <p className="text-sm font-medium text-tertiary">إجابة صحيحة! أحسنت 🎉</p>
                      </>
                    ) : (
                      <>
                        <XCircle size={28} className="mx-auto mb-2 text-error" />
                        <p className="text-sm font-medium text-error">
                          الإجابة الصحيحة: <strong>{currentQ?.correct_answer}</strong>
                        </p>
                      </>
                    )}
                  </div>

                  {/* Coach button — auto-shown on conceptual gap */}
                  {isConceptualGap && (
                    <button
                      onClick={() => {
                        setCoachOpen(true);
                        setResponses(prev => {
                          const updated = [...prev];
                          if (updated.length > 0) updated[updated.length - 1] = { ...updated[updated.length - 1], coachUsed: true };
                          return updated;
                        });
                      }}
                      className="w-full py-2.5 rounded-xl mb-3 flex items-center justify-center gap-2 border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-all"
                    >
                      <Brain size={16} />
                      <span>اسأل المدرب السقراطي</span>
                      <Sparkles size={14} />
                    </button>
                  )}

                  <button onClick={nextQuestion} className="btn-primary w-full py-3 rounded-xl">
                    <span>{currentIndex + 1 >= totalQ ? 'إنهاء الجلسة' : 'السؤال التالي'}</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </AppShell>
  );
}
