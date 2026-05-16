import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Sparkles, ArrowLeft, Check } from 'lucide-react';
import { getAuthHeader } from '../services/backend';

const API = import.meta.env.VITE_API_URL ?? '';

const PERSONALITIES = [
  {
    id: 'motivator',
    emoji: '🔥',
    name: 'المحفّز',
    desc: 'يشجعك باستمرار ويحتفل بكل إنجاز — مثالي إذا تحتاج دفعة معنوية',
    color: 'border-error/40 bg-error/5 hover:bg-error/10',
    active: 'border-error bg-error/10 shadow-[0_0_20px_rgba(255,100,100,0.2)]',
  },
  {
    id: 'socratic',
    emoji: '🧠',
    name: 'السقراطي',
    desc: 'يطرح أسئلة تجعلك تفكر — يساعدك تكتشف الحل بنفسك',
    color: 'border-primary/40 bg-primary/5 hover:bg-primary/10',
    active: 'border-primary bg-primary/10 shadow-[0_0_20px_rgba(208,188,255,0.2)]',
  },
  {
    id: 'friendly',
    emoji: '🤝',
    name: 'الصديق',
    desc: 'أسلوب دافئ وبسيط — يشرح بهدوء ويصبر على أسئلتك',
    color: 'border-tertiary/40 bg-tertiary/5 hover:bg-tertiary/10',
    active: 'border-tertiary bg-tertiary/10 shadow-[0_0_20px_rgba(130,220,130,0.2)]',
  },
  {
    id: 'strict',
    emoji: '⚡',
    name: 'الصارم',
    desc: 'مباشر وتحدّيّ — يرفع السقف ويدفعك لأقصى طاقتك',
    color: 'border-[#ffb869]/40 bg-[#ffb869]/5 hover:bg-[#ffb869]/10',
    active: 'border-[#ffb869] bg-[#ffb869]/10 shadow-[0_0_20px_rgba(255,184,105,0.2)]',
  },
];

export default function CoachSetupPage() {
  const navigate = useNavigate();
  const studentId = localStorage.getItem('apex_current_student') || '';

  const [coachName, setCoachName] = useState('');
  const [personality, setPersonality] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canContinue = coachName.trim().length >= 2 && personality !== '';

  async function handleSave() {
    if (!canContinue) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/students/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({
          coach_name: coachName.trim(),
          coach_personality_json: { style: personality },
        }),
      });
      if (!res.ok) throw new Error('فشل الحفظ');
      navigate('/upload');
    } catch (e: any) {
      setError(e.message || 'فشل الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell flex items-center justify-center p-5" dir="rtl">
      {/* Atmospheric */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="atmo-orb w-[500px] h-[500px] bg-primary/10 top-[-10%] right-[-5%]" />
        <div className="atmo-orb w-[400px] h-[400px] bg-tertiary/8 bottom-[-10%] left-[-5%]" />
      </div>

      <div className="w-full max-w-xl flex flex-col items-center" style={{ animation: 'fadeUp 0.5s ease-out' }}>
        {/* Brand */}
        <div className="mb-6 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary/15 flex items-center justify-center border border-primary/25">
            <Brain className="text-primary" size={28} />
          </div>
          <h1 className="text-3xl font-bold text-on-surface mb-1">صمّم مدربك</h1>
          <p className="text-sm text-on-surface-variant">اختر اسم الكوتش وشخصيته — سيرافقك طوال رحلتك</p>
        </div>

        <div className="auth-card w-full">
          {/* Coach Name */}
          <div className="mb-6">
            <label className="text-sm font-medium text-on-surface-variant mb-2 block">اسم الكوتش</label>
            <input
              type="text"
              value={coachName}
              onChange={e => setCoachName(e.target.value)}
              placeholder="مثال: سقراط، أبو الحكمة، المرشد..."
              className="auth-input text-right"
              maxLength={30}
            />
            <p className="text-xs text-on-surface-variant mt-1.5 text-right">
              هذا الاسم سيظهر في كل تواصل بينك وبين الكوتش
            </p>
          </div>

          {/* Personality Grid */}
          <div className="mb-6">
            <label className="text-sm font-medium text-on-surface-variant mb-3 block">شخصية الكوتش</label>
            <div className="grid grid-cols-2 gap-3">
              {PERSONALITIES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPersonality(p.id)}
                  className={`rounded-xl border-2 p-4 text-right transition-all relative ${
                    personality === p.id ? p.active : p.color
                  }`}
                >
                  {personality === p.id && (
                    <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <Check size={12} className="text-primary" />
                    </div>
                  )}
                  <div className="text-2xl mb-2">{p.emoji}</div>
                  <p className="font-semibold text-on-surface text-sm mb-1">{p.name}</p>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {canContinue && (
            <div className="mb-5 p-4 rounded-xl bg-primary/5 border border-primary/15 flex items-start gap-3" style={{ animation: 'fadeUp 0.3s ease-out' }}>
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
                <Sparkles size={18} className="text-primary" />
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-primary">{coachName}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {PERSONALITIES.find(p => p.id === personality)?.emoji}{' '}
                  كوتشك {PERSONALITIES.find(p => p.id === personality)?.name} جاهز لمرافقتك
                </p>
              </div>
            </div>
          )}

          {error && <p className="text-error text-sm text-center mb-4">{error}</p>}

          <button
            onClick={handleSave}
            disabled={!canContinue || saving}
            className="btn-primary w-full py-3.5 text-base rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>{saving ? 'جاري الحفظ...' : 'ابدأ رحلتك مع الكوتش'}</span>
            <ArrowLeft size={18} />
          </button>

          <button
            onClick={() => navigate('/upload')}
            className="w-full mt-3 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors text-center"
          >
            تخطّي — سأختار لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
}
