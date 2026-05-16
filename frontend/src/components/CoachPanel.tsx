import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, SmartToy, Lightbulb, Search, Extension, CheckCircle, HelpCircle, PsychologyAlt, Category, ArrowRight, XCircle, ArrowDown, ChevronUp, ChevronDown } from './icons';
import MarkdownMath from './MarkdownMath';
import { isAIAvailable, getCoachMessages, getCoachReply } from '../services/ai';
import type { Question, SolutionStep } from '../data/questions';

interface CoachPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentQuestion: Question | null;
  onMarkCoachUsed: (helpType: string) => void;
}

interface ChatMessage {
  id: number;
  text: string;
  isUser: boolean;
  options?: 'main' | 'strategies';
  isAI?: boolean;
  isStrategy?: boolean;
  isSeen?: boolean;
  richContent?: React.ReactNode;
}

export default function CoachPanel({ isOpen, onClose, currentQuestion, onMarkCoachUsed }: CoachPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showQuickOptions, setShowQuickOptions] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const msgIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastUserMsgIdRef = useRef<number | null>(null);
  // pending queue for sequential delivery — click chat to skip
  const pendingRef = useRef<string[]>([]);
  const deliveryActiveRef = useRef(false);

  const scrollToBottom = () => {
    if (chatRef.current) {
      setTimeout(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }, 80);
    }
  };

  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);
  useEffect(() => { if (isOpen) initChat(); }, [isOpen]);

  const nextId = () => ++msgIdRef.current;

  const addBotMessage = (text: string, options?: 'main' | 'strategies', extra?: Partial<ChatMessage>) => {
    const msg: ChatMessage = { id: nextId(), text, isUser: false, options, ...extra };
    setMessages(prev => [...prev, msg]);
  };

  const addUserMessage = (text: string) => {
    const id = nextId();
    lastUserMsgIdRef.current = id;
    setMessages(prev => [...prev, { id, text, isUser: true }]);
  };

  const markLastUserSeen = () => {
    const targetId = lastUserMsgIdRef.current;
    if (targetId === null) return;
    setMessages(prev => prev.map(m => m.id === targetId ? { ...m, isSeen: true } : m));
  };

  const hideAllOptions = () => {
    setMessages(prev => prev.map(m => ({ ...m, options: undefined })));
  };

  const showBackButton = () => {
    addBotMessage('هل تحتاج مساعدة إضافية؟', 'main');
  };

  // Deliver an array of messages one-by-one with typing pauses
  const deliverSequentially = useCallback(async (
    msgs: string[],
    onDone?: () => void,
  ) => {
    pendingRef.current = [...msgs];
    deliveryActiveRef.current = true;
    markLastUserSeen();

    for (let i = 0; i < msgs.length; i++) {
      if (!deliveryActiveRef.current) break;
      setIsTyping(true);
      // typing time proportional to message length (avg ~40ms/char), clamped 400–2200ms
      const charCount = msgs[i].replace(/\s+/g, '').length;
      const delay = Math.min(Math.max(400, charCount * 40 + Math.random() * 150), 2200);
      await new Promise(r => setTimeout(r, delay));
      if (!deliveryActiveRef.current) break;
      setIsTyping(false);
      addBotMessage(msgs[i], undefined, { isAI: true });
      pendingRef.current = msgs.slice(i + 1);
    }

    deliveryActiveRef.current = false;
    pendingRef.current = [];
    setIsTyping(false);
    onDone?.();
  }, []);

  // Tap anywhere in chat to skip remaining typing and dump all pending at once
  const skipDelivery = useCallback(() => {
    if (!deliveryActiveRef.current || pendingRef.current.length === 0) return;
    deliveryActiveRef.current = false;
    setIsTyping(false);
    const remaining = [...pendingRef.current];
    pendingRef.current = [];
    remaining.forEach(text => addBotMessage(text, undefined, { isAI: true }));
  }, []);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || isTyping || deliveryActiveRef.current) return;
    setInputText('');
    hideAllOptions();
    addUserMessage(text);
    onMarkCoachUsed('free_text');

    if (isAIAvailable() && currentQuestion) {
      try {
        const msgs = await getCoachReply(text, currentQuestion);
        deliverSequentially(msgs);
        return;
      } catch {}
    }
    deliverSequentially(['فهمت سؤالك! فكّر في المفهوم الأساسي وجرب خطوة صغيرة 💪'], undefined);
  };

  const initChat = () => {
    msgIdRef.current = 0;
    setMessages([]);
    setIsTyping(false);
    setTimeout(() => {
      setMessages([{
        id: nextId(),
        text: 'أهلاً بك! أنا الكوتش الخاص بك. كيف يمكنني مساعدتك اليوم في حل هذا التدريب؟',
        isUser: false,
        options: 'main',
      }]);
    }, 300);
  };

  // ====== Help Type Handlers (AI Response inside chat) ======
  const handleMainOption = async (text: string, type: string) => {
    hideAllOptions();
    addUserMessage(text);
    onMarkCoachUsed(type);

    if (type === 'methods') {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        addBotMessage('فهمتك تماماً! إليك بعض الطرق الممتعة والمختلفة التي يمكننا استخدامها معاً لتسهيل المعلومة:', 'strategies');
      }, 600);
      return;
    }

    setIsTyping(true);
    if (isAIAvailable() && currentQuestion) {
      try {
        const msgs = await getCoachMessages(currentQuestion, type);
        setIsTyping(false);
        deliverSequentially(msgs, () => setTimeout(() => showBackButton(), 400));
        return;
      } catch {
        setIsTyping(false);
        addBotMessage('عذراً، لم أتمكن من الوصول للكوتش الآن. جرّب الاستراتيجيات المتاحة! 💪');
      }
    } else {
      setTimeout(() => {
        setIsTyping(false);
        if (currentQuestion) {
          const hintText = currentQuestion.hint?.text ?? 'لا يوجد تلميح لهذا السؤال';
          const solutionTip = currentQuestion.solution?.tip ?? '';
          const fallback = type === 'start'
            ? `💡 خليني أساعدك تبدأ:\n\n${hintText}${currentQuestion.hint?.stepLabel ? `\n\n${currentQuestion.hint.stepLabel}\n${currentQuestion.hint.stepContent}` : ''}`
            : type === 'concept'
            ? `📚 المفهوم: ${currentQuestion.concept}${solutionTip ? `\n\n${solutionTip}` : ''}\n\n${hintText}`
            : `🎯 لا تقلق! خذ الخطوة الأولى:\n\n${hintText}${currentQuestion.hint?.stepLabel ? `\n\n${currentQuestion.hint.stepLabel} ${currentQuestion.hint.stepContent}` : ''}`;
          addBotMessage(fallback, undefined, { isAI: true });
          setTimeout(() => showBackButton(), 600);
        }
      }, 800);
    }
  };

  // ====== Strategy Handlers (RICH interactive content) ======
  const handleStrategySelect = (name: string, strategy: string) => {
    hideAllOptions();
    addUserMessage(name);
    onMarkCoachUsed(`strategy_${strategy}`);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      if (!currentQuestion) return;

      switch (strategy) {
        case 'brainstorming':
          if (!currentQuestion.solution?.steps) { addBotMessage('هذه الاستراتيجية غير متاحة لهذا السؤال حالياً'); break; }
          addBotMessage('🧠 عصف ذهني — خلينا نفكك المسألة خطوة بخطوة:', undefined, {
            isStrategy: true,
            richContent: <BrainstormingWidget steps={currentQuestion.solution.steps} tip={currentQuestion.solution.tip} />,
          });
          break;
        case 'error':
          if (!currentQuestion.errorExample) { addBotMessage('هذه الاستراتيجية غير متاحة لهذا السؤال حالياً'); break; }
          addBotMessage(`🔍 "${currentQuestion.errorExample.studentName}" حاول يحل المسألة. وين الخطأ؟`, undefined, {
            isStrategy: true,
            richContent: <ErrorFindWidget errorExample={currentQuestion.errorExample} />,
          });
          break;
        case 'simpler':
          if (!currentQuestion.simplerExample) { addBotMessage('هذه الاستراتيجية غير متاحة لهذا السؤال حالياً'); break; }
          addBotMessage('📐 خلينا نفهم بمثال أبسط:', undefined, {
            isStrategy: true,
            richContent: <SimplerWidget data={currentQuestion.simplerExample} />,
          });
          break;
        case 'conceptual':
          addBotMessage('📖 الربط المفاهيمي:', undefined, {
            isStrategy: true,
            richContent: <ConceptWidget concept={currentQuestion.concept} tip={currentQuestion.solution?.tip ?? ''} hint={currentQuestion.hint?.text ?? ''} />,
          });
          break;
        case 'puzzle':
          if (!currentQuestion.solution?.steps) { addBotMessage('هذه الاستراتيجية غير متاحة لهذا السؤال حالياً'); break; }
          addBotMessage('🧩 رتب الخطوات بالترتيب الصحيح!', undefined, {
            isStrategy: true,
            richContent: <PuzzleWidget steps={currentQuestion.solution.steps} />,
          });
          break;
        case 'solution':
          if (!currentQuestion.solution?.steps) { addBotMessage('هذه الاستراتيجية غير متاحة لهذا السؤال حالياً'); break; }
          addBotMessage('✅ الحل النموذجي — تابع الخطوات:', undefined, {
            isStrategy: true,
            richContent: <SolutionWidget steps={currentQuestion.solution.steps} tip={currentQuestion.solution.tip} />,
          });
          break;
      }
      setTimeout(() => showBackButton(), 500);
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-[90] lg:bg-transparent lg:backdrop-blur-none" onClick={onClose} />
      <div className="coach-panel fixed top-0 left-0 h-full z-[95] flex flex-col" style={{ animation: 'coach-slide-in 0.35s ease-out' }}>
        {/* Header */}
        <div className="coach-panel-header">
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-bright/40 transition-all" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-bold text-sm text-on-surface">الكوتش الذكي</p>
              <p className="text-[10px] text-primary flex items-center gap-1 justify-end">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                {isAIAvailable() ? 'AI متصل' : 'متصل الآن'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
              <SmartToy className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>

        {/* Chat Area — tap to skip typing animation */}
        <div ref={chatRef} className="coach-chat-area" onClick={skipDelivery}>
          {messages.map((msg) => (
            <div key={msg.id} className={`coach-message ${msg.isUser ? 'coach-msg-user' : 'coach-msg-bot'}`}>
              <div className={`coach-bubble ${msg.isUser ? 'coach-bubble-user' : 'coach-bubble-bot'} ${msg.isAI ? 'coach-bubble-ai' : ''} ${msg.isStrategy ? 'coach-bubble-strategy' : ''}`}>
                {msg.isAI && (
                  <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-primary/20">
                    <SmartToy className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-bold text-primary tracking-wider">✨ AI Response</span>
                  </div>
                )}
                {msg.isStrategy && (
                  <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-secondary/20">
                    <Lightbulb className="w-3.5 h-3.5 text-secondary" />
                    <span className="text-[10px] font-bold text-secondary tracking-wider">📚 استراتيجية تفاعلية</span>
                  </div>
                )}
                {msg.text && (msg.isAI
                  ? <MarkdownMath>{msg.text}</MarkdownMath>
                  : <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                )}
                {msg.richContent && <div className="mt-3">{msg.richContent}</div>}
              </div>
              {msg.isUser && msg.isSeen && (
                <span className="text-[9px] text-primary/60 mt-0.5 block text-right pr-1">شاهد ✓✓</span>
              )}

              {/* Main Options */}
              {msg.options === 'main' && (
                <div className="coach-options-grid">
                  <button className="coach-option-btn" onClick={() => handleMainOption('مش عارف أبدأ الحل', 'start')}>
                    <span>مش عارف أبدأ الحل</span><HelpCircle className="w-4 h-4 text-primary" />
                  </button>
                  <button className="coach-option-btn" onClick={() => handleMainOption('في جزئية مش فاهمها', 'concept')}>
                    <span>في جزئية مش فاهمها</span><PsychologyAlt className="w-4 h-4 text-primary" />
                  </button>
                  <button className="coach-option-btn" onClick={() => handleMainOption('السؤال صعب عليّ', 'difficulty')}>
                    <span>السؤال صعب عليّ</span><Category className="w-4 h-4 text-primary" />
                  </button>
                  <button className="coach-option-btn" onClick={() => handleMainOption('أريد طرق تعلم مختلفة', 'methods')}>
                    <span>أريد طرق تعلم مختلفة</span><Extension className="w-4 h-4 text-primary" />
                  </button>
                </div>
              )}

              {/* Strategies */}
              {msg.options === 'strategies' && (
                <div className="coach-options-grid coach-strategies-grid">
                  <button className="coach-option-btn coach-strategy-btn" onClick={() => handleStrategySelect('عصف ذهني', 'brainstorming')}><Lightbulb className="w-5 h-5 text-primary" /><span>عصف ذهني</span></button>
                  <button className="coach-option-btn coach-strategy-btn" onClick={() => handleStrategySelect('اكتشف الخطأ', 'error')}><Search className="w-5 h-5 text-primary" /><span>اكتشف الخطأ</span></button>
                  <button className="coach-option-btn coach-strategy-btn" onClick={() => handleStrategySelect('مثال أبسط', 'simpler')}><SmartToy className="w-5 h-5 text-primary" /><span>مثال أبسط</span></button>
                  <button className="coach-option-btn coach-strategy-btn" onClick={() => handleStrategySelect('سؤال مفاهيمي', 'conceptual')}><HelpCircle className="w-5 h-5 text-primary" /><span>سؤال مفاهيمي</span></button>
                  <button className="coach-option-btn coach-strategy-btn" onClick={() => handleStrategySelect('أحجية', 'puzzle')}><Extension className="w-5 h-5 text-primary" /><span>أحجية</span></button>
                  <button className="coach-option-btn coach-strategy-btn" onClick={() => handleStrategySelect('الحل النموذجي', 'solution')}><CheckCircle className="w-5 h-5 text-primary" /><span>الحل النموذجي</span></button>
                  <button className="coach-option-btn coach-back-btn" onClick={initChat}><ArrowRight className="w-4 h-4" /><span>رجوع للقائمة الرئيسية</span></button>
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="coach-message coach-msg-bot">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0 self-end mb-1">
                <SmartToy className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="coach-bubble coach-bubble-bot">
                <div className="coach-typing"><span /><span /><span /></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer — quick options toggle + free text input */}
        <div className="coach-panel-footer">
          {/* Collapsible quick-options tray */}
          <div className="mb-2">
            <button
              onClick={() => setShowQuickOptions(prev => !prev)}
              className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors"
            >
              {showQuickOptions ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              <span>خيارات سريعة</span>
            </button>
            {showQuickOptions && (
              <div className="mt-1.5 grid grid-cols-2 gap-1" style={{ animation: 'page-enter 0.2s ease-out' }}>
                <button className="coach-option-btn !py-1.5 !text-[11px]" onClick={() => { setShowQuickOptions(false); handleMainOption('مش عارف أبدأ الحل', 'start'); }}>مش عارف أبدأ الحل</button>
                <button className="coach-option-btn !py-1.5 !text-[11px]" onClick={() => { setShowQuickOptions(false); handleMainOption('في جزئية مش فاهمها', 'concept'); }}>في جزئية مش فاهمها</button>
                <button className="coach-option-btn !py-1.5 !text-[11px]" onClick={() => { setShowQuickOptions(false); handleMainOption('السؤال صعب عليّ', 'difficulty'); }}>السؤال صعب عليّ</button>
                <button className="coach-option-btn !py-1.5 !text-[11px]" onClick={() => { setShowQuickOptions(false); handleMainOption('أريد طرق تعلم مختلفة', 'methods'); }}>أريد طرق تعلم مختلفة</button>
              </div>
            )}
          </div>
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="اكتب سؤالك هنا..."
              className="w-full bg-surface-container-low/60 border border-outline-variant/30 rounded-full py-2.5 px-5 text-sm text-on-surface focus:outline-none focus:border-primary/40 transition-colors"
              dir="rtl"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isTyping}
              className="absolute left-2 w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-primary/80 hover:bg-primary text-on-primary"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}


// ═══════════════════════════════════════════════════════
// INTERACTIVE STRATEGY WIDGETS
// ═══════════════════════════════════════════════════════

// ─── Solution Steps (expandable timeline) ───
function SolutionWidget({ steps, tip }: { steps: SolutionStep[]; tip: string }) {
  const [revealed, setRevealed] = useState(0);
  return (
    <div className="space-y-2">
      {steps.map((s, i) => (
        <div
          key={i}
          className={`strat-step-card ${i <= revealed ? 'strat-step-revealed' : 'strat-step-hidden'}`}
          onClick={() => { if (i === revealed + 1 || (revealed === 0 && i === 0)) setRevealed(i); }}
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <div className="strat-step-num">{s.number}</div>
          <div className="flex-1">
            <p className="text-xs font-bold text-on-surface">{s.title}</p>
            {i <= revealed && (
              <div style={{ animation: 'page-enter 0.3s ease-out' }}>
                <p className="text-[11px] text-on-surface-variant mt-0.5">{s.desc}</p>
                <div className="strat-math-block">{s.math}</div>
                <p className="text-xs font-bold text-primary mt-1">← {s.result}</p>
              </div>
            )}
          </div>
          {i > revealed && <span className="text-[10px] text-on-surface-variant/50">انقر لكشف</span>}
        </div>
      ))}
      {revealed >= steps.length - 1 && (
        <div className="strat-tip-card" style={{ animation: 'page-enter 0.4s ease-out' }}>
          💡 {tip}
        </div>
      )}
    </div>
  );
}

// ─── Brainstorming (visual flow) ───
function BrainstormingWidget({ steps, tip }: { steps: SolutionStep[]; tip: string }) {
  return (
    <div className="space-y-1">
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div className="strat-flow-card" style={{ animation: `page-enter 0.3s ease-out ${i * 0.15}s both` }}>
            <div className="strat-flow-icon">
              <span className="text-sm font-bold">{s.number}</span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-on-surface">{s.title}</p>
              <p className="text-[11px] text-on-surface-variant">{s.desc}</p>
              <div className="strat-math-block">{s.math} → <span className="text-primary font-bold">{s.result}</span></div>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-primary/40" /></div>
          )}
        </React.Fragment>
      ))}
      <div className="strat-tip-card" style={{ animation: `page-enter 0.3s ease-out ${steps.length * 0.15}s both` }}>💡 {tip}</div>
    </div>
  );
}

