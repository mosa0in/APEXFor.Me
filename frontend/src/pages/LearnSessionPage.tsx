import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Brain, Sparkles, Target,
  Lightbulb, BookOpen, Zap, MessageSquare, X, Send,
} from 'lucide-react';
import { getAuthHeader } from '../services/backend';

const API = import.meta.env.VITE_API_URL ?? '';
const MAX_COACH_MSGS = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConceptMeta {
  id: string; name: string; description: string; is_core: boolean; difficulty_level: number;
}
interface SectionOverview {
  slug: string; section_id: string; section_title: string;
  chapter_title: string; book_title: string; concepts: ConceptMeta[];
}
interface QuickCheck {
  question_text: string; question_type: string;
  options: string[]; correct_answer: string; answer_hint: string;
}
interface Slides {
  concept_id: string; concept_name: string; section_title: string; chapter_title: string;
  headline: string; intro_text: string; explanation: string;
  formula: string | null; formula_explanation: string | null;
  key_points: string[]; real_example: string; ai_insight: string; apex_prediction: string;
  mastery_estimate: number; quick_check: QuickCheck | null;
  is_core: boolean; difficulty_level: number;
}
interface TestQuestion {
  question_text: string; question_type: 'mcq' | 'true_false' | 'text_input';
  options: string[]; correct_answer: string; answer_hint: string; difficulty: string;
}
interface CoachMsg { id: number; text: string; isUser: boolean; isAI?: boolean; }

type Phase = 'loading' | 'lesson' | 'test_intro';

// ─── Lesson Coach Panel ───────────────────────────────────────────────────────

