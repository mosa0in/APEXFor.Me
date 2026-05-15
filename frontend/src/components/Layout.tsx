import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { Timer, Analytics, Flag, BarChart3, X, Settings, ArrowRight } from './icons';
import { isAIAvailable } from '../services/ai';
import CurriculumSelector from './CurriculumSelector';

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  onEndSession?: () => void;
}

export default function Layout({ children, showSidebar = false, onEndSession }: LayoutProps) {
  const { state, totalQuestions } = useSession();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const progress = (state.responses.length / totalQuestions) * 100;

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 px-4 py-3 mb-2">
        <Analytics className="w-6 h-6 text-primary" />
        <span className="font-bold text-primary text-lg">APEX</span>
        {isAIAvailable() && <span className="ai-badge">AI</span>}
      </div>

      {/* Curriculum Selector */}
      <div className="px-2 mb-3">
        <CurriculumSelector />
      </div>

      <button onClick={() => navigate('/roadmap')} className="flex items-center gap-2 px-4 py-2 mb-4 rounded-xl text-on-surface-variant hover:text-primary hover:bg-primary/5 transition-all text-sm w-full">
        <ArrowRight className="w-4 h-4" />
        <span>العودة للخارطة</span>
      </button>

      <div className="glass-card rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 text-on-surface-variant text-xs mb-2">
          <BarChart3 className="w-4 h-4" />
          <span>التقدم</span>
        </div>
        <div className="text-2xl font-bold text-primary">{state.responses.length} / {totalQuestions}</div>
        <div className="w-full h-1.5 bg-surface-container-highest rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="glass-card rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 text-on-surface-variant text-xs mb-2">
          <Timer className="w-4 h-4" />
          <span>الطالب</span>
        </div>
        <div className="text-sm font-bold text-on-surface truncate">{state.studentId || '—'}</div>
      </div>

      {state.responses.length > 0 && (
        <div className="glass-card rounded-xl p-4 mb-4">
          <div className="text-xs text-on-surface-variant mb-2">الإجابات الصحيحة</div>
          <div className="text-xl font-bold text-tertiary">
            {state.responses.filter(r => r.isCorrect).length} ✓
          </div>
        </div>
      )}

      <div className="flex-1" />



      {onEndSession && (
        <button onClick={() => { onEndSession(); setMobileMenuOpen(false); }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-error/70 hover:text-error hover:bg-error/5 transition-all w-full mt-2" aria-label="إنهاء الجلسة">
          <Flag className="w-5 h-5" />
          <span className="font-medium">إنهاء الجلسة</span>
        </button>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans selection:bg-primary/30" dir="rtl">
      {/* Toast */}
      {state.toastMessage && (
        <div className={`toast toast-${state.toastType}`} role="alert" aria-live="polite">
          {state.toastMessage}
        </div>
      )}

      <div className="flex min-h-screen">
        {/* Desktop Sidebar */}
        {showSidebar && (
          <aside className="hidden lg:flex flex-col w-64 border-l border-primary/10 bg-surface-container-lowest/50 backdrop-blur-md p-4 gap-2 shrink-0" role="navigation">
            {sidebarContent}
          </aside>
        )}

        {/* Mobile Top Bar */}
        {showSidebar && (
          <div className="fixed top-0 left-0 right-0 z-40 lg:hidden flex items-center justify-between px-4 py-3 bg-surface-container-lowest/90 backdrop-blur-md border-b border-primary/10">
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-lg hover:bg-surface-bright text-primary" aria-label="القائمة">
              <Settings className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-primary">{state.responses.length}/{totalQuestions}</span>
              <div className="w-20 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Analytics className="w-5 h-5 text-primary" />
              <span className="font-bold text-primary text-sm">APEX</span>
            </div>
          </div>
        )}

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <>
            <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)} />
            <div className="mobile-sidebar flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-primary">القائمة</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg hover:bg-surface-bright text-on-surface-variant">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {sidebarContent}
            </div>
          </>
        )}

        {/* Main Content */}
        <main className={`flex-1 w-full ${showSidebar ? 'lg:pr-0 pt-14 lg:pt-0' : ''}`}>
          <div className="max-w-5xl mx-auto py-8 md:py-12 px-4 h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
