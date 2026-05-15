import React, { useState } from 'react';
import { Lightbulb, Send, ArrowRight } from './icons';

export default function BrainstormingView({ onBack }: { onBack: () => void }) {
  const [ideas, setIdeas] = useState<string[]>([]);
  const [currentIdea, setCurrentIdea] = useState('');

  const addIdea = () => {
    if (currentIdea.trim()) {
      setIdeas([...ideas, currentIdea.trim()]);
      setCurrentIdea('');
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 text-center md:text-right">
        <div className="flex items-center justify-center md:justify-start gap-2 text-tertiary">
          <Lightbulb className="w-5 h-5" />
          <span className="text-sm font-bold tracking-widest uppercase">مختبر الأفكار</span>
        </div>
        <h2 className="text-3xl font-bold">العصف الذهني الرقمي</h2>
        <p className="text-on-surface-variant max-w-2xl">هنا لا توجد أخطاء، فقط أفكار. سجل كل ما يخطر ببالك حول المسألة للوصول للحل.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card rounded-2xl p-6 flex flex-col gap-4 border-tertiary/20">
          <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-4">
            <span className="w-8 h-8 rounded-lg bg-tertiary/20 flex items-center justify-center text-tertiary font-bold">1</span>
            <h3 className="text-xl font-bold">سجل الفكرة</h3>
          </div>
          
          <div className="flex flex-col gap-4">
            <textarea 
              value={currentIdea}
              onChange={(e) => setCurrentIdea(e.target.value)}
              placeholder="اكتب فكرتك هنا (مثلاً: نجرب طرح 5 من الطرفين...)"
              className="w-full h-32 bg-surface-container/50 border border-outline-variant rounded-xl p-4 focus:border-tertiary focus:ring-0 outline-none resize-none"
            />
            <button 
              onClick={addIdea}
              className="btn-primary bg-tertiary text-on-tertiary hover:bg-tertiary/90 py-3 rounded-xl font-bold"
            >
              أضف الفكرة للوحة
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col gap-4 border-dashed border-tertiary/30">
          <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-4">
            <span className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant font-bold">2</span>
            <h3 className="text-xl font-bold">خريطة الأفكار</h3>
          </div>

          <div className="flex flex-wrap gap-3">
            {ideas.length === 0 ? (
              <div className="w-full py-12 flex flex-col items-center justify-center text-on-surface-variant/40 gap-4">
                <Lightbulb className="w-12 h-12 opacity-20" />
                <p>لم يتم تسجيل أفكار حتى الآن</p>
              </div>
            ) : (
              ideas.map((idea, idx) => (
                <div key={idx} className="bg-surface-bright border border-tertiary/30 px-4 py-2 rounded-lg shadow-sm animate-in zoom-in duration-300">
                  {idea}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-start">
        <button onClick={onBack} className="btn-primary px-10 py-3 rounded-xl font-bold">
          <ArrowRight className="w-5 h-5 rotate-180" />
          لنحاول تطبيق هذه الأفكار
        </button>
      </div>
    </div>
  );
}
