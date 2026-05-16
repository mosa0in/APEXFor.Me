import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionProvider, useSession } from './context/SessionContext';
import { MAX_REPHRASE_PER_QUESTION } from './context/SessionContext';
import Layout from './components/Layout';
import SessionStart from './components/SessionStart';
import MainQuestion from './components/MainQuestion';
import PuzzleView from './components/PuzzleView';
import TeachingStrategies from './components/Strategies';
import SolutionView from './components/SolutionView';
import { SessionEndSummary, Modal } from './components/Modals';
import BrainstormingView from './components/BrainstormingView';
import CoachPanel from './components/CoachPanel';
import { aiRephraseQuestion, isAIAvailable } from './services/ai';
import { getAuthHeader } from './services/backend';
import { 
  RefreshCcw, SupportAgent, PsychologyAlt, Lightbulb, Check, ArrowRight,
  Flag, SentimentSatisfied, SentimentNeutral, SentimentDissatisfied,
  HelpCircle, Category, ArrowDown, Scale, SmartToy, Extension, Coffee, Search
} from './components/icons';

export default function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}

type AppState = 'start' | 'question' | 'checkpoint' | 'puzzle' | 'strategies' | 'simpler_example' | 'find_error' | 'conceptual' | 'summary' | 'solution' | 'brainstorming';

