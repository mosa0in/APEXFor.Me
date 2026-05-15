import React, { useState } from 'react';
import { Extension, Lightbulb as TipsAndUpdates, CheckCircle, ArrowRight } from './icons';

export default function PuzzleView({ onBack }: { onBack: () => void }) {
  const [squareVal, setSquareVal] = useState('');
  const [circleVal, setCircleVal] = useState('');
  const [showResult, setShowResult] = useState(false);

  const isCorrect = squareVal === '10' && circleVal === '4';

  return (
    <div className="h-full flex flex-col items-center justify-center gap-8 animate-in fade-in duration-700">
      <div className="w-full max-w-5xl self-center">
        <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant hover:text-primary font-bold mb-4 transition-all">
          <ArrowRight className="w-5 h-5 rotate-180" />
          العودة للأسئلة
        </button>
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-primary tracking-wide">أحجية التوازن</h1>
        <p className="text-lg text-on-surface-variant max-w-2xl mx-auto">اكتشف قيمة الأشكال المجهولة لتحقيق التوازن في المعادلة. استخدم المنطق لتفكيك الرموز.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-5xl">
        <div className="lg:col-span-8 glass-card rounded-2xl p-6 md:p-10 flex flex-col items-center relative gap-8">
          <div className="absolute inset-0 opacity-5 flex items-center justify-center pointer-events-none">
            <Extension className="w-64 h-64" />
          </div>

          <div className="relative z-10 w-full space-y-8">
            <EquationRow value="30">
               <Shape type="square" />
               <Shape type="plus" />
               <Shape type="square" />
               <Shape type="plus" />
               <Shape type="square" />
            </EquationRow>

            <EquationRow value="18">
               <Shape type="square" />
               <Shape type="plus" />
               <Shape type="circle" />
               <Shape type="plus" />
               <Shape type="circle" />
            </EquationRow>

            <div className="bg-surface-container-highest/60 rounded-xl p-6 md:p-8 border border-primary/50 shadow-[0_0_20px_rgba(111,209,215,0.1)] mt-4 flex items-center justify-between">
              <div className="flex items-center gap-4 md:gap-6">
                <Shape type="circle" />
                <Shape type="multiply" />
                <Shape type="square" />
              </div>
              <Shape type="equals" />
              <div className={`w-20 md:w-24 h-16 md:h-20 bg-surface-dim border-b-2 border-primary rounded-t flex items-center justify-center transition-all ${showResult ? 'bg-primary/20 animate-none' : 'animate-pulse'}`}>
                <span className="text-2xl md:text-3xl text-on-surface-variant font-bold">
                  {showResult ? (parseInt(squareVal) * parseInt(circleVal) || '?') : '?'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-6 flex flex-col gap-6 h-full">
            <div className="flex items-center gap-3 border-b border-primary/20 pb-4">
              <TipsAndUpdates className="w-8 h-8 text-tertiary" />
              <h3 className="text-xl font-bold">تحليل المساعد</h3>
            </div>
            
            <div className="flex-1 space-y-6">
              <p className="text-on-surface-variant leading-relaxed">
                تلميح: ابدأ بالمعادلة الأولى. ما هو الرقم الذي إذا جمعته مع نفسه ثلاث مرات يساوي 30؟
              </p>

              <div className="space-y-4 pt-4 border-t border-outline-variant/30">
                <InputRow 
                  type="square" 
                  color="tertiary" 
                  value={squareVal} 
                  onChange={setSquareVal} 
                />
                <InputRow 
                  type="circle" 
                  color="primary" 
                  value={circleVal} 
                  onChange={setCircleVal} 
                />
              </div>
            </div>

            <button 
              onClick={() => setShowResult(true)}
              disabled={!squareVal || !circleVal}
              className={`btn-primary w-full py-4 rounded-xl text-lg mt-auto transition-all ${(!squareVal || !circleVal) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              تأكيد الإجابة
              <CheckCircle className="w-5 h-5" />
            </button>
            
            {showResult && (
              <div className={`mt-4 p-4 rounded-xl text-center font-bold text-lg animate-in slide-in-from-top duration-300 ${isCorrect ? 'bg-tertiary/20 text-tertiary' : 'bg-error/20 text-error'}`}>
                {isCorrect ? 'إجابة عبقرية! احسنت' : 'حاول مرة أخرى، ركز في الحساب'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EquationRow({ children, value }: { children: React.ReactNode, value: string }) {
  return (
    <div className="flex items-center justify-between bg-surface-container-low/50 rounded-xl p-4 md:p-6 border border-outline-variant/30 overflow-x-auto gap-4">
      <div className="flex items-center gap-4 md:gap-6 shrink-0">
        {children}
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <Shape type="equals" />
        <div className="text-2xl md:text-3xl font-bold text-secondary tracking-widest">{value}</div>
      </div>
    </div>
  );
}

function Shape({ type }: { type: 'square' | 'circle' | 'plus' | 'multiply' | 'equals' }) {
  if (type === 'square') return <div className="w-10 h-10 md:w-14 md:h-14 rounded bg-tertiary-container/10 border-2 border-tertiary shadow-[0_0_15px_rgba(50,217,186,0.2)] shrink-0" />;
  if (type === 'circle') return <div className="w-10 h-10 md:w-14 md:h-14 rounded-full bg-primary-container/10 border-2 border-primary shadow-[0_0_15px_rgba(111,209,215,0.2)] shrink-0" />;
  if (type === 'plus') return <span className="text-2xl md:text-3xl text-primary font-bold">+</span>;
  if (type === 'multiply') return <span className="text-2xl md:text-3xl text-tertiary font-bold">×</span>;
  if (type === 'equals') return <span className="text-2xl md:text-3xl font-bold mx-2 md:mx-4">=</span>;
  return null;
}

function InputRow({ type, color, value, onChange }: { type: 'square' | 'circle', color: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between bg-surface-container-low p-4 rounded-xl">
      <Shape type={type} />
      <span className="text-on-surface-variant font-bold text-xl">=</span>
      <input 
        type="number" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="القيمة" 
        className="w-24 bg-surface-dim border border-outline-variant rounded-lg p-2 text-center text-lg focus:border-primary outline-none text-on-surface"
      />
    </div>
  );
}

