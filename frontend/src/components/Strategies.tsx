import React from 'react';
import { useSession } from '../context/SessionContext';
import { Lightbulb, Search, Architecture, HelpOutline, Extension, CheckCircle, ArrowRight, SmartToy } from './icons';

interface StrategiesProps {
  onBack: () => void;
  onSelect: (strategy: string) => void;
}

export default function TeachingStrategies({ onBack, onSelect }: StrategiesProps) {
  const { currentQuestion } = useSession();
  const hasError = !!currentQuestion?.errorExample;
  const hasSimpler = !!currentQuestion?.simplerExample;
  const hasSolution = !!currentQuestion?.solution;

  return (
    <div className="h-full flex items-center justify-center">
      <div className="glass-card rounded-2xl p-8 md:p-12 w-full max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-500">
        <header className="flex items-center gap-6 border-b border-outline-variant/40 pb-8 mb-8">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full border-2 border-primary overflow-hidden bg-surface-container-high flex items-center justify-center shadow-[0_0_20px_rgba(208,188,255,0.4)]">
              <SmartToy className="w-10 h-10 text-primary" />
            </div>
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-tertiary rounded-full border-2 border-surface shadow-[0_0_8px_rgba(255,184,105,0.8)]" />
          </div>
          <h1 className="text-2xl font-bold text-on-surface">
            فهمتك، خليني أساعدك بواحدة من هالطرق:
          </h1>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" role="list" aria-label="استراتيجيات المساعدة">
          <StrategyCard
            icon={<Lightbulb className="w-8 h-8 fill-current" />}
            label="عصف ذهني"
            onClick={() => onSelect('brainstorming')}
          />
          {hasError && (
            <StrategyCard
              icon={<Search className="w-8 h-8" />}
              label="اكتشف الخطأ"
              onClick={() => onSelect('error')}
            />
          )}
          {hasSimpler && (
            <StrategyCard
              icon={<Architecture className="w-8 h-8 fill-current" />}
              label="مثال أبسط"
              onClick={() => onSelect('simpler')}
            />
          )}
          <StrategyCard
            icon={<HelpOutline className="w-8 h-8" />}
            label="سؤال مفاهيمي"
            onClick={() => onSelect('conceptual')}
          />
          <StrategyCard
            icon={<Extension className="w-8 h-8 fill-current" />}
            label="أحجية"
            onClick={() => onSelect('puzzle')}
          />
          {hasSolution && (
            <StrategyCard
              icon={<CheckCircle className="w-8 h-8" />}
              label="الحل النموذجي"
              onClick={() => onSelect('solution')}
            />
          )}
        </div>

        <footer className="mt-8 pt-8 flex justify-end">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-all"
            aria-label="رجوع للسؤال"
          >
            <ArrowRight className="w-5 h-5" />
            <span>رجوع</span>
          </button>
        </footer>
      </div>
    </div>
  );
}

function StrategyCard({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-4 p-8 rounded-2xl bg-surface-container-low/60 border border-outline-variant/30 backdrop-blur-md hover:bg-primary/10 hover:border-primary/50 transition-all duration-300"
      role="listitem"
      aria-label={`استراتيجية: ${label}`}
    >
      <div className="w-14 h-14 rounded-full bg-surface-container-highest flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary/20 transition-all">
        {icon}
      </div>
      <span className="text-xl font-bold text-on-surface group-hover:text-primary transition-colors">{label}</span>
    </button>
  );
}
