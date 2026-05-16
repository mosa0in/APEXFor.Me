import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Map, CloudUpload, BookOpen, Menu, X, Sparkles, BarChart3 } from 'lucide-react';
import AvatarBubble from './AvatarBubble';
import CurriculumSelector from './CurriculumSelector';
import ProcessingBanner from './ProcessingBanner';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { path: '/roadmap', label: 'خارطة الطريق', icon: Map },
    { path: '/upload', label: 'رفع مادة', icon: CloudUpload },
    { path: '/curriculum', label: 'المنهج', icon: BookOpen },
    { path: '/results', label: 'النتائج', icon: BarChart3 },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="app-shell" dir="rtl">
      {/* ═══ Background Orbs ═══ */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="atmo-orb w-[500px] h-[500px] bg-primary/8 top-[-10%] right-[-8%]" />
        <div className="atmo-orb w-[400px] h-[400px] bg-secondary/6 bottom-[-10%] left-[-8%]" />
      </div>

      {/* ═══ Header ═══ */}
      <header className="app-shell-header">
        {/* Right: Brand + Nav */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Brand */}
          <button onClick={() => navigate('/roadmap')} className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-primary/5 transition-all">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-bold text-primary text-lg hidden sm:inline">APEX</span>
          </button>

          <div className="hidden md:flex items-center gap-1 mr-2">
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`nav-tab ${isActive(item.path) ? 'nav-tab-active' : ''}`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Left: CurriculumSelector + Avatar + Mobile hamburger */}
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <CurriculumSelector />
          </div>
          <div className="hidden md:block">
            <AvatarBubble />
          </div>
          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-primary/5 text-on-surface-variant">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ═══ Processing / Upload Status Banner ═══ */}
      <ProcessingBanner />

      {/* ═══ Mobile Nav Overlay ═══ */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50 md:hidden" onClick={() => setMobileOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-72 z-50 p-5 flex flex-col gap-2 md:hidden" style={{
            background: 'linear-gradient(180deg, rgba(22, 17, 38, 0.98) 0%, rgba(14, 12, 20, 0.99) 100%)',
            borderLeft: '1px solid rgba(208, 188, 255, 0.1)',
            animation: 'slide-in-right 0.3s ease-out',
          }}>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-primary/10 text-on-surface-variant">
                <X className="w-5 h-5" />
              </button>
              <span className="font-bold text-primary">القائمة</span>
            </div>

            {/* User info */}
            <div className="mb-3 flex justify-end">
              <AvatarBubble />
            </div>

            {/* Curriculum selector */}
            <div className="mb-2 flex justify-end">
              <CurriculumSelector />
            </div>

            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                className={`nav-tab w-full justify-end ${isActive(item.path) ? 'nav-tab-active' : ''}`}
              >
                <span>{item.label}</span>
                <item.icon className="w-4 h-4" />
              </button>
            ))}

            <div className="flex-1" />
          </div>
        </>
      )}

      {/* ═══ Content ═══ */}
      <main className="flex-1 w-full">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
