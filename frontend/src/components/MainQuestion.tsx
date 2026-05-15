import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from '../context/SessionContext';
import { RefreshCcw, Coffee, SupportAgent, ArrowLeft, PsychologyAlt, Edit3, Lightbulb, Eye, Schedule, CheckCircle, XCircle, Send, AlertCircle, Mic } from './icons';
import { MAX_REPHRASE_PER_QUESTION } from '../context/SessionContext';
import QuestionRenderer, { type AnswerPayload } from './QuestionRenderer';

interface MainQuestionProps {
  onNext: () => void;
  onShowHint: () => void;
  onShowSolution: () => void;
  onCallCoach: () => void;
  onRephrase: () => void;
  onTakeBreak: () => void;
  onEndSession: () => void;
  rephraseCount: number;
  rephraseExhausted: boolean;
}

function Confetti() {
  const colors = ['#5af6d6', '#8cedf3', '#95cdf3', '#ffb4ab', '#FFD700', '#FF69B4', '#7B68EE'];
  return (
    <div className="confetti-container" aria-hidden="true">
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: colors[i % colors.length],
            width: `${6 + Math.random() * 8}px`,
            height: `${6 + Math.random() * 8}px`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: `${Math.random() * 0.8}s`,
            animationDuration: `${2 + Math.random() * 1.5}s`,
          }}
        />
      ))}
    </div>
  );
}

const CONFIDENCE_LABELS = ['مش متأكد خالص', 'شبه مش متأكد', 'بين وبين', 'شبه واثق', 'واثق 100%'];