// ─── Error Finding (click to identify) ───
function ErrorFindWidget({ errorExample }: { errorExample: Question['errorExample'] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const isCorrectGuess = selected === errorExample.errorIndex;

  return (
    <div className="space-y-1.5">
      {errorExample.steps.map((s, i) => {
        const isSelected = selected === i;
        const isError = i === errorExample.errorIndex;
        const isRevealedCorrect = selected !== null && !isError;
        const isRevealedError = selected !== null && isError;

        return (
          <button
            key={i}
            onClick={() => selected === null && setSelected(i)}
            disabled={selected !== null}
            className={`strat-error-step ${
              isSelected && isError ? 'strat-error-found' :
              isSelected && !isError ? 'strat-error-wrong-guess' :
              isRevealedError && selected !== null ? 'strat-error-found' :
              isRevealedCorrect ? 'strat-error-ok' :
              'strat-error-default'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="strat-error-badge">
                {isRevealedError ? '❌' : isRevealedCorrect || (isSelected && !isError) ? '✅' : `${i + 1}`}
              </span>
              <div className="text-right flex-1">
                <p className="text-xs font-mono" dir="ltr">{s.step}</p>
                <p className="text-[10px] text-on-surface-variant">{s.desc}</p>
              </div>
            </div>
            {isSelected && !isError && (
              <p className="text-[10px] text-error mt-1 font-bold" style={{ animation: 'page-enter 0.2s ease-out' }}>
                ❌ ليست هذه الخطوة الخاطئة... حاول مرة أخرى!
              </p>
            )}
            {(isRevealedError && selected !== null) && (
              <p className="text-[10px] text-error mt-1 font-bold" style={{ animation: 'page-enter 0.2s ease-out' }}>
                🔍 {errorExample.errorExplanation}
              </p>
            )}
          </button>
        );
      })}
      {selected !== null && isCorrectGuess && (
        <div className="strat-tip-card !border-tertiary/30 !bg-tertiary/10 !text-tertiary" style={{ animation: 'page-enter 0.3s ease-out' }}>
          🎉 أحسنت! اكتشفت الخطأ بنجاح!
        </div>
      )}
    </div>
  );
}

// ─── Simpler Example (visual comparison) ───
function SimplerWidget({ data }: { data: Question['simplerExample'] }) {
  const [showResult, setShowResult] = useState(false);
  return (
    <div className="space-y-2">
      <div className="strat-compare-card strat-compare-original">
        <span className="text-[10px] text-on-surface-variant">المعادلة الأصلية</span>
        <p className="text-lg font-mono font-bold text-on-surface/50 text-center" dir="ltr">{data.original}</p>
      </div>

      <div className="flex justify-center"><ArrowDown className="w-5 h-5 text-primary animate-bounce" /></div>

      <div className="strat-compare-card strat-compare-simpler">
        <span className="text-[10px] text-primary font-bold">المثال الأبسط</span>
        <p className="text-xl font-mono font-bold text-primary text-center" dir="ltr">{data.simpler}</p>
      </div>

      {!showResult ? (
        <button onClick={() => setShowResult(true)} className="w-full py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/25 transition-all">
          اكشف الحل ✨
        </button>
      ) : (
        <div style={{ animation: 'page-enter 0.4s ease-out' }}>
          <div className="strat-compare-card strat-compare-result">
            <span className="text-[10px] text-tertiary font-bold">النتيجة</span>
            <p className="text-xl font-mono font-bold text-tertiary text-center" dir="ltr">{data.result}</p>
          </div>
          <div className="strat-tip-card mt-2">{data.explanation}</div>
        </div>
      )}
    </div>
  );
}

// ─── Conceptual (info card) ───
function ConceptWidget({ concept, tip, hint }: { concept: string; tip: string; hint: string }) {
  return (
    <div className="space-y-2">
      <div className="strat-concept-card">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <PsychologyAlt className="w-4 h-4 text-primary" />
          </div>
          <span className="text-xs font-bold text-primary">{concept}</span>
        </div>
        <p className="text-xs text-on-surface-variant leading-relaxed">{tip}</p>
      </div>
      <div className="strat-concept-card !border-secondary/20">
        <p className="text-xs font-bold text-secondary mb-1">💡 التلميح:</p>
        <p className="text-xs text-on-surface-variant leading-relaxed">{hint}</p>
      </div>
    </div>
  );
}

// ─── Puzzle (drag & reorder) ───
function PuzzleWidget({ steps }: { steps: SolutionStep[] }) {
  const [items, setItems] = useState<SolutionStep[]>(() => [...steps].sort(() => Math.random() - 0.5));
  const [checked, setChecked] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const isCorrectOrder = items.every((item, i) => item.number === steps[i].number);

  const moveItem = (from: number, to: number) => {
    if (checked) return;
    const newItems = [...items];
    const [removed] = newItems.splice(from, 1);
    newItems.splice(to, 0, removed);
    setItems(newItems);
  };

  return (
    <div className="space-y-1.5">
      {items.map((s, i) => {
        const isRight = checked && s.number === steps[i].number;
        const isWrong = checked && s.number !== steps[i].number;
        return (
          <div
            key={s.number}
            className={`strat-puzzle-piece ${isRight ? 'strat-puzzle-correct' : ''} ${isWrong ? 'strat-puzzle-wrong' : ''} ${dragIdx === i ? 'opacity-50' : ''}`}
            draggable={!checked}
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragIdx !== null) moveItem(dragIdx, i); setDragIdx(null); }}
            onDragEnd={() => setDragIdx(null)}
          >
            <div className="flex items-center gap-2">
              <span className="strat-puzzle-grip">⠿</span>
              <span className="strat-puzzle-num">{checked ? s.number : '?'}</span>
              <div className="flex-1">
                <p className="text-xs font-bold">{s.title}</p>
                <p className="text-[10px] font-mono text-on-surface-variant" dir="ltr">{s.math}</p>
              </div>
              {!checked && (
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => i > 0 && moveItem(i, i - 1)} className="strat-puzzle-arrow" disabled={i === 0}>▲</button>
                  <button onClick={() => i < items.length - 1 && moveItem(i, i + 1)} className="strat-puzzle-arrow" disabled={i === items.length - 1}>▼</button>
                </div>
              )}
              {isRight && <CheckCircle className="w-4 h-4 text-tertiary shrink-0" />}
              {isWrong && <XCircle className="w-4 h-4 text-error shrink-0" />}
            </div>
          </div>
        );
      })}
      {!checked ? (
        <button onClick={() => setChecked(true)} className="w-full py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/25 transition-all">
          تحقق من الترتيب ✅
        </button>
      ) : (
        <div className={`strat-tip-card ${isCorrectOrder ? '!border-tertiary/30 !bg-tertiary/10 !text-tertiary' : '!border-error/30 !bg-error/10 !text-error'}`} style={{ animation: 'page-enter 0.3s ease-out' }}>
          {isCorrectOrder ? '🎉 ترتيب صحيح! أحسنت!' : '❌ الترتيب غير صحيح. حاول مرة أخرى!'}
          {!isCorrectOrder && (
            <button onClick={() => { setChecked(false); setItems([...steps].sort(() => Math.random() - 0.5)); }} className="block mt-1 text-[10px] underline">إعادة المحاولة</button>
          )}
        </div>
      )}
    </div>
  );
}
