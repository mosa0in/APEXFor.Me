import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { questions as allQuestions } from '../data/questions';
import { CheckCircle, Timer, Quiz, PsychologyAlt, RefreshCcw as Autorenew, SupportAgent, X, Download, FileSpreadsheet, Target, Percent, ArrowLeft, ArrowRight, XCircle, Eye } from './icons';

interface ModalProps { isOpen: boolean; onClose: () => void; title: string; icon: React.ReactNode; children: React.ReactNode; wide?: boolean }

export function Modal({ isOpen, onClose, title, icon, children, wide = false }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md" role="dialog" aria-modal="true">
      <div className={`glass-card rounded-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} relative max-h-[90vh] flex flex-col`} style={{ animation: 'page-enter 0.3s ease-out' }}>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-[60px] pointer-events-none" />
        <div className="px-6 py-4 border-b border-primary/20 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-primary flex items-center gap-3">{icon}{title}</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded-full hover:bg-surface-bright" aria-label="إغلاق"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function SessionEndSummary({ onEnd }: { onEnd: () => void }) {
  const { getSessionSummary, exportData, state } = useSession();
  const [showReview, setShowReview] = useState(false);
  const summary = getSessionSummary();

  if (showReview) {
    return <ReviewAnswers onBack={() => setShowReview(false)} />;
  }

  return (
    <div className="min-h-full flex items-start justify-center py-8 overflow-y-auto page-transition">
      <div className="glass-card rounded-2xl p-6 md:p-10 w-full max-w-4xl text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-5 mx-auto border border-primary/20 shadow-[0_0_40px_rgba(111,209,215,0.15)]">
          <CheckCircle className="w-10 h-10 text-primary fill-primary/20" />
        </div>
        <h1 className="text-2xl font-bold text-primary mb-2">تم حفظ الجلسة بنجاح</h1>
        <p className="text-on-surface-variant max-w-lg mx-auto mb-8">تم تجميع البيانات التشخيصية. راجع ملخص الأداء أدناه.</p>

        {/* Donut Chart + Stats */}
        <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
          {/* Donut */}
          <div className="relative shrink-0">
            <div className="donut-chart w-36 h-36" style={{ '--donut-percent': summary.accuracy, '--donut-color': summary.accuracy >= 70 ? '#5af6d6' : summary.accuracy >= 40 ? '#95cdf3' : '#ffb4ab' } as React.CSSProperties}>
              <div className="absolute inset-3 bg-surface-container-lowest rounded-full flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-primary">{summary.accuracy}%</span>
                <span className="text-xs text-on-surface-variant">الدقة</span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 flex-1 w-full">
            <StatCard icon={<Timer className="w-4 h-4 text-secondary" />} title="المدة" value={`${Math.round(summary.totalTime / 60)}`} unit="دقيقة" />
            <StatCard icon={<Quiz className="w-4 h-4 text-tertiary" />} title="الأسئلة" value={`${summary.totalQuestions}`} unit="سؤال" />
            <StatCard icon={<Target className="w-4 h-4 text-primary" />} title="الصحيحة" value={`${summary.correctCount}`} unit={`من ${summary.totalQuestions}`} />
            <StatCard icon={<PsychologyAlt className="w-4 h-4 text-secondary" />} title="متوسط الثقة" value={`${summary.avgConfidence.toFixed(1)}`} unit="/ 5" />
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <MiniStat icon={<Autorenew className="w-4 h-4" />} title="إعادات صياغة" value={`${summary.rephraseCount}`} />
          <MiniStat icon={<SupportAgent className="w-4 h-4" />} title="استدعاءات كوتش" value={`${summary.coachCount}`} />
          <MiniStat icon={<Percent className="w-4 h-4" />} title="متوسط الصعوبة" value={`${summary.avgDifficulty.toFixed(1)}`} />
        </div>

        {/* Per-question mini bar chart */}
        <div className="bg-surface-container-low/60 rounded-xl p-4 mb-8 border border-outline-variant/30">
          <h3 className="text-sm font-bold text-on-surface-variant mb-3 text-right">نتائج الأسئلة</h3>
          <div className="flex items-end gap-1 justify-center h-16">
            {state.responses.map((r, i) => (
              <div key={i} className="flex flex-col items-center gap-1" title={`سؤال ${i + 1}: ${r.isCorrect ? 'صحيح' : 'خطأ'}`}>
                <div className={`w-5 rounded-t transition-all ${r.isCorrect ? 'bg-tertiary' : 'bg-error/60'}`} style={{ height: `${Math.max(12, (r.confidence / 5) * 48)}px` }} />
                <span className="text-[10px] text-on-surface-variant">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => setShowReview(true)} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-surface-container-highest border border-primary/20 text-on-surface hover:bg-surface-bright transition-all font-bold">
            <Eye className="w-5 h-5" />
            مراجعة الإجابات
          </button>
          <button onClick={onEnd} className="btn-primary px-10 py-3 rounded-xl">إنهاء</button>
        </div>
      </div>
    </div>
  );
}

function ReviewAnswers({ onBack }: { onBack: () => void }) {
  const { state } = useSession();
  const [current, setCurrent] = useState(0);
  const r = state.responses[current];
  const q = allQuestions.find(x => x.id === r?.questionId);

  if (!r || !q) return null;

  return (
    <div className="h-full flex items-center justify-center page-transition">
      <div className="glass-card rounded-2xl p-6 md:p-8 w-full max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors text-sm">
            <ArrowRight className="w-4 h-4" />العودة للملخص
          </button>
          <span className="text-sm font-bold text-primary">سؤال {current + 1} / {state.responses.length}</span>
        </div>

        <h3 className="text-xl font-bold mb-6">{q.text}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {q.options.map((opt, idx) => {
            let cls = 'flex items-center gap-3 p-3 rounded-xl border text-right ';
            if (idx === q.correctIndex) cls += 'border-tertiary bg-tertiary/10';
            else if (idx === r.selectedIndex && !r.isCorrect) cls += 'border-error bg-error/10';
            else cls += 'border-outline-variant/30 bg-surface-container-low/30';
            return (
              <div key={idx} className={cls}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${idx === q.correctIndex ? 'bg-tertiary text-on-tertiary' : idx === r.selectedIndex && !r.isCorrect ? 'bg-error text-on-error' : 'bg-surface-container text-on-surface-variant'}`}>{opt.label}</div>
                <span className="font-mono text-sm" dir="ltr">{opt.content}</span>
                {idx === q.correctIndex && <CheckCircle className="w-4 h-4 text-tertiary mr-auto" />}
                {idx === r.selectedIndex && !r.isCorrect && <XCircle className="w-4 h-4 text-error mr-auto" />}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-surface-container-low/50 rounded-lg p-3 text-center"><span className="text-xs text-on-surface-variant block">الثقة</span><span className="font-bold">{r.confidence}/5</span></div>
          <div className="bg-surface-container-low/50 rounded-lg p-3 text-center"><span className="text-xs text-on-surface-variant block">الصعوبة</span><span className="font-bold">{r.difficulty}/5</span></div>
          <div className="bg-surface-container-low/50 rounded-lg p-3 text-center"><span className="text-xs text-on-surface-variant block">الوقت</span><span className="font-bold">{r.timeSpent}ث</span></div>
          <div className="bg-surface-container-low/50 rounded-lg p-3 text-center"><span className="text-xs text-on-surface-variant block">النتيجة</span><span className={`font-bold ${r.isCorrect ? 'text-tertiary' : 'text-error'}`}>{r.isCorrect ? '✓ صح' : '✗ خطأ'}</span></div>
        </div>

        {r.reflection && (
          <div className="bg-surface-container-low/50 rounded-xl p-4 mb-6 border border-outline-variant/30">
            <span className="text-xs text-on-surface-variant block mb-1">تفكير الطالب:</span>
            <p className="text-sm">{r.reflection}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button onClick={() => setCurrent(p => Math.max(0, p - 1))} disabled={current === 0} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface-bright/20 border border-primary/20 text-on-surface hover:text-primary disabled:opacity-30 transition-all text-sm">
            <ArrowRight className="w-4 h-4" />السابق
          </button>
          <div className="flex gap-1">
            {state.responses.map((resp, i) => (
              <button key={i} onClick={() => setCurrent(i)} className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${i === current ? 'bg-primary text-on-primary' : resp.isCorrect ? 'bg-tertiary/20 text-tertiary' : 'bg-error/20 text-error'}`}>{i + 1}</button>
            ))}
          </div>
          <button onClick={() => setCurrent(p => Math.min(state.responses.length - 1, p + 1))} disabled={current === state.responses.length - 1} className="flex items-center gap-1 px-4 py-2 rounded-lg bg-surface-bright/20 border border-primary/20 text-on-surface hover:text-primary disabled:opacity-30 transition-all text-sm">
            التالي<ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, unit }: { icon: React.ReactNode; title: string; value: string; unit: string }) {
  return (
    <div className="bg-surface-container-low/60 backdrop-blur-md rounded-xl p-4 border border-outline-variant/30 flex flex-col gap-2 text-right">
      <div className="flex items-center gap-2 text-on-surface-variant"><div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center">{icon}</div><span className="text-xs">{title}</span></div>
      <div className="flex items-baseline gap-1"><span className="text-2xl font-bold text-primary">{value}</span><span className="text-xs text-on-surface-variant">{unit}</span></div>
    </div>
  );
}

function MiniStat({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="bg-surface-container-low/60 rounded-xl p-3 border border-outline-variant/30 flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-on-surface-variant text-xs">{icon}<span>{title}</span></div>
      <span className="text-lg font-bold">{value}</span>
    </div>
  );
}
