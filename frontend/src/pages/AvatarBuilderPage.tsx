import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, RefreshCw, Shuffle } from 'lucide-react';
import {
  AvatarSVG,
  AvatarConfig,
  DEFAULT_AVATAR,
  SKIN_COLORS,
  HAIR_COLORS,
  BG_COLORS,
  OUTFIT_COLORS,
  HAIR_STYLES,
  HAIR_STYLE_LABELS,
  EYE_STYLES,
  EYE_STYLE_LABELS,
} from '../components/AvatarSVG';

const API = import.meta.env.VITE_API_URL ?? '';
const STORAGE_KEY = (id: string) => `apex_avatar_${id}`;

// ─── Random avatar generator ─────────────────────────────────────────────────

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAvatar(): AvatarConfig {
  return {
    skin:      randomPick(SKIN_COLORS),
    hair:      randomPick(HAIR_COLORS),
    hairStyle: randomPick(HAIR_STYLES),
    eyes:      randomPick(EYE_STYLES),
    outfit:    randomPick(OUTFIT_COLORS),
    bg:        randomPick(BG_COLORS),
  };
}

// ─── Color Swatch ────────────────────────────────────────────────────────────

function Swatch({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative w-8 h-8 rounded-full transition-all hover:scale-110"
      style={{ background: color, border: active ? '3px solid white' : '2px solid transparent', boxShadow: active ? '0 0 0 2px rgba(208,188,255,0.8)' : 'none' }}
    >
      {active && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Check size={13} className="text-white drop-shadow" />
        </div>
      )}
    </button>
  );
}

// ─── Style Chip ──────────────────────────────────────────────────────────────

function StyleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
        active
          ? 'bg-primary/20 border-primary text-primary'
          : 'border-outline-variant/20 text-on-surface-variant hover:border-primary/40 hover:text-on-surface'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Section label ───────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-widest mb-2.5">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AvatarBuilderPage() {
  const navigate = useNavigate();
  const studentId = localStorage.getItem('apex_current_student') || '';
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load saved avatar
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY(studentId));
    if (stored) {
      try { setConfig(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, [studentId]);

  function set<K extends keyof AvatarConfig>(key: K, val: AvatarConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    // Persist locally
    localStorage.setItem(STORAGE_KEY(studentId), JSON.stringify(config));
    // Sync to DB via reward_style field
    try {
      await fetch(`${API}/api/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reward_style: { avatar: config } }),
      });
    } catch { /* offline — localStorage is enough */ }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function handleShuffle() {
    setConfig(randomAvatar());
    setSaved(false);
  }

  function handleReset() {
    setConfig(DEFAULT_AVATAR);
    setSaved(false);
  }

  return (
    <div className="app-shell flex items-center justify-center p-4 min-h-screen" dir="rtl">
      {/* Background orbs */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="atmo-orb w-[500px] h-[500px] bg-primary/8 top-[-10%] right-[-8%]" />
        <div className="atmo-orb w-[400px] h-[400px] bg-secondary/6 bottom-[-10%] left-[-8%]" />
      </div>

      <div className="w-full max-w-2xl" style={{ animation: 'fadeUp 0.4s ease-out' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button onClick={handleShuffle} className="p-2 rounded-xl border border-outline-variant/20 text-on-surface-variant hover:text-primary hover:border-primary/40 transition-all" title="عشوائي">
              <Shuffle size={16} />
            </button>
            <button onClick={handleReset} className="p-2 rounded-xl border border-outline-variant/20 text-on-surface-variant hover:text-on-surface transition-all" title="إعادة تعيين">
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-on-surface">صمّم شخصيتك</h1>
            <p className="text-xs text-on-surface-variant mt-0.5">ظاهر في كل الصفحات</p>
          </div>
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl border border-outline-variant/20 text-on-surface-variant hover:text-on-surface transition-all">
            <ArrowLeft size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
          {/* ── Preview ── */}
          <div className="flex flex-col items-center gap-4">
            <div
              className="rounded-3xl overflow-hidden"
              style={{
                width: 180,
                height: 180,
                boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
              }}
            >
              <AvatarSVG config={config} size={180} />
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all ${
                saved
                  ? 'bg-tertiary/20 text-tertiary border border-tertiary/30'
                  : 'btn-primary'
              }`}
            >
              {saving ? 'جاري الحفظ...' : saved ? '✓ تم الحفظ' : 'حفظ الشخصية'}
            </button>
          </div>

          {/* ── Builder Controls ── */}
          <div className="glass-card rounded-2xl p-5 overflow-y-auto" style={{ maxHeight: 420 }}>
            <Section label="لون البشرة">
              {SKIN_COLORS.map(c => (
                <React.Fragment key={c}><Swatch color={c} active={config.skin === c} onClick={() => set('skin', c)} /></React.Fragment>
              ))}
            </Section>

            <Section label="تسريحة الشعر">
              {HAIR_STYLES.map(s => (
                <React.Fragment key={s}><StyleChip label={HAIR_STYLE_LABELS[s]} active={config.hairStyle === s} onClick={() => set('hairStyle', s)} /></React.Fragment>
              ))}
            </Section>

            <Section label="لون الشعر">
              {HAIR_COLORS.map(c => (
                <React.Fragment key={c}><Swatch color={c} active={config.hair === c} onClick={() => set('hair', c)} /></React.Fragment>
              ))}
            </Section>

            <Section label="العيون">
              {EYE_STYLES.map(s => (
                <React.Fragment key={s}><StyleChip label={EYE_STYLE_LABELS[s]} active={config.eyes === s} onClick={() => set('eyes', s)} /></React.Fragment>
              ))}
            </Section>

            <Section label="لون الملابس">
              {OUTFIT_COLORS.map(c => (
                <React.Fragment key={c}><Swatch color={c} active={config.outfit === c} onClick={() => set('outfit', c)} /></React.Fragment>
              ))}
            </Section>

            <Section label="لون الخلفية">
              {BG_COLORS.map(c => (
                <React.Fragment key={c}><Swatch color={c} active={config.bg === c} onClick={() => set('bg', c)} /></React.Fragment>
              ))}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
