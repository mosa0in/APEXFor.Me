import React, { useState, useMemo } from 'react';
import { useSession } from '../context/SessionContext';
import { Extension, CheckCircle, ArrowRight, RefreshCcw } from './icons';

const CORRECT_ORDER = [
  'قراءة السؤال بتمعن وتحديد المطلوب',
  'تحديد المفاهيم والمبادئ ذات الصلة',
  'تطبيق الخطوات المنطقية للحل',
  'مراجعة الإجابة والتحقق من صحتها',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PuzzleView({ onBack }: { onBack: () => void }) {
  const { currentQuestion } = useSession();
  const shuffled = useMemo(() => shuffle(CORRECT_ORDER), []);
  const [selected, setSelected] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const isCorrect = done && selected.join('|') === CORRECT_ORDER.join('|');

  function handleSelect(step: string) {
    if (done || selected.includes(step)) return;
    const next = [...selected, step];
    setSelected(next);
    if (next.length === CORRECT_ORDER.length) setDone(true);
  }

  function handleReset() {
    setSelected([]);
    setDone(false);
  }

  return (
    <div className="flex flex-col gap-6 page-transition">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-primary">
          <Extension className="w-4 h-4 fill-current" />
          <span className="text-xs font-bold tracking-widest uppercase">أحجية ترتيب الخطوات</span>
        </div>
        <h2 className="text-2xl font-bold">رتّب خطوات حل المسألة</h2>
        {currentQuestion && (
          <p className="text-sm text-on-surface-variant">المفهوم: {currentQuestion.concept}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shuffled pool */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">
            اضغط الخطوات بالترتيب الصحيح:
          </p>
          {shuffled.map(step => {
            const picked = selected.includes(step);
            const order = selected.indexOf(step) + 1;
            return (
              <button
                key={step}
                onClick={() => handleSelect(step)}
                disabled={done || picked}
                className={`w-full text-right p-4 rounded-xl border transition-all text-sm ${
                  picked
                    ? 'border-primary/20 bg-primary/5 opacity-40 cursor-default'
                    : 'border-outline-variant/30 bg-surface-container-low/50 hover:border-primary/50 hover:bg-primary/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                    picked ? 'bg-primary/20 text-primary' : 'bg-surface-container text-on-surface-variant'
                  }`}>
                    {picked ? order : ''}
                  </div>
                  <span>{step}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Ordered output */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">
            ترتيبك حتى الآن:
          </p>
          {selected.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-32 rounded-2xl border-2 border-dashed border-outline-variant/30">
              <p className="text-xs text-on-surface-variant/50">ابدأ باختيار الخطوة الأولى...</p>
            </div>
          ) : (
            selected.map((step, i) => (
              <div
                key={step}
                className="flex items-center gap-3 p-4 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 text-sm"
                style={{ animation: 'page-enter 0.25s ease-out' }}
              >
                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </div>
                <span>{step}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {done && (
        <div
          className={`p-5 rounded-2xl text-center font-bold text-base ${
            isCorrect
              ? 'bg-tertiary/10 text-tertiary border border-tertiary/30'
              : 'bg-error/10 text-error border border-error/30'
          }`}
          style={{ animation: 'page-enter 0.3s ease-out' }}
        >
          {isCorrect
            ? '🎉 ممتاز! رتّبت الخطوات بشكل صحيح'
            : '🔄 الترتيب الصحيح مختلف، جرّب مجدداً'}
        </div>
      )}

      <div className="flex items-center gap-3 mt-2">
        {done && !isCorrect && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-surface-container border border-outline-variant/30 hover:bg-surface-container-high transition-all text-sm font-medium"
          >
            <RefreshCcw className="w-4 h-4" />
            حاول مجدداً
          </button>
        )}
        <button onClick={onBack} className="btn-primary px-8 py-3 rounded-xl">
          <ArrowRight className="w-4 h-4 rotate-180" />
          رجوع
        </button>
      </div>
    </div>
  );
}