function AppContent() {
  const session = useSession();
  const { state, questions, questionsLoading, isCheckpoint, isLastQuestion, nextQuestion, setFeedbackLevel, markHintUsed, markCoachUsed, markRephraseUsed, markRestRequested, startBreak, endBreak, resetSession, showToast, currentQuestion, setAICoachResponse, setAILoading, startSession, getSessionSummary, submitResponse } = session;
  const navigate = useNavigate();

  const [appState, setAppState] = useState<AppState>('start');
  const [modalType, setModalType] = useState<'none' | 'regeneration' | 'hint' | 'break' | 'confirm_exit'>('none');
  const [coachPanelOpen, setCoachPanelOpen] = useState(false);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const breakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // GAP-02 + GAP-09: Auto-start session from LoginPage's saved student ID
  useEffect(() => {
    if (!state.isActive && appState === 'start') {
      const savedStudent = localStorage.getItem('apex_current_student');
      if (savedStudent) {
        startSession(savedStudent);
        setAppState('question');
      }
    }
  }, []);

  useEffect(() => {
    if (state.isActive && appState === 'start') setAppState('question');
  }, [state.isActive]);

  const handleNext = () => {
    if (isLastQuestion) {
      // Skip internal summary — go straight to /results
      handleFinishAndNavigate();
    } else if (isCheckpoint) {
      setAppState('checkpoint');
    } else {
      nextQuestion();
      setAppState('question');
    }
  };

  const handleAfterCheckpoint = () => { nextQuestion(); setAppState('question'); };

  const handleRephrase = useCallback(async () => {
    if (!currentQuestion) return;
    if (state.currentRephraseCount >= MAX_REPHRASE_PER_QUESTION) {
      showToast(`⚠️ استهلكت كل محاولات إعادة الصياغة (${MAX_REPHRASE_PER_QUESTION}/${MAX_REPHRASE_PER_QUESTION}). استعن بالكوتش!`, 'error');
      return;
    }
    const attemptNumber = state.currentRephraseCount + 1;
    setModalType('regeneration');
    try {
      const result = await aiRephraseQuestion(currentQuestion, attemptNumber);
      if (result.isAI) {
        markRephraseUsed(result.text, result.hint, result.styleLabel, 'ai_rephrase');
        showToast(`✨ صياغة ${result.styleLabel} (${attemptNumber}/${MAX_REPHRASE_PER_QUESTION})`, 'success');
      } else {
        markRephraseUsed(result.text, result.hint, result.styleLabel, 'static_fallback');
        showToast(`📝 إعادة صياغة (${attemptNumber}/${MAX_REPHRASE_PER_QUESTION})`, 'success');
      }
    } catch (err) {
      console.error('[APEX] Rephrase error:', err);
      markRephraseUsed(undefined, undefined, undefined, 'error_fallback');
      showToast('تم إعادة صياغة السؤال', 'success');
    } finally {
      setModalType('none');
    }
  }, [currentQuestion, markRephraseUsed, showToast, state.currentRephraseCount]);

  const handleShowHint = () => {
    if (!currentQuestion?.hint) {
      showToast('لا يوجد تلميح لهذا السؤال', 'info');
      return;
    }
    markHintUsed();
    setModalType('hint');
  };
  const handleEndSession = () => {
    if (state.responses.length > 0) {
      setModalType('confirm_exit');
    } else {
      handleFinishAndNavigate();
    }
  };

  const handleSolutionNext = useCallback(() => {
    if (currentQuestion) {
      submitResponse({
        selectedAnswer: '[solution_viewed]',
        selectedIndex: -1,
        isCorrect: false,
        usedSolution: true,
        confidence: 1,
        difficulty: currentQuestion.difficulty,
        reflection: 'عرض الحل النموذجي',
      });
    }
    // isCheckpoint uses the CURRENT responses count, check +1 manually
    const newCount = state.responses.length + 1;
    const willCheckpoint = newCount > 0 && newCount % 5 === 0;
    if (isLastQuestion) {
      handleFinishAndNavigate();
    } else if (willCheckpoint) {
      setAppState('checkpoint');
    } else {
      nextQuestion();
      setAppState('question');
    }
  }, [currentQuestion, submitResponse, state.responses.length, isLastQuestion, nextQuestion]);

  const handleBreakOpen = () => {
    markRestRequested();
    startBreak();
    setBreakSeconds(0);
    if (breakIntervalRef.current) clearInterval(breakIntervalRef.current);
    breakIntervalRef.current = setInterval(() => setBreakSeconds(s => s + 1), 1000);
    setModalType('break');
  };

  const handleBreakClose = () => {
    endBreak();
    if (breakIntervalRef.current) { clearInterval(breakIntervalRef.current); breakIntervalRef.current = null; }
    setBreakSeconds(0);
    setModalType('none');
  };

  // GAP-01 + GAP-04 + GAP-05: Save results to student state and navigate to /results
  const handleFinishAndNavigate = () => {
    // Save results so Roadmap/Results pages can read them
    const summary = getSessionSummary();
    const responses = state.responses;

    // Build mastery snapshots per concept
    const masteryMap: Record<string, { correct: number; total: number; name: string }> = {};
    responses.forEach(r => {
      if (!masteryMap[r.conceptId]) masteryMap[r.conceptId] = { correct: 0, total: 0, name: r.conceptName };
      masteryMap[r.conceptId].total++;
      if (r.isCorrect) masteryMap[r.conceptId].correct++;
    });

    const mastery_snapshots: Record<string, any> = {};
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    Object.entries(masteryMap).forEach(([id, data]) => {
      const est = data.total > 0 ? data.correct / data.total : 0;
      mastery_snapshots[id] = {
        concept_id: id,
        concept_name: data.name,
        mastery_estimate: est,
        mastery_level: est >= 0.7 ? 'proficient' : est >= 0.4 ? 'developing' : 'novice',
        attempts: data.total,
        correct_count: data.correct,
      };
      if (est >= 0.7) strengths.push(data.name);
      else if (est < 0.4) weaknesses.push(data.name);
    });

    const studentState = {
      student_id: state.studentId,
      diagnostic_complete: true,
      accuracy: summary.accuracy,
      overall_mastery: summary.accuracy / 100,
      total_time_seconds: summary.totalTime,
      total_questions: summary.totalQuestions,
      correct_count: summary.correctCount,
      diagnostic_responses: responses,
      mastery_snapshots,
      strongest_concepts: strengths,
      weakest_concepts: weaknesses,
      completed_at: new Date().toISOString(),
    };
    // Ensure student ID is synced
    localStorage.setItem('apex_current_student', state.studentId);
    localStorage.setItem(`apex_student_${state.studentId}`, JSON.stringify(studentState));
    console.log('[APEX] Saved to localStorage:', state.studentId, 'accuracy:', summary.accuracy, 'questions:', summary.totalQuestions);

    // GAP-07: POST to backend API (fire-and-forget)
    const questionById = new Map(questions.map(q => [q.id, q]));
    const apiPayload = {
      sessionId: state.sessionId,
      studentId: state.studentId,
      startedAt: studentState.completed_at,
      totalQuestions: summary.totalQuestions,
      correctAnswers: summary.correctCount,
      accuracy: summary.accuracy,
      avgConfidence: summary.avgConfidence,
      avgDifficulty: summary.avgDifficulty,
      totalTimeSeconds: summary.totalTime,
      rephraseCount: summary.rephraseCount,
      coachRequests: summary.coachCount,
      masterySnapshot: mastery_snapshots,
      strongestConcepts: strengths,
      weakestConcepts: weaknesses,
      responses: responses.map(r => {
        const question = questionById.get(r.questionId);
        return {
          questionId: r.questionId,
          questionText: question?.text ?? '',
          conceptId: r.conceptId,
          conceptName: r.conceptName,
          difficulty: r.difficulty,
          selectedIndex: r.selectedIndex,
          correctIndex: question?.correctIndex ?? -1,
          isCorrect: r.isCorrect,
          confidenceBefore: r.confidence,
          confidenceAfter: r.confidence,
          timeSpentMs: r.timeSpent || 0,
          reflection: r.reflection || '',
          usedHint: r.usedHint || false,
          usedSolution: r.usedSolution || false,
          usedRephrase: r.usedRephrase || false,
          rephraseCount: r.rephraseLevel || 0,
          coachUsed: r.usedCoach || false,
          restRequested: r.restRequested || false,
          breakDurationMs: r.breakDurationMs || 0,
          inputModality: r.inputModality || 'keyboard',
        };
      }),
    };
    const API = import.meta.env.VITE_API_URL ?? '';
    fetch(`${API}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(apiPayload),
    }).then(res => {
      if (res.ok) console.log('[APEX] ✅ Session saved to database');
      else console.warn('[APEX] ⚠️ API returned', res.status);
    }).catch(err => console.warn('[APEX] ⚠️ API offline, data in localStorage only:', err.message));

    const learnReturn = localStorage.getItem('apex_learn_return');
    if (learnReturn) {
      localStorage.removeItem('apex_learn_return');
      localStorage.removeItem('apex_learn_questions');
      navigate(learnReturn);
      return;
    }
    navigate('/results');
  };

  const renderContent = () => {
    switch (appState) {
      case 'start':
        return <SessionStart onStart={() => setAppState('question')} />;
      case 'question':
        return (
          <MainQuestion 
            onNext={handleNext}
            onShowHint={handleShowHint}
            onShowSolution={() => setAppState('solution')}
            onCallCoach={() => setCoachPanelOpen(true)}
            onRephrase={handleRephrase}
            onTakeBreak={handleBreakOpen}
            onEndSession={handleEndSession}
            rephraseCount={state.currentRephraseCount}
            rephraseExhausted={state.currentRephraseCount >= MAX_REPHRASE_PER_QUESTION}
          />
        );
      case 'checkpoint':
        return <CheckpointDashboard responses={state.responses} feedbackLevel={state.feedbackLevel} setFeedbackLevel={setFeedbackLevel} onContinue={handleAfterCheckpoint} onEndSession={handleEndSession} />;
      case 'puzzle': return <PuzzleView onBack={() => setAppState('question')} />;
      case 'strategies':
        return <TeachingStrategies onBack={() => setAppState('question')} onSelect={(s) => {
          if (s === 'puzzle') setAppState('puzzle');
          else if (s === 'simpler') setAppState('simpler_example');
          else if (s === 'error') setAppState('find_error');
          else if (s === 'conceptual') setAppState('conceptual');
          else if (s === 'solution') setAppState('solution');
          else if (s === 'brainstorming') setAppState('brainstorming');
        }} />;
      case 'find_error': return <FindErrorView onBack={() => setAppState('strategies')} />;
      case 'conceptual': return <ConceptualView onBack={() => setAppState('strategies')} />;
      case 'brainstorming': return <BrainstormingView onBack={() => setAppState('strategies')} />;
      case 'solution': return <SolutionView onBack={() => setAppState('question')} onNext={handleSolutionNext} />;
      case 'simpler_example': return <SimplerExample onBack={() => setAppState('strategies')} />;
      case 'summary': return <SessionEndSummary onEnd={handleFinishAndNavigate} />;
      default: return <SessionStart onStart={() => setAppState('question')} />;
    }
  };

  return (
    <Layout showSidebar={appState !== 'start' && appState !== 'summary'} onEndSession={handleEndSession}>
      {renderContent()}

      {/* Coach Side Panel */}
      <CoachPanel
        isOpen={coachPanelOpen}
        onClose={() => setCoachPanelOpen(false)}
        currentQuestion={currentQuestion}
        onMarkCoachUsed={markCoachUsed}
      />

      {/* Hint Modal */}
      <Modal isOpen={modalType === 'hint'} onClose={() => setModalType('none')} title="تلميح شارح" icon={<Lightbulb className="w-5 h-5 fill-current" />}>
        <div className="flex flex-col gap-5">
          {state.currentRephraseHint && (
            <div className="flex items-center gap-2 text-xs text-secondary font-bold bg-secondary/10 px-3 py-1.5 rounded-full w-fit">
              <RefreshCcw className="w-3 h-3" />
              تلميح الصياغة {state.currentRephraseStyleLabel}
            </div>
          )}
          <p className="text-lg text-on-surface leading-loose">
            {state.currentRephraseHint ?? currentQuestion?.hint?.text ?? 'لا يوجد تلميح'}
          </p>
          {!state.currentRephraseHint && currentQuestion?.hint?.stepLabel && (
            <div className="bg-surface-container/50 border border-primary/10 rounded-xl p-5 flex flex-col items-center font-mono" dir="ltr">
              <span className="text-xs text-on-surface-variant mb-2">{currentQuestion.hint.stepLabel}</span>
              <div className="text-2xl tracking-widest">{currentQuestion.hint.stepContent}</div>
            </div>
          )}
          <button onClick={() => setModalType('none')} className="btn-primary w-full py-3 rounded-xl"><Check className="w-5 h-5" />فهمت</button>
        </div>
      </Modal>

      {/* Break Modal */}
      <Modal isOpen={modalType === 'break'} onClose={handleBreakClose} title="استراحة" icon={<Coffee className="w-5 h-5 text-primary" />}>
        <div className="flex flex-col items-center text-center gap-5">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Coffee className="w-10 h-10 text-primary animate-bounce" />
          </div>
          <p className="text-xl font-bold">خذ وقتك، العقل يحتاج للراحة ليبدع!</p>
          <div className="flex items-center gap-2 bg-surface-container/60 px-6 py-3 rounded-xl border border-primary/20">
            <span className="text-3xl font-mono font-bold text-primary">
              {`${Math.floor(breakSeconds / 60).toString().padStart(2, '0')}:${(breakSeconds % 60).toString().padStart(2, '0')}`}
            </span>
            <span className="text-xs text-on-surface-variant">مدة الراحة</span>
          </div>
          <p className="text-xs text-on-surface-variant">⏸ تايمر السؤال متوقف أثناء الاستراحة</p>
          <div className="flex flex-col w-full gap-2">
            <button onClick={handleBreakClose} className="btn-primary py-3 rounded-xl">عدت للحل</button>
          </div>
        </div>
      </Modal>

      {/* Exit Confirmation Modal */}
      <Modal isOpen={modalType === 'confirm_exit'} onClose={() => setModalType('none')} title="إنهاء الجلسة" icon={<Flag className="w-5 h-5 text-error" />}>
        <div className="flex flex-col items-center text-center gap-5 py-2">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
            <Flag className="w-8 h-8 text-error" />
          </div>
          <div>
            <p className="text-xl font-bold mb-2">هل تريد إنهاء الاختبار؟</p>
            <p className="text-sm text-on-surface-variant">أجبت على {state.responses.length} سؤال حتى الآن. سيتم حفظ إجاباتك الحالية وحساب النتائج.</p>
          </div>
          <div className="flex flex-col w-full gap-2">
            <button onClick={() => { setModalType('none'); handleFinishAndNavigate(); }} className="w-full py-3 rounded-xl bg-error/10 text-error border border-error/30 font-bold hover:bg-error/20 transition-colors">نعم، أنهِ الاختبار</button>
            <button onClick={() => setModalType('none')} className="btn-primary py-3 rounded-xl">لا، أكمل الاختبار</button>
          </div>
        </div>
      </Modal>

      {/* Regeneration Modal */}
      <Modal isOpen={modalType === 'regeneration'} onClose={() => setModalType('none')} title="تحديث المحتوى" icon={<RefreshCcw className="w-5 h-5 text-primary animate-spin" />}>
        <div className="flex flex-col items-center text-center gap-6 py-6">
          <div className="relative">
            <RefreshCcw className="w-16 h-16 text-primary animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center"><SmartToy className="w-7 h-7 text-primary" /></div>
          </div>
          <div>
            <p className="text-xl font-bold text-primary">{isAIAvailable() ? 'الذكاء الاصطناعي يعيد الصياغة...' : 'جاري إعادة الصياغة...'}</p>
            <p className="text-sm text-on-surface-variant mt-1">
              الأسلوب: {['أكاديمي', 'شبابي علمي', 'مبسّط جداً'][Math.min(state.currentRephraseCount, 2)]}
            </p>
          </div>
          <div className="w-full h-1 bg-surface-container-high rounded-full overflow-hidden"><div className="h-full bg-primary animate-shimmer" style={{ width: '60%' }} /></div>
        </div>
      </Modal>
    </Layout>
  );
}

interface CheckpointDashboardProps {
  responses: import('./context/SessionContext').QuestionResponse[];
  feedbackLevel: 'easy' | 'medium' | 'hard';
  setFeedbackLevel: (level: 'easy' | 'medium' | 'hard') => void;
  onContinue: () => void;
  onEndSession: () => void;
}

function CheckpointDashboard({ responses, feedbackLevel, setFeedbackLevel, onContinue, onEndSession }: CheckpointDashboardProps) {
  const batchSize = 5;
  const batchStart = Math.max(0, responses.length - batchSize);
  const batch = responses.slice(batchStart);
  const correctCount = batch.filter(r => r.isCorrect).length;
  const accuracy = Math.round((correctCount / batch.length) * 100);
  const avgConfidence = batch.length > 0 ? (batch.reduce((a, b) => a + b.confidence, 0) / batch.length) : 0;

  // Concept gap analysis
  const conceptMap = new Map<string, { correct: number; total: number; avgConf: number }>();
  batch.forEach(r => {
    const existing = conceptMap.get(r.conceptName) || { correct: 0, total: 0, avgConf: 0 };
    existing.total++;
    if (r.isCorrect) existing.correct++;
    existing.avgConf = ((existing.avgConf * (existing.total - 1)) + r.confidence) / existing.total;
    conceptMap.set(r.conceptName, existing);
  });

  const gaps = Array.from(conceptMap.entries())
    .filter(([, data]) => data.correct < data.total)
    .map(([name, data]) => ({ name, ...data }));

  const strengths = Array.from(conceptMap.entries())
    .filter(([, data]) => data.correct === data.total)
    .map(([name]) => name);

  const coachMessages: { text: string; type: 'greeting' | 'stat' | 'gap' | 'strength' | 'tip' }[] = [];

  coachMessages.push({
    text: `أهلاً! خلّيني أعطيك ملخص سريع لأدائك في آخر ${batch.length} أسئلة 📊`,
    type: 'greeting',
  });

  coachMessages.push({
    text: `✅ الدقة: ${accuracy}% (${correctCount}/${batch.length} صحيحة)\n📈 متوسط الثقة: ${avgConfidence.toFixed(1)}/5`,
    type: 'stat',
  });

  if (gaps.length > 0) {
    const gapText = gaps.map(g =>
      `• ${g.name}: ${g.correct}/${g.total} صحيحة (ثقة: ${g.avgConf.toFixed(1)})`
    ).join('\n');
    coachMessages.push({
      text: `🔍 فجوات تحتاج تركيز:\n${gapText}`,
      type: 'gap',
    });
  }

  if (strengths.length > 0) {
    coachMessages.push({
      text: `🌟 نقاط قوة: ${strengths.join('، ')}`,
      type: 'strength',
    });
  }

  if (accuracy >= 80) {
    coachMessages.push({ text: 'أداء ممتاز! 🔥 أكمل بنفس الحماس', type: 'tip' });
  } else if (accuracy >= 50) {
    coachMessages.push({ text: 'أداء جيد! لو تحس بصعوبة، لا تتردد تستعين بالكوتش 💪', type: 'tip' });
  } else {
    coachMessages.push({ text: 'لا تحبط! الأخطاء جزء من التعلم. جرّب الكوتش لمساعدتك 🤝', type: 'tip' });
  }

  return (
    <div className="h-full flex flex-col items-center justify-center page-transition">
      <div className="w-full max-w-3xl">
        {/* Coach Chat Header */}
        <div className="glass-card rounded-t-2xl p-4 flex items-center gap-3 border-b border-primary/10">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-[0_0_20px_rgba(208,188,255,0.3)]">
            <SmartToy className="w-6 h-6 text-primary" />
          </div>
          <div className="text-right flex-1">
            <p className="font-bold text-on-surface">تقرير الكوتش</p>
            <p className="text-xs text-primary flex items-center gap-1 justify-start">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              نقطة تحقق — بعد {responses.length} أسئلة
            </p>
          </div>
          <Flag className="w-5 h-5 text-primary" />
        </div>

        {/* Chat Messages */}
        <div className="glass-card p-6 space-y-4 max-h-[50vh] overflow-y-auto" style={{ borderTop: 'none', borderBottom: 'none', borderRadius: 0 }}>
          {coachMessages.map((msg, i) => (
            <div key={i} className="flex gap-3 items-start" style={{ animation: `page-enter 0.4s ease-out ${i * 0.15}s both` }}>
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <SmartToy className="w-4 h-4 text-primary" />
              </div>
              <div className={`coach-bubble coach-bubble-bot flex-1 ${msg.type === 'gap' ? '!border-error/30 !bg-error/5' : ''} ${msg.type === 'strength' ? '!border-tertiary/30 !bg-tertiary/5' : ''}`}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}

          {/* Per-question mini chart */}
          <div className="flex gap-3 items-start" style={{ animation: `page-enter 0.4s ease-out ${coachMessages.length * 0.15}s both` }}>
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
              <SmartToy className="w-4 h-4 text-primary" />
            </div>
            <div className="coach-bubble coach-bubble-bot flex-1">
              <p className="text-xs text-on-surface-variant mb-2 font-bold">أداء كل سؤال:</p>
              <div className="flex items-end gap-1.5 justify-center h-12">
                {batch.map((r, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5" title={`سؤال ${batchStart + i + 1}: ${r.isCorrect ? 'صحيح' : 'خطأ'} (ثقة: ${r.confidence}/5)`}>
                    <div
                      className={`w-7 rounded-t transition-all ${r.isCorrect ? 'bg-tertiary' : 'bg-error/60'}`}
                      style={{ height: `${Math.max(10, (r.confidence / 5) * 40)}px` }}
                    />
                    <span className="text-[9px] text-on-surface-variant">{batchStart + i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Feedback + Continue */}
        <div className="glass-card rounded-b-2xl p-6" style={{ borderTop: '1px solid rgba(208,188,255,0.1)', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          <h3 className="text-sm font-bold mb-3 text-on-surface-variant">كيف كان مستوى الأسئلة؟</h3>
          <div className="grid grid-cols-3 gap-3 mb-6" role="radiogroup">
            <FeedbackOption icon={<SentimentSatisfied />} label="سهل" active={feedbackLevel === 'easy'} onClick={() => setFeedbackLevel('easy')} />
            <FeedbackOption icon={<SentimentNeutral />} label="مناسب" active={feedbackLevel === 'medium'} onClick={() => setFeedbackLevel('medium')} />
            <FeedbackOption icon={<SentimentDissatisfied />} label="صعب" active={feedbackLevel === 'hard'} onClick={() => setFeedbackLevel('hard')} />
          </div>
          <div className="flex flex-col items-center gap-3">
            <button onClick={onContinue} className="btn-primary w-full md:w-auto px-14 py-3 rounded-xl text-lg font-bold">
              أكمل<ArrowRight className="w-5 h-5 rotate-180" />
            </button>
            <button onClick={onEndSession} className="text-error hover:bg-error/10 px-6 py-2 rounded-lg transition-colors text-sm">إنهاء الجلسة</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedbackOption({ icon, label, onClick, active = false }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={`p-5 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${active ? 'border-primary bg-primary/10 shadow-glow' : 'border-outline-variant bg-surface-container-low hover:border-primary/50'}`} role="radio" aria-checked={active}>
      <span className={`w-8 h-8 ${active ? 'text-primary' : 'text-secondary'}`}>{icon}</span>
      <span className={`font-medium text-sm ${active ? 'text-primary' : ''}`}>{label}</span>
    </button>
  );
}

function FindErrorView({ onBack }: { onBack: () => void }) {
  const { currentQuestion } = useSession();
  const [selectedError, setSelectedError] = useState<number | null>(null);
  if (!currentQuestion) return null;
  const errorExample = currentQuestion.errorExample;
  if (!errorExample) {
    return (
      <div className="flex flex-col gap-6 page-transition items-center justify-center py-16">
        <p className="text-on-surface-variant">لا يوجد تمرين خطأ لهذا السؤال</p>
        <button onClick={onBack} className="btn-primary px-8 py-3 rounded-xl"><ArrowRight className="w-4 h-4 rotate-180" />رجوع</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 page-transition">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-secondary"><Search className="w-4 h-4" /><span className="text-xs font-bold tracking-widest uppercase">التفكير الناقد</span></div>
        <h2 className="text-2xl font-bold">أين الخطأ في هذا الحل؟</h2>
        <p className="text-sm text-on-surface-variant">قام "{errorExample.studentName}" بحل المسألة لكنه أخطأ. اكتشف الخطأ!</p>
      </div>
      <div className="glass-card rounded-2xl overflow-hidden border-secondary/30">
        <div className="bg-secondary/10 p-3 border-b border-secondary/20"><span className="font-bold text-secondary text-sm">محاولة "{errorExample.studentName}":</span></div>
        <div className="p-6 space-y-4">
          {errorExample.steps.map((item, idx) => (
            <button key={idx} onClick={() => setSelectedError(idx)} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${selectedError === idx ? 'border-primary bg-primary/10 shadow-glow' : 'border-outline-variant/30 bg-surface-container-low hover:border-secondary/50'}`}>
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-xl font-mono" dir="ltr">{item.step}</span>
                <span className="text-xs text-on-surface-variant">{item.desc}</span>
              </div>
              {selectedError === idx && <span className="text-xs font-bold text-primary max-w-[200px] text-left">{idx === errorExample.errorIndex ? `✅ ${errorExample.errorExplanation}` : '❌ حاول مرة أخرى'}</span>}
            </button>
          ))}
        </div>
      </div>
      <button onClick={onBack} className="btn-primary px-8 py-3 rounded-xl w-fit"><ArrowRight className="w-4 h-4 rotate-180" />فهمت، لنعد للحل</button>
    </div>
  );
}