function LessonCoachPanel({ isOpen, onClose, slides, studentId: _studentId }: {
  isOpen: boolean; onClose: () => void; slides: Slides | null; studentId: string;
}) {
  const [messages, setMessages] = useState<CoachMsg[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userMsgCount, setUserMsgCount] = useState(0);
  const msgIdRef = useRef(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isOpen || !slides) return;
    msgIdRef.current = 0;
    setMessages([]);
    setUserMsgCount(0);
    setInputText('');
    const masteryPct = Math.round((slides.mastery_estimate || 0) * 100);
    const masteryLabel = masteryPct >= 70 ? 'جيد' : masteryPct >= 40 ? 'في طريق الإتقان' : 'بداية التعلم';
    setTimeout(() => {
      setMessages([{
        id: ++msgIdRef.current,
        text: `مرحباً! درسنا اليوم: ${slides.concept_name}\n\nمستواك الحالي: ${masteryPct}% (${masteryLabel}) 📊${slides.formula ? `\n\nالصيغة الأساسية:\n${slides.formula}` : ''}\n\nلديك ${MAX_COACH_MSGS} رسائل معي في هذه الجلسة. اسألني عن أي شيء في الدرس! 💬`,
        isUser: false,
      }]);
    }, 300);
  }, [isOpen, slides?.concept_id]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isTyping || userMsgCount >= MAX_COACH_MSGS || !slides) return;
    setInputText('');
    setMessages(prev => [...prev, { id: ++msgIdRef.current, text, isUser: true }]);
    setUserMsgCount(c => c + 1);
    setIsTyping(true);
    try {
      const res = await fetch(`${API}/api/learn/coach-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          concept_name: slides.concept_name,
          explanation: slides.explanation.substring(0, 400),
          formula: slides.formula || null,
          key_points: slides.key_points || [],
          message: text,
        }),
      });
      const data = res.ok ? await res.json() : null;
      const replies: string[] = data?.messages || ['سؤال رائع! فكّر في الصيغة الأساسية وجرّب تطبيقها 💡'];
      setIsTyping(false);
      replies.forEach((r, i) =>
        setTimeout(() => setMessages(prev => [...prev, { id: ++msgIdRef.current, text: r, isUser: false, isAI: true }]), i * 100)
      );
    } catch {
      setIsTyping(false);
      setMessages(prev => [...prev, { id: ++msgIdRef.current, text: 'تعذّر الاتصال، لكن فكّر: كيف يرتبط هذا المفهوم بما تعرفه؟ 💭', isUser: false }]);
    }
  }, [inputText, isTyping, userMsgCount, slides]);

  if (!isOpen) return null;
  const remaining = MAX_COACH_MSGS - userMsgCount;
  return (
    <>
      <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-[90] lg:bg-transparent lg:backdrop-blur-none" onClick={onClose} />
      <div className="coach-panel fixed top-0 left-0 h-full z-[95] flex flex-col" style={{ animation: 'coach-slide-in 0.35s ease-out' }}>
        <div className="coach-panel-header">
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-bright/40 transition-all">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-bold text-sm text-on-surface">كوتش الدرس</p>
              <p className="text-[10px] text-primary flex items-center gap-1 justify-end">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                {remaining > 0 ? `${remaining} رسائل متبقية` : 'انتهت الرسائل'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
              <Brain className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
        <div ref={chatRef} className="coach-chat-area">
          {messages.map(msg => (
            <div key={msg.id} className={`coach-message ${msg.isUser ? 'coach-msg-user' : 'coach-msg-bot'}`}>
              <div className={`coach-bubble ${msg.isUser ? 'coach-bubble-user' : 'coach-bubble-bot'} ${msg.isAI ? 'coach-bubble-ai' : ''}`}>
                {msg.isAI && (
                  <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-primary/20">
                    <Brain className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-bold text-primary">كوتش AI</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="coach-message coach-msg-bot">
              <div className="coach-bubble coach-bubble-bot">
                <div className="coach-typing"><span /><span /><span /></div>
              </div>
            </div>
          )}
        </div>
        <div className="coach-panel-footer">
          {userMsgCount >= MAX_COACH_MSGS ? (
            <div className="text-center py-3 text-xs text-on-surface-variant">
              🎓 نفدت رسائل الكوتش لهذه الجلسة
            </div>
          ) : (
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="اسأل عن أي شيء في الدرس..."
                className="w-full bg-surface-container-low/60 border border-outline-variant/30 rounded-full py-2.5 px-5 text-sm text-on-surface focus:outline-none focus:border-primary/40 transition-colors"
                dir="rtl"
              />
              <button onClick={handleSend} disabled={!inputText.trim() || isTyping}
                className="absolute left-2 w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-30 bg-primary/80 hover:bg-primary text-on-primary">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Convert learn question → SessionContext Question format ──────────────────

function convertLearnQuestion(q: TestQuestion, idx: number, conceptId: string, conceptName: string) {
  const diffMap: Record<string, number> = { easy: 1, medium: 3, hard: 4 };
  let options: { label: string; content: string }[], correctIndex: number;
  if (q.question_type === 'true_false') {
    options = [{ label: 'أ', content: 'صح' }, { label: 'ب', content: 'خطأ' }];
    correctIndex = (q.correct_answer === 'صح' || q.correct_answer === 'True') ? 0 : 1;
  } else if (q.question_type === 'text_input') {
    // Self-evaluation for essay: student reads, reflects, self-reports
    options = [{ label: 'أ', content: 'نعم، أعرف الإجابة ✓' }, { label: 'ب', content: 'لا، لم أعرف ✗' }];
    correctIndex = 0;
  } else {
    options = q.options.map((o, i) => ({ label: String.fromCharCode(65 + i), content: o }));
    correctIndex = Math.max(0, q.options.indexOf(q.correct_answer));
  }
  return {
    id: idx + 1,
    text: q.question_text,
    questionType: 'mcq',
    rephrasedText: q.question_text,
    conceptId,
    concept: conceptName,
    sectionType: 'main' as const,
    difficulty: diffMap[q.difficulty] || 2,
    options,
    correctIndex,
    correctAnswer: q.correct_answer,
    // stepLabel intentionally empty so the hint modal doesn't duplicate the text
    hint: q.answer_hint ? { text: q.answer_hint, stepLabel: '', stepContent: '' } : undefined,
    solution: {
      steps: [{
        number: 1,
        title: 'الإجابة الصحيحة',
        desc: q.answer_hint || 'راجع المفهوم وتأكد من فهم المنطق.',
        math: '',
        result: q.correct_answer,
      }],
      tip: q.answer_hint || 'ركّز على فهم السبب لا مجرد الحفظ.',
    },
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LearnSessionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sectionId = params.get('section') || '';
  const slug = params.get('slug') || '';
  const extId = params.get('extId') || '';
  const extName = decodeURIComponent(params.get('extName') || '');
  const extDesc = decodeURIComponent(params.get('extDesc') || '');
  const startConcept = params.get('startConcept') || '';
  const studentId = localStorage.getItem('apex_current_student') || '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [overview, setOverview] = useState<SectionOverview | null>(null);
  const [conceptIdx, setConceptIdx] = useState(0);
  const [slides, setSlides] = useState<Slides | null>(null);
  const [loadingSlides, setLoadingSlides] = useState(false);
  const [loadingTest, setLoadingTest] = useState(false);

  const [testReady, setTestReady] = useState(false);
  const [prefetchedQuestions, setPrefetchedQuestions] = useState<ReturnType<typeof convertLearnQuestion>[] | null>(null);
  const [isPrefetchingTest, setIsPrefetchingTest] = useState(false);

  const [qcSelected, setQcSelected] = useState<number | null>(null);
  const [qcRevealed, setQcRevealed] = useState(false);

  const [lessonCoachOpen, setLessonCoachOpen] = useState(false);

  useEffect(() => {
    if (!sectionId || !slug) { navigate('/roadmap'); return; }
    initSection();
  }, [sectionId, slug]);

  async function initSection() {
    setPhase('loading');

    if (extId && extName) {
      // External/AI-generated concept — synthesize a one-concept section overview
      const syntheticOverview: SectionOverview = {
        slug, section_id: sectionId,
        section_title: 'مفاهيم تكميلية',
        chapter_title: '', book_title: '',
        concepts: [{ id: extId, name: extName, description: extDesc, is_core: false, difficulty_level: 0.5 }],
      };
      setOverview(syntheticOverview);
      setConceptIdx(0);
      await fetchSlides(slug, extId, extName, extDesc);
      return;
    }

    try {
      const res = await fetch(`${API}/api/learn/${slug}/section/${sectionId}`, { headers: getAuthHeader() });
      if (!res.ok) { navigate('/roadmap'); return; }
      const data: SectionOverview = await res.json();
      setOverview(data);
      let startIdx = 0;
      if (startConcept) {
        const idx = data.concepts.findIndex(c => c.id === startConcept);
        if (idx >= 0) startIdx = idx;
      }
      setConceptIdx(startIdx);
      if (data.concepts.length > 0) await fetchSlides(slug, data.concepts[startIdx].id);
    } catch { navigate('/roadmap'); }
  }

  async function fetchSlides(slugArg: string, conceptId: string, cExtName?: string, cExtDesc?: string) {
    setLoadingSlides(true);
    setTestReady(false);
    setPrefetchedQuestions(null);
    setQcSelected(null); setQcRevealed(false);
    try {
      let url = `${API}/api/learn/${slugArg}/concept/${conceptId}/slides`;
      const qps: string[] = [];
      if (cExtName) qps.push(`ext_name=${encodeURIComponent(cExtName)}`);
      if (cExtDesc) qps.push(`ext_desc=${encodeURIComponent(cExtDesc)}`);
      if (qps.length) url += '?' + qps.join('&');
      const res = await fetch(url, { headers: getAuthHeader() });
      if (res.ok) {
        const slidesData: Slides = await res.json();
        setSlides(slidesData);
        setPhase('lesson');
        prefetchTestBackground(conceptId, slidesData.concept_name, slugArg);
      }
    } catch (e) { console.error('[Learn] slides error:', e); }
    setLoadingSlides(false);
  }

  async function prefetchTestBackground(conceptId: string, conceptName: string, slugArg: string) {
    setIsPrefetchingTest(true);
    try {
      const res = await fetch(`${API}/api/learn/${slugArg}/concept/${conceptId}/test`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        const qs: TestQuestion[] = data.questions || [];
        const converted = qs.map((q, i) => convertLearnQuestion(q, i, conceptId, conceptName));
        setPrefetchedQuestions(converted);
        setTestReady(true);
      }
    } catch (e) { console.error('[Learn] prefetch test error:', e); }
    setIsPrefetchingTest(false);
  }

  async function fetchTest(conceptId: string) {
    if (prefetchedQuestions && testReady) {
      localStorage.setItem('apex_learn_questions', JSON.stringify(prefetchedQuestions));
      localStorage.setItem('apex_learn_return', '/roadmap');
      localStorage.removeItem('apex_session');
      navigate('/diagnostic');
      return;
    }
    setLoadingTest(true);
    try {
      const res = await fetch(`${API}/api/learn/${slug}/concept/${conceptId}/test`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        const qs: TestQuestion[] = data.questions || [];
        const conceptName = slides?.concept_name || '';
        const converted = qs.map((q, i) => convertLearnQuestion(q, i, conceptId, conceptName));
        localStorage.setItem('apex_learn_questions', JSON.stringify(converted));
        localStorage.setItem('apex_learn_return', '/roadmap');
        localStorage.removeItem('apex_session');
        navigate('/diagnostic');
      }
    } catch (e) { console.error('[Learn] test error:', e); }
    setLoadingTest(false);
  }

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handlePrevConcept() {
    if (!overview || conceptIdx === 0) return;
    const newIdx = conceptIdx - 1;
    setConceptIdx(newIdx);
    fetchSlides(slug, overview.concepts[newIdx].id);
  }

  function handleNextFromLesson() { setPhase('test_intro'); }

  function handleStartTest() {
    if (!slides) return;
    fetchTest(slides.concept_id);
  }

  function handleQCAnswer(idx: number) {
    if (qcRevealed) return;
    setQcSelected(idx); setQcRevealed(true);
  }

  // ─── Phase: Loading ───────────────────────────────────────────────────────

  if (phase === 'loading' || loadingSlides) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-on-surface-variant">
            {loadingSlides ? 'جاري تحضير الدرس بالذكاء الاصطناعي...' : 'جاري التحميل...'}
          </p>
          <p className="text-xs text-on-surface-variant/50 mt-2">قد يستغرق الأمر لحظة في المرة الأولى</p>
        </div>
      </div>
    );
  }

  // ─── Phase: Test Intro ────────────────────────────────────────────────────

  if (phase === 'test_intro') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Target size={36} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-on-surface mb-2">حان وقت الاختبار!</h1>
          <p className="text-sm text-on-surface-variant mb-6">{slides?.concept_name}</p>
          <div className="glass-card rounded-2xl p-5 mb-6">
            <p className="text-sm text-on-surface-variant mb-3">سيتم فتح الاختبار التشخيصي الكامل بنفس نظام الاختبار</p>
            <div className="mt-3 pt-3 border-t border-outline-variant/10 space-y-1 text-xs text-on-surface-variant text-center">
              <p>✏️ تلميح + كوتش AI + إعادة صياغة</p>
              <p className="text-primary/60">مطلوب: إجابة + شرح تفكيرك + مستوى الثقة</p>
            </div>
          </div>
          {loadingTest ? (
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-on-surface-variant">جاري تحضير الأسئلة بالذكاء الاصطناعي...</span>
            </div>
          ) : (
            <button onClick={handleStartTest} className="btn-primary w-full py-4 rounded-2xl text-base font-bold">
              <Zap size={20} /><span>ابدأ الاختبار</span>
            </button>
          )}
          <button onClick={() => setPhase('lesson')} className="mt-4 text-sm text-on-surface-variant hover:text-on-surface transition-colors">
            العودة للدرس ←
          </button>
        </div>
      </div>
    );
  }

  // ─── Phase: Lesson ────────────────────────────────────────────────────────

  if (!slides || !overview) return null;

  const totalConcepts = overview.concepts.length;
  const conceptProgress = totalConcepts > 0 ? Math.round(((conceptIdx + 1) / totalConcepts) * 100) : 0;
  const explanationParagraphs = (slides.explanation || '').split(/\n+/).filter(Boolean);

  return (
    <div className="min-h-screen bg-surface" dir="rtl">
      <LessonCoachPanel isOpen={lessonCoachOpen} onClose={() => setLessonCoachOpen(false)} slides={slides} studentId={studentId} />

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur-md border-b border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={() => navigate('/roadmap')}
            className="flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors shrink-0">
            <ChevronRight size={18} />
            <span className="text-sm hidden sm:block">الخارطة</span>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs text-on-surface-variant mb-1">
              <span className="truncate">{overview.section_title}</span>
              <span className="shrink-0 mr-2">{conceptIdx + 1}/{totalConcepts}</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-l from-primary to-tertiary rounded-full transition-all duration-500"
                style={{ width: `${conceptProgress}%` }} />
            </div>
          </div>
          <button onClick={() => setLessonCoachOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all text-xs font-medium shrink-0">
            <MessageSquare size={14} />
            <span className="hidden sm:block">الكوتش</span>
          </button>
          <span className="text-xs font-bold text-primary tracking-wider shrink-0">APEX</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <p className="text-xs text-on-surface-variant mb-4">
          {overview.chapter_title} • {overview.section_title}
        </p>

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-black text-on-surface leading-tight mb-3">{slides.headline}</h1>
          <p className="text-base text-on-surface-variant leading-relaxed max-w-2xl">{slides.intro_text}</p>
        </div>

        {/* ── Bento Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">

          {/* Main column */}
          <div className="lg:col-span-8 space-y-4">
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-sm font-bold text-primary mb-4 flex items-center gap-2">
                <BookOpen size={15} /><span>الشرح</span>
              </h2>
              <div className="space-y-3">
                {explanationParagraphs.map((para, i) => (
                  <p key={i} className="text-sm text-on-surface leading-relaxed" dir="auto">{para}</p>
                ))}
              </div>
            </div>

            {slides.formula && (
              <div className="rounded-2xl p-5 bg-[#0f0c18] border border-primary/20">
                <p className="text-xs text-primary font-bold uppercase tracking-wider mb-3">الصيغة الأساسية</p>
                <pre className="font-mono text-primary text-sm leading-relaxed overflow-x-auto whitespace-pre-wrap" dir="ltr">
                  {slides.formula}
                </pre>
                {slides.formula_explanation && (
                  <p className="text-xs text-on-surface-variant mt-3 border-t border-primary/10 pt-3" dir="auto">
                    {slides.formula_explanation}
                  </p>
                )}
              </div>
            )}

            {slides.key_points?.length > 0 && (
              <div className="glass-card rounded-2xl p-5">
                <h2 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2">
                  <Sparkles size={15} className="text-primary" /><span>النقاط الأساسية</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {slides.key_points.map((point, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/10">
                      <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-xs text-on-surface leading-relaxed" dir="auto">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {slides.real_example && (
              <div className="glass-card rounded-2xl p-5" style={{ borderRight: '4px solid var(--color-tertiary)' }}>
                <p className="text-xs text-tertiary font-bold mb-2">مثال من الواقع</p>
                <p className="text-sm text-on-surface leading-relaxed" dir="auto">{slides.real_example}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl p-5 bg-[#1c1528] border border-[#ffb869]/20">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={15} className="text-[#ffb869]" />
                <span className="text-xs font-bold text-[#ffb869]">إضاءة ذكية</span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed" dir="auto">
                {slides.ai_insight || 'ركّز على الفهم العميق لهذا المفهوم قبل التطبيق.'}
              </p>
            </div>

            <div className="rounded-2xl p-5 bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Target size={15} className="text-primary" />
                <span className="text-xs font-bold text-primary">تنبؤ APEX</span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed mb-4" dir="auto">
                {slides.apex_prediction || 'ركّز على الأسئلة التطبيقية في هذا المفهوم.'}
              </p>
              <div className="border-t border-primary/10 pt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-on-surface-variant">إتقانك (BKT)</span>
                  <span className="text-xs font-bold text-primary">{Math.round((slides.mastery_estimate || 0) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary to-tertiary transition-all duration-700"
                    style={{ width: `${Math.round((slides.mastery_estimate || 0) * 100)}%` }} />
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-4 flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">مستوى الصعوبة</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={`w-2 h-2 rounded-full ${i <= Math.round((slides.difficulty_level || 0.5) * 5) ? 'bg-primary' : 'bg-surface-container-high'}`} />
                ))}
              </div>
            </div>

            <button onClick={() => setLessonCoachOpen(true)}
              className="w-full rounded-2xl p-4 bg-surface-container/40 border border-primary/15 hover:bg-surface-container/70 transition-all text-right">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Brain size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-on-surface">اسأل الكوتش</p>
                  <p className="text-xs text-on-surface-variant">5 رسائل لكل جلسة درس</p>
                </div>
                <MessageSquare size={14} className="text-primary mr-auto" />
              </div>
            </button>
          </div>
        </div>

        {/* Quick Check */}
        {slides.quick_check && (
          <div className="glass-card rounded-2xl p-6 mb-6 border border-primary/10">
            <h2 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2">
              <Zap size={15} className="text-primary" /><span>تحقق سريع من الفهم</span>
            </h2>
            <p className="text-sm text-on-surface mb-4 leading-relaxed" dir="auto">{slides.quick_check.question_text}</p>
            {slides.quick_check.options.length > 0 && (
              <div className="space-y-2">
                {slides.quick_check.options.map((opt, idx) => {
                  const isCorrect = opt === slides.quick_check!.correct_answer;
                  let style = 'border-outline-variant/20 bg-surface-container-low/50 hover:bg-surface-container/80';
                  if (qcRevealed) {
                    if (isCorrect) style = 'border-tertiary/50 bg-tertiary/10';
                    else if (qcSelected === idx) style = 'border-error/50 bg-error/10';
                  } else if (qcSelected === idx) { style = 'border-primary/50 bg-primary/10'; }
                  return (
                    <button key={idx} onClick={() => handleQCAnswer(idx)} disabled={qcRevealed}
                      className={`w-full rounded-xl border p-3 text-right transition-all ${style}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          qcRevealed && isCorrect ? 'bg-tertiary/20 text-tertiary' :
                          qcRevealed && qcSelected === idx && !isCorrect ? 'bg-error/20 text-error' :
                          qcSelected === idx ? 'bg-primary/20 text-primary' : 'bg-surface-container text-on-surface-variant'
                        }`}>
                          {qcRevealed && isCorrect ? '✓' : qcRevealed && qcSelected === idx ? '✗' : String.fromCharCode(65 + idx)}
                        </div>
                        <span className="text-sm text-on-surface" dir="auto">{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {qcRevealed && slides.quick_check.answer_hint && (
              <p className="text-xs text-on-surface-variant mt-3 p-3 rounded-xl bg-surface-container-low/30" dir="auto">
                💡 {slides.quick_check.answer_hint}
              </p>
            )}
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex items-center gap-3 pb-8">
          <button onClick={handlePrevConcept} disabled={conceptIdx === 0}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all disabled:opacity-30">
            <ChevronRight size={18} /><span className="text-sm">السابق</span>
          </button>
          <div className="flex-1 flex items-center justify-center gap-1.5">
            {overview.concepts.map((_, i) => (
              <div key={i} className={`rounded-full transition-all duration-300 ${i === conceptIdx ? 'w-4 h-2 bg-primary' : 'w-2 h-2 bg-surface-container-high'}`} />
            ))}
          </div>
          <button
            onClick={handleNextFromLesson}
            disabled={isPrefetchingTest && !testReady}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all duration-300 ${
              testReady
                ? 'bg-tertiary text-on-tertiary shadow-[0_0_16px_rgba(255,184,105,0.45)] hover:opacity-90'
                : isPrefetchingTest
                ? 'bg-surface-container text-on-surface-variant opacity-60 cursor-wait'
                : 'bg-primary text-on-primary hover:opacity-90'
            }`}
          >
            {isPrefetchingTest && !testReady ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">جاري تجهيز الاختبار...</span>
              </>
            ) : (
              <>
                <span className="text-sm">{conceptIdx + 1 >= totalConcepts ? 'إنهاء الدرس' : 'التالي والاختبار'}</span>
                <ChevronLeft size={18} />
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
