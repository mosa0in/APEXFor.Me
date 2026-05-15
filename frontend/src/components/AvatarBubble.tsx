import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Brain, LogOut, Settings, ChevronDown, Smile } from 'lucide-react';
import { AvatarSVG, AvatarConfig, DEFAULT_AVATAR } from './AvatarSVG';

const API = import.meta.env.VITE_API_URL ?? '';

const PERSONALITY = {
  motivator: { emoji: '🔥', label: 'المحفّز',  ring: '#ff6b6b', bg: 'rgba(255,107,107,0.15)' },
  socratic:  { emoji: '🧠', label: 'السقراطي', ring: '#6fd1d7', bg: 'rgba(111,209,215,0.15)' },
  friendly:  { emoji: '🤝', label: 'الصديق',   ring: '#82dc82', bg: 'rgba(130,220,130,0.15)' },
  strict:    { emoji: '⚡', label: 'الصارم',   ring: '#ffb869', bg: 'rgba(255,184,105,0.15)' },
  default:   { emoji: '✨', label: 'كوتش',      ring: '#6fd1d7', bg: 'rgba(111,209,215,0.15)' },
} as const;
type PersonalityKey = keyof typeof PERSONALITY;

interface Profile {
  full_name: string;
  student_id: string;
  coach_name: string;
  stars_total: number;
  personality: PersonalityKey;
}

function loadAvatar(studentId: string): AvatarConfig {
  try {
    const raw = localStorage.getItem(`apex_avatar_${studentId}`);
    if (raw) return { ...DEFAULT_AVATAR, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_AVATAR;
}

export default function AvatarBubble() {
  const navigate = useNavigate();
  const studentId = localStorage.getItem('apex_current_student') || '';
  const dropRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [avatar, setAvatar] = useState<AvatarConfig>(() => loadAvatar(studentId));
  const [profile, setProfile] = useState<Profile>({
    full_name: studentId,
    student_id: studentId,
    coach_name: 'المدرب',
    stars_total: 0,
    personality: 'default',
  });

  useEffect(() => {
    if (!studentId) return;
    // Seed name from localStorage instantly
    const stored = localStorage.getItem(`apex_student_${studentId}`);
    if (stored) {
      try {
        const s = JSON.parse(stored);
        setProfile(prev => ({ ...prev, full_name: s.full_name || studentId }));
      } catch { /* ignore */ }
    }
    // Refresh avatar from storage on mount
    setAvatar(loadAvatar(studentId));
    // Hydrate full profile from API
    fetch(`${API}/api/auth/me/${studentId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const pStyle = data.coach_personality_json?.style as PersonalityKey | undefined;
        setProfile({
          full_name: data.full_name || studentId,
          student_id: data.student_id,
          coach_name: data.coach_name || 'المدرب',
          stars_total: data.stars_total ?? 0,
          personality: pStyle && pStyle in PERSONALITY ? pStyle : 'default',
        });
        // Avatar may also be in reward_style
        if (data.reward_style?.avatar) {
          const merged = { ...DEFAULT_AVATAR, ...data.reward_style.avatar };
          setAvatar(merged);
          localStorage.setItem(`apex_avatar_${studentId}`, JSON.stringify(merged));
        }
      })
      .catch(() => { /* offline */ });
  }, [studentId]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const p = PERSONALITY[profile.personality];

  function handleLogout() {
    localStorage.removeItem('apex_current_student');
    navigate('/');
  }

  return (
    <div ref={dropRef} className="relative">
      {/* ── Avatar Button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-2xl px-1.5 py-1 hover:bg-white/5 transition-all"
        aria-expanded={open}
      >
        {/* Stars */}
        {profile.stars_total > 0 && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-[#ffb869] font-semibold">
            <Star size={12} className="fill-[#ffb869]" />
            <span>{profile.stars_total}</span>
          </div>
        )}

        {/* Avatar circle */}
        <div
          className="w-9 h-9 rounded-full overflow-hidden shrink-0"
          style={{ border: `2px solid ${p.ring}`, boxShadow: `0 0 10px ${p.ring}44` }}
        >
          <AvatarSVG config={avatar} size={36} />
        </div>

        <ChevronDown
          size={13}
          className={`text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-64 rounded-2xl z-50 overflow-hidden"
          style={{
            background: 'rgba(0,12,24,0.96)',
            border: '1px solid rgba(140,237,243,0.12)',
            backdropFilter: 'blur(24px)',
            animation: 'fadeUp 0.18s ease-out',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Large avatar */}
            <div
              className="w-16 h-16 rounded-2xl overflow-hidden shrink-0"
              style={{ border: `2px solid ${p.ring}`, boxShadow: `0 0 16px ${p.ring}55` }}
            >
              <AvatarSVG config={avatar} size={64} />
            </div>
            <div className="flex-1 min-w-0 text-right">
              <p className="font-semibold text-on-surface text-sm truncate">{profile.full_name}</p>
              <p className="text-xs text-on-surface-variant font-mono">{profile.student_id}</p>
              {profile.stars_total > 0 && (
                <div className="flex items-center gap-1 justify-end mt-1">
                  <span className="text-xs font-bold text-[#ffb869]">{profile.stars_total}</span>
                  <Star size={11} className="text-[#ffb869] fill-[#ffb869]" />
                </div>
              )}
            </div>
          </div>

          {/* Coach info */}
          <div className="px-4 py-3 flex items-center gap-3 justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: p.bg, color: p.ring, border: `1px solid ${p.ring}40` }}
            >
              {p.emoji} {p.label}
            </div>
            <div className="flex items-center gap-2 text-right">
              <div>
                <p className="text-xs text-on-surface-variant">الكوتش</p>
                <p className="text-sm font-semibold text-on-surface">{profile.coach_name}</p>
              </div>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: p.bg }}>
                <Brain size={16} style={{ color: p.ring }} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-2">
            <button
              onClick={() => { setOpen(false); navigate('/avatar-builder'); }}
              className="w-full flex items-center justify-end gap-2 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-all"
            >
              <span>تخصيص الشخصية</span>
              <Smile size={15} />
            </button>
            <button
              onClick={() => { setOpen(false); navigate('/coach-setup'); }}
              className="w-full flex items-center justify-end gap-2 px-3 py-2.5 rounded-xl text-sm text-on-surface-variant hover:bg-white/5 hover:text-on-surface transition-all"
            >
              <span>تعديل الكوتش</span>
              <Settings size={15} />
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-end gap-2 px-3 py-2.5 rounded-xl text-sm text-error/70 hover:bg-error/5 hover:text-error transition-all"
            >
              <span>تسجيل الخروج</span>
              <LogOut size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