function ConceptualView({ onBack }: { onBack: () => void }) {
  const { currentQuestion } = useSession();
  if (!currentQuestion) return null;
  return (
    <div className="flex flex-col gap-6 page-transition">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-primary"><HelpCircle className="w-4 h-4" /><span className="text-xs font-bold tracking-widest uppercase">الربط المفاهيمي</span></div>
        <h2 className="text-2xl font-bold">لماذا نفعل ذلك؟</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-5"><h3 className="text-lg font-bold mb-3 text-primary">المفهوم: {currentQuestion.concept}</h3><p className="text-on-surface-variant leading-relaxed text-sm">{currentQuestion.solution?.tip ?? 'لا يوجد شرح إضافي'}</p></div>
        <div className="glass-card rounded-2xl p-5"><h3 className="text-lg font-bold mb-3 text-primary">التطبيق</h3><p className="text-on-surface-variant leading-relaxed text-sm">{currentQuestion.text}<br /><br />{currentQuestion.hint?.text ?? ''}</p></div>
      </div>
      <button onClick={onBack} className="btn-primary px-8 py-3 rounded-xl w-fit"><ArrowRight className="w-4 h-4 rotate-180" />وضحت الصورة</button>
    </div>
  );
}

function SimplerExample({ onBack }: { onBack: () => void }) {
  const { currentQuestion, showToast } = useSession();
  if (!currentQuestion) return null;
  const simplerExample = currentQuestion.simplerExample;
  if (!simplerExample) {
    return (
      <div className="flex flex-col gap-6 page-transition items-center justify-center py-16">
        <p className="text-on-surface-variant">لا يوجد مثال مبسّط لهذا السؤال</p>
        <button onClick={onBack} className="btn-primary px-8 py-3 rounded-xl"><ArrowRight className="w-4 h-4 rotate-180" />رجوع</button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6 page-transition">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-primary"><Lightbulb className="w-4 h-4 fill-current" /><span className="text-xs font-bold tracking-widest uppercase">مثال مبسّط</span></div>
        <h2 className="text-2xl font-bold">مثال أبسط لفهم الفكرة</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6 opacity-60">
          <h3 className="text-lg font-bold mb-4 pb-3 border-b border-primary/20">المعادلة الأصلية</h3>
          <div className="h-40 flex items-center justify-center text-4xl font-mono" dir="ltr">{simplerExample.original}</div>
        </div>
        <div className="glass-card rounded-2xl p-6 border-primary/50 shadow-glow">
          <h3 className="text-lg font-bold mb-4 pb-3 border-b border-primary/20 text-primary">المثال الأبسط</h3>
          <div className="space-y-4">
            <div className="bg-surface-container/50 p-4 rounded-xl flex items-center justify-between">
              <span className="text-3xl font-mono" dir="ltr">{simplerExample.simpler}</span>
            </div>
            <div className="flex justify-center"><div className="bg-surface-bright rounded-full p-1.5 border border-primary/20"><ArrowDown className="w-4 h-4 text-primary" /></div></div>
            <div className="bg-primary/10 p-4 rounded-xl border border-primary/30 flex items-center justify-between">
              <span className="text-3xl font-mono text-primary" dir="ltr">{simplerExample.result}</span>
              <Scale className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>
      </div>
      <div className="glass-card rounded-xl p-5 border-r-4 border-r-primary border-l-0 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-surface-container-highest border border-primary/30 flex items-center justify-center shrink-0"><SmartToy className="w-6 h-6 text-primary" /></div>
        <div className="flex-1 space-y-3">
          <p className="text-sm">{simplerExample.explanation}</p>
          <button onClick={onBack} className="btn-primary px-6 py-2 rounded-lg text-sm">العودة للمعادلة</button>
        </div>
      </div>
    </div>
  );
}