export default function MainQuestion({ onNext, onShowHint, onShowSolution, onCallCoach, onRephrase, onTakeBreak, onEndSession, rephraseCount, rephraseExhausted }: MainQuestionProps) {
  const { state, currentQuestion, totalQuestions, submitResponse, setInputModality } = useSession();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [textAnswerSubmitted, setTextAnswerSubmitted] = useState(false);
  const [textAnswerPayload, setTextAnswerPayload] = useState<AnswerPayload | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [reflection, setReflection] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [resultRevealed, setResultRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Speech-to-Text ──
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef(''); // text before recording started

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event: any) => {
      // Rebuild full transcript from ALL results
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interimText += event.results[i][0].transcript;
        }
      }
      const base = baseTextRef.current;
      const spoken = (finalText + (interimText ? ' ' + interimText : '')).trim();
      setReflection(base ? base + ' ' + spoken : spoken);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    return () => { try { recognition.stop(); } catch {} };
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // Save current text as base before starting
      setReflection(prev => { baseTextRef.current = prev; return prev; });
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  useEffect(() => {
    setElapsed(0); setSelectedOption(null); setIsSubmitted(false); setIsCorrect(false);
    setResultRevealed(false); setConfidence(0); setReflection(''); setIsSaved(false); setShowConfetti(false);
    setTextAnswerSubmitted(false); setTextAnswerPayload(null);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.currentQuestionIndex]);

  // Keyboard shortcuts — only for MCQ/true-false types
  const qType = currentQuestion?.questionType || 'mcq';
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (!isSubmitted && qType !== 'text_input') {
        const maxKeys = qType === 'true_false' ? 2 : 4;
        if (e.key >= '1' && e.key <= String(maxKeys)) { setSelectedOption(parseInt(e.key) - 1); setInputModality('keyboard'); e.preventDefault(); }
        if (e.key === 'Enter' && selectedOption !== null && reflection.trim()) { handleSubmit(); e.preventDefault(); }
      } else if (resultRevealed) {
        if (e.key === 'Enter' || e.key === ' ') { onNext(); e.preventDefault(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSubmitted, selectedOption, state.currentQuestionIndex, confidence, resultRevealed, qType]);

  const formatTime = (secs: number) => `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;

  // Handle text answer from QuestionRenderer
  const handleTextAnswer = useCallback((payload: AnswerPayload) => {
    setTextAnswerPayload(payload);
    setTextAnswerSubmitted(true);
    setIsCorrect(payload.isCorrect);
    setSelectedOption(-1); // Indicate something was selected
  }, []);

  const handleSubmit = useCallback(() => {
    if (!currentQuestion || !reflection.trim()) return;

    // For text_input: textAnswerSubmitted acts as the selection
    if (qType === 'text_input') {
      if (!textAnswerSubmitted) return;
    } else {
      if (selectedOption === null) return;
    }

    let correct: boolean;
    if (qType === 'text_input' && textAnswerPayload) {
      correct = textAnswerPayload.isCorrect;
    } else {
      correct = selectedOption === currentQuestion.correctIndex;
    }

    setIsCorrect(correct);
    setIsSubmitted(true);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [selectedOption, currentQuestion, reflection, qType, textAnswerSubmitted, textAnswerPayload]);

  const handleConfidenceSelect = useCallback((val: number) => {
    setConfidence(val);
    if (!resultRevealed && currentQuestion) {
      setResultRevealed(true);

      let selectedAnswer: string;
      let selectedIdx: number;
      let correct: boolean;

      if (qType === 'text_input' && textAnswerPayload) {
        selectedAnswer = textAnswerPayload.selectedAnswer;
        selectedIdx = -1;
        correct = textAnswerPayload.isCorrect;
      } else if (selectedOption !== null && selectedOption >= 0) {
        selectedAnswer = currentQuestion.options[selectedOption]?.content || '';
        selectedIdx = selectedOption;
        correct = selectedOption === currentQuestion.correctIndex;
      } else {
        return;
      }

      if (correct) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
      submitResponse({
        selectedAnswer,
        selectedIndex: selectedIdx,
        isCorrect: correct,
        confidence: val,
        difficulty: currentQuestion.difficulty,
        reflection
      });
    } else if (state.responses.length > 0) {
      const lastResp = state.responses[state.responses.length - 1];
      lastResp.confidence = val;
    }
  }, [state.responses, resultRevealed, currentQuestion, selectedOption, reflection, submitResponse, qType, textAnswerPayload]);

  if (!currentQuestion) return null;

  const questionText = state.showRephrasedText ? (state.rephrasedAIText || currentQuestion.rephrasedText) : currentQuestion.text;
  const progressPercent = (state.currentQuestionIndex / totalQuestions) * 100;
  const qTypeLabel = { mcq: 'اختيار متعدد', true_false: 'صح / خطأ', text_input: 'إجابة نصية', image_upload: 'رفع صورة' }[qType] || '';
  const canSubmit = qType === 'text_input' ? textAnswerSubmitted : selectedOption !== null;

  return (
    <div className="flex flex-col h-full page-transition">
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 glass-card rounded-2xl p-4 md:p-6">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-on-surface-variant">التقدم</span>
            <span className="text-xl font-bold text-primary">السؤال {String(state.currentQuestionIndex + 1).padStart(2, '0')} / {totalQuestions}</span>
          </div>
          <div className="h-8 w-px bg-primary/20 hidden md:block" />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-on-surface-variant">المفهوم</span>
            <span className="font-semibold text-on-surface">{currentQuestion.concept}</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-xs font-medium text-on-surface-variant">الصعوبة</span>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className={`w-6 h-1.5 rounded-full ${i <= currentQuestion.difficulty ? 'bg-primary' : 'bg-surface-bright border border-primary/20'}`} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 bg-surface-bright/50 px-4 py-2 rounded-xl border border-primary/20">
            <Schedule className="w-5 h-5 text-primary" />
            <span className="text-xl font-bold text-primary font-mono" dir="ltr">{formatTime(elapsed)}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-surface-container-highest rounded-full mb-6 overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow">
        {/* Main Column */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className={`glass-card rounded-2xl p-6 md:p-10 flex-grow flex flex-col justify-center text-center ${state.showRephrasedText ? 'ring-2 ring-secondary/40 shadow-[0_0_30px_rgba(140,237,243,0.15)]' : ''}`} style={state.showRephrasedText ? { animation: 'page-enter 0.4s ease-out' } : undefined}>
            {state.showRephrasedText && (
              <div className="mb-4 inline-flex items-center gap-2 bg-secondary/15 text-secondary text-sm font-bold px-4 py-2 rounded-full mx-auto border border-secondary/30" style={{ animation: 'page-enter 0.3s ease-out' }}>
                <RefreshCcw className="w-4 h-4" />
                {state.rephrasedAIText ? '✨ صيغة AI مبسطة' : '📝 صيغة مبسطة'}
              </div>
            )}
            <h2 className={`text-2xl md:text-3xl font-bold mb-10 ${state.showRephrasedText ? 'text-secondary' : 'text-on-surface'}`}>{questionText}</h2>
            
            {/* Question type badge */}
            {qType !== 'mcq' && (
              <div className="mb-4 inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-full mx-auto border border-primary/20">
                {qTypeLabel}
              </div>
            )}

            {/* Dynamic Answer Input */}
            <QuestionRenderer
              question={currentQuestion}
              onAnswer={handleTextAnswer}
              disabled={isSubmitted}
              resultRevealed={resultRevealed}
              selectedIndex={selectedOption}
              inputModality={state.inputModality}
              onSelectOption={(idx) => { if (!isSubmitted) { setSelectedOption(idx); setInputModality('mouse'); } }}
            />

            {/* Post-Submit Confidence Card (BEFORE result reveal) */}
            {isSubmitted && !resultRevealed && (
              <div className="confidence-card" style={{ animation: 'page-enter 0.4s ease-out' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                    <PsychologyAlt className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-right">
                    <h3 className="text-base font-bold text-on-surface">قبل ما نكشف النتيجة...</h3>
                    <p className="text-xs text-on-surface-variant">قديش كنت واثق من إجابتك؟</p>
                  </div>
                </div>
                <div className="flex justify-between items-center gap-2 mb-3">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => handleConfidenceSelect(val)}
                      className={`confidence-btn ${confidence === val ? 'active' : ''}`}
                      aria-label={CONFIDENCE_LABELS[val - 1]}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                {confidence > 0 && (
                  <div className="text-center text-sm text-primary font-medium" style={{ animation: 'page-enter 0.2s ease-out' }}>
                    {CONFIDENCE_LABELS[confidence - 1]}
                  </div>
                )}
              </div>
            )}

            {/* Result Reveal (AFTER confidence selection) */}
            {resultRevealed && (
              <div className={`mt-6 p-4 rounded-xl flex items-center justify-center gap-3 text-lg font-bold ${isCorrect ? 'bg-tertiary/15 text-tertiary border border-tertiary/30' : 'bg-error/15 text-error border border-error/30'}`} role="alert" style={{ animation: 'page-enter 0.3s ease-out' }}>
                {isCorrect ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                {isCorrect
                  ? 'إجابة صحيحة! أحسنت 🎉'
                  : qType === 'text_input'
                    ? `إجابة غير مطابقة${currentQuestion.correctAnswer ? `. الإجابة النموذجية: ${currentQuestion.correctAnswer}` : ''}`
                    : `إجابة خاطئة. الصحيحة: ${currentQuestion.options[currentQuestion.correctIndex]?.content || ''}`
                }
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-3 pt-4 border-t border-primary/10">
              {!isSubmitted ? (
                <>
                  <button onClick={onShowHint} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-bright/20 border border-primary/20 text-on-surface hover:bg-surface-bright/40 transition-colors text-sm font-medium"><Lightbulb className="w-4 h-4" />تلميح</button>
                  <button onClick={onShowSolution} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-bright/20 border border-primary/20 text-on-surface hover:bg-surface-bright/40 transition-colors text-sm font-medium"><Eye className="w-4 h-4" />الحل</button>
                </>
              ) : (
                <button onClick={onShowSolution} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-tertiary/10 border border-tertiary/20 text-tertiary hover:bg-tertiary/20 transition-colors text-sm font-medium"><Eye className="w-4 h-4" />راجع خطوات الحل</button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Only Reflection */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="glass-card rounded-2xl p-4 flex-grow flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold flex items-center gap-2"><Edit3 className="w-5 h-5 text-primary" />اشرح كيف فكرت: <span className="text-error text-xs font-normal">(مطلوب)</span></h3>
              {!isSaved && !isSubmitted && recognitionRef.current && (
                <button
                  onClick={toggleListening}
                  className={`stt-mic-btn ${isListening ? 'stt-mic-active' : ''}`}
                  aria-label={isListening ? 'إيقاف التسجيل' : 'تسجيل صوتي'}
                  title={isListening ? 'إيقاف التسجيل' : 'اضغط للتحدث'}
                >
                  <Mic className="w-4 h-4" />
                  {isListening && <span className="stt-mic-ring" />}
                </button>
              )}
            </div>
            {isListening && (
              <div className="stt-status-bar">
                <span className="stt-dot" />
                <span className="text-[10px] text-error font-bold">جاري التسجيل... تحدث الآن</span>
              </div>
            )}
            <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} readOnly={isSaved || isSubmitted} className={`w-full flex-grow bg-surface-container/50 border-0 border-b border-primary/30 focus:border-primary focus:ring-0 text-on-surface p-3 rounded-t-xl resize-none placeholder:text-on-surface-variant/50 text-sm ${(isSaved || isSubmitted) ? 'opacity-70' : ''} ${isListening ? 'stt-textarea-active' : ''}`} placeholder="اشرح بجملة واحدة: كيف فكّرت بالحل؟ (مثال: طرحت 5 من الطرفين ثم قسمت) — أو اضغط 🎤" aria-label="شرح طريقة التفكير" />
            {!isSubmitted && (
              <div className="mt-2 flex justify-end">
                {isSaved ? (
                  <button onClick={() => setIsSaved(false)} className="px-3 py-1.5 rounded-lg bg-secondary text-on-secondary text-sm flex items-center gap-1 font-bold"><Edit3 className="w-3 h-3" />تعديل</button>
                ) : (
                  <button onClick={() => reflection.trim() && setIsSaved(true)} disabled={!reflection.trim()} className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-sm flex items-center gap-1 font-bold disabled:opacity-40"><CheckCircle className="w-3 h-3" />حفظ</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-primary/20">
        <div className="flex flex-wrap items-center gap-2">
          {!isSubmitted && (
            <>
              <RephraseBtn remaining={MAX_REPHRASE_PER_QUESTION - rephraseCount} exhausted={rephraseExhausted} onClick={onRephrase} />
              <FooterBtn icon={<Coffee className="w-4 h-4" />} label="راحة" onClick={onTakeBreak} />
              {rephraseExhausted ? (
                <button onClick={onCallCoach} className="coach-emergency-btn flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold">
                  <AlertCircle className="w-4 h-4" /><span>🚨 الكوتش</span>
                </button>
              ) : (
                <FooterBtn icon={<SupportAgent className="w-4 h-4" />} label="الكوتش" onClick={onCallCoach} />
              )}
            </>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 w-full md:w-auto">
          {!isSubmitted ? (
            <>
              <button onClick={handleSubmit} disabled={!canSubmit || !reflection.trim()} className="btn-primary px-12 py-3 rounded-xl text-base w-full md:w-auto" aria-label="إرسال الإجابة (Enter)">
                إرسال الإجابة<Send className="w-4 h-4" />
              </button>
              {canSubmit && !reflection.trim() && (
                <p className="text-error/70 text-xs mt-1">✏️ اكتب شرح بسيط قبل الإرسال</p>
              )}
            </>
          ) : (
            <button onClick={onNext} disabled={!resultRevealed} className="btn-primary px-12 py-3 rounded-xl text-base w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed" aria-label="التالي (Enter)">
              {!resultRevealed ? 'اختر ثقتك لكشف النتيجة' : 'التالي'}<ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <button onClick={onEndSession} className="text-error/60 hover:text-error text-xs py-1 px-4 rounded transition-all">إنهاء الجلسة</button>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="mt-2 text-center text-xs text-on-surface-variant/40">
        ⌨️ اضغط 1-4 لاختيار إجابة • Enter لإرسال/التالي
      </div>
    </div>
  );
}


function FooterBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-bright/20 border border-primary/10 text-on-surface hover:text-primary hover:bg-surface-bright transition-all text-xs font-medium">{icon}<span>{label}</span></button>
  );
}

function RephraseBtn({ remaining, exhausted, onClick }: { remaining: number; exhausted: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={exhausted}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
        exhausted
          ? 'bg-error/10 border border-error/30 text-error/60 cursor-not-allowed line-through'
          : 'bg-surface-bright/20 border border-primary/10 text-on-surface hover:text-primary hover:bg-surface-bright'
      }`}
    >
      <RefreshCcw className="w-4 h-4" />
      <span>إعادة صياغة</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
        exhausted ? 'bg-error/20 text-error' : remaining <= 1 ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'
      }`}>{remaining}/{MAX_REPHRASE_PER_QUESTION}</span>
    </button>
  );
}
