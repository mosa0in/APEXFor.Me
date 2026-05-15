import React from 'react';
import { useSession } from '../context/SessionContext';
import { CheckCircle, Lightbulb, BrainCircuit } from './icons';

export default function SolutionView({ onBack }: { onBack: () => void }) {
  const { currentQuestion } = useSession();

  if (!currentQuestion) return null;

  const solution = currentQuestion.solution;

  if (!solution) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 page-transition py-16">
        <p className="text-on-surface-variant text-lg">لا يوجد حل تفصيلي لهذا السؤال</p>
        <button onClick={onBack} className="btn-primary px-8 py-3 rounded-xl">رجوع</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-tertiary">
          <BrainCircuit className="w-5 h-5" />
          <span className="text-sm font-bold tracking-widest uppercase">الحل النموذجي المعتمد</span>
        </div>
        <h1 className="text-3xl font-bold">خطوات الحل التفصيلية</h1>
        <p className="text-on-surface-variant max-w-2xl">راجع الخطوات المنطقية التي تؤدي للحل الصحيح لتعزيز فهمك للمادة.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-4">
          {solution.steps.map((step, idx) => (
            <StepCard 
              key={step.number}
              number={step.number} 
              title={step.title} 
              desc={step.desc}
              math={step.math}
              result={step.result}
              isFinal={idx === solution.steps.length - 1}
            />
          ))}
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-6 border-tertiary/30 bg-tertiary/5">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-tertiary">
              <Lightbulb className="w-6 h-6" />
              تذكر دائماً:
            </h3>
            <p className="text-on-surface-variant leading-relaxed">
              {solution.tip}
            </p>
          </div>
          
          <button onClick={onBack} className="btn-primary w-full py-4 rounded-xl mt-auto" aria-label="العودة للأسئلة">
            فهمت، لنعد للأسئلة
            <CheckCircle className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StepCard({ number, title, desc, math, result, isFinal = false }: { key?: number; number: number; title: string; desc: string; math: string; result: string; isFinal?: boolean }) {
  return (
    <div className={`glass-card rounded-2xl p-6 border-l-4 ${isFinal ? 'border-primary' : 'border-tertiary/50'} relative overflow-hidden`}>
      <div className="flex gap-6 items-start">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-lg ${isFinal ? 'bg-primary text-on-primary' : 'bg-surface-container-high'}`}>
          {number}
        </div>
        <div className="flex-1 space-y-3">
          <h4 className="text-xl font-bold">{title}</h4>
          <p className="text-on-surface-variant">{desc}</p>
          <div className="bg-surface-dim/50 rounded-xl p-4 flex flex-col items-center justify-center font-mono gap-2 border border-outline-variant/30">
            <span className="text-2xl opacity-80" dir="ltr">{math}</span>
            <div className="w-full h-px bg-primary/20 my-1" />
            <span className={`text-3xl font-bold ${isFinal ? 'text-primary' : 'text-on-surface'}`} dir="ltr">{result}</span>
          </div>
        </div>
      </div>
      {isFinal && <div className="absolute top-4 left-4 text-primary opacity-20"><CheckCircle className="w-12 h-12" /></div>}
    </div>
  );
}
