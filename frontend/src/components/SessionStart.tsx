import React, { useState } from 'react';
import { useSession } from '../context/SessionContext';
import { Badge, Category, Analytics, Play, Schedule } from './icons';

export default function SessionStart({ onStart }: { onStart: () => void }) {
  const { startSession } = useSession();
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');

  const handleStart = () => {
    if (!studentId.trim()) {
      setError('يرجى إدخال رقم الطالب للمتابعة');
      return;
    }
    setError('');
    startSession(studentId.trim());
    onStart();
  };

  return (
    <div className="h-full flex items-center justify-center">
      <div className="glass-card rounded-2xl p-8 md:p-12 w-full max-w-2xl relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-[80px]" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-tertiary/10 rounded-full blur-[100px]" />

        <div className="text-center mb-10 relative z-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 border border-primary/30 mb-6">
            <Analytics className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-on-surface mb-2">APEX Diagnostic Session</h1>
          <p className="text-on-surface-variant text-lg">تهيئة جلسة التقييم التشخيصي للطلاب</p>
        </div>

        <div className="space-y-8 relative z-10">
          <div className="space-y-2">
            <label htmlFor="student-id" className="text-sm font-medium text-on-surface-variant block">رقم الطالب (Student ID)</label>
            <div className="relative">
              <Badge className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
              <input 
                id="student-id"
                type="text" 
                placeholder="أدخل رقم الطالب..." 
                value={studentId}
                onChange={(e) => { setStudentId(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                className={`input-glass w-full pr-12 ${error ? 'border-error focus:border-error focus:ring-error' : ''}`}
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? 'student-id-error' : undefined}
              />
            </div>
            {error && (
              <p id="student-id-error" className="text-error text-sm mt-1 animate-in fade-in duration-200" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-on-surface-variant block">المادة (Subject)</label>
              <div className="relative">
                <Category className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline" />
                <input 
                  type="text" 
                  value="الرياضيات (Mathematics)" 
                  readOnly 
                  className="input-glass w-full pr-12 cursor-not-allowed opacity-80"
                  tabIndex={-1}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-on-surface-variant block">نوع الجلسة (Session Type)</label>
              <div className="relative">
                <Analytics className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary" />
                <input 
                  type="text" 
                  value="Diagnostic (تشخيصي)" 
                  readOnly 
                  className="input-glass w-full pr-12 text-primary bg-primary/5 cursor-not-allowed"
                  tabIndex={-1}
                />
              </div>
            </div>
          </div>

          <div className="bg-surface-container-high/50 border border-outline-variant/30 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-secondary-container/50 flex items-center justify-center shrink-0">
              <Schedule className="w-5 h-5 text-secondary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold">المدة الزمنية المتوقعة</h3>
              <p className="text-xs text-on-surface-variant mt-1">15 - 30 دقيقة (10 أسئلة تشخيصية)</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs border border-primary/30">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              جاهز للبدء
            </span>
          </div>

          <button 
            onClick={handleStart}
            className="btn-primary w-full py-4 text-xl rounded-xl"
            aria-label="ابدأ الاختبار التشخيصي"
          >
            <Play className="w-6 h-6 fill-current" />
            ابدأ الاختبار
          </button>
        </div>
      </div>
    </div>
  );
}
