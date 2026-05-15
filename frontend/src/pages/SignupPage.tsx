import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Sparkles, ArrowLeft, Eye, EyeOff, Hash } from 'lucide-react';

const API = import.meta.env.VITE_API_URL ?? '';

export default function SignupPage() {
  const [form, setForm] = useState({ student_id: '', full_name: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [idLoading, setIdLoading] = useState(true);
  const navigate = useNavigate();

  // Auto-fetch next student ID on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/auth/next-id`);
        if (res.ok) {
          const data = await res.json();
          setForm(prev => ({ ...prev, student_id: data.next_id }));
        }
      } catch { /* offline fallback */ }
      setIdLoading(false);
    })();
  }, []);

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSignup = async () => {
    setError('');
    if (!form.student_id.trim() || form.student_id.length < 2) {
      setError('رقم الطالب يجب أن يكون حرفين على الأقل'); return;
    }
    if (!form.password || form.password.length < 4) {
      setError('كلمة المرور يجب أن تكون 4 أحرف على الأقل'); return;
    }
    if (form.password !== form.confirm) {
      setError('كلمتا المرور غير متطابقتين'); return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: form.student_id.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'فشل إنشاء الحساب');

      // Auto-login after signup
      localStorage.setItem('apex_current_student', data.student_id);
      localStorage.setItem(`apex_student_${data.student_id}`, JSON.stringify({
        student_id: data.student_id,
        full_name: data.full_name,
        diagnostic_done: false,
      }));
      await new Promise(r => setTimeout(r, 300));
      navigate('/coach-setup');
    } catch (e: any) {
      setError(e.message || 'فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell flex items-center justify-center p-5" dir="rtl">
      {/* Atmospheric */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="atmo-orb w-[600px] h-[600px] bg-primary/10 top-[-15%] right-[-10%]" />
        <div className="atmo-orb w-[500px] h-[500px] bg-secondary/8 bottom-[-15%] left-[-10%]" />
      </div>

      <div className="w-full max-w-lg flex flex-col items-center" style={{ animation: 'fadeUp 0.6s ease-out' }}>
        {/* Brand */}
        <div className="mb-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/15 flex items-center justify-center border border-primary/25">
            <Sparkles className="text-primary" size={28} />
          </div>
          <h1 className="text-4xl font-bold text-primary mb-1">APEX</h1>
          <p className="text-sm text-on-surface-variant">Adaptive Pedagogical Explorer</p>
        </div>

        {/* Auth Card */}
        <div className="auth-card flex flex-col items-center">
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-tertiary/10 rounded-full blur-[80px]" />

          <div className="w-14 h-14 rounded-full bg-tertiary/15 flex items-center justify-center mb-4 border border-tertiary/25">
            <UserPlus className="text-tertiary" size={26} />
          </div>

          <h2 className="text-2xl font-bold text-on-surface mb-2 text-center">إنشاء حساب جديد</h2>
          <p className="text-sm text-on-surface-variant text-center mb-6 max-w-sm leading-relaxed">
            سجّل حسابك لبدء رحلة التعلم التكيّفي المخصصة لك.
          </p>

          <div className="w-full space-y-3.5">
            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant px-1" htmlFor="signup-name">الاسم الكامل</label>
              <input id="signup-name" type="text" value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
                placeholder="أدخل اسمك الكامل..."
                className="auth-input"
              />
            </div>

            {/* Student ID — Auto-generated */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant px-1" htmlFor="signup-id">
                رقم الطالب <span className="text-xs text-tertiary">(تلقائي)</span>
              </label>
              <div className="relative">
                <input id="signup-id" type="text" value={idLoading ? '...' : form.student_id}
                  readOnly
                  className="auth-input bg-surface-container/80 text-primary font-mono cursor-default pr-4 pl-12"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Hash size={16} className="text-tertiary" />
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant px-1" htmlFor="signup-pw">كلمة المرور</label>
              <div className="relative">
                <input id="signup-pw" type={showPw ? 'text' : 'password'} value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="أدخل كلمة المرور..."
                  className="auth-input pr-4 pl-12"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant px-1" htmlFor="signup-confirm">تأكيد كلمة المرور</label>
              <input id="signup-confirm" type="password" value={form.confirm}
                onChange={e => set('confirm', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSignup()}
                placeholder="أعد إدخال كلمة المرور..."
                className="auth-input"
              />
            </div>

            {error && <p className="text-error text-sm text-center" role="alert">{error}</p>}

            {/* Button */}
            <button onClick={handleSignup} disabled={loading}
              className="btn-primary w-full py-3.5 text-base rounded-xl mt-1"
            >
              <span>{loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}</span>
              <ArrowLeft size={18} />
            </button>
          </div>

          {/* Login Link */}
          <div className="mt-5 flex items-center gap-2">
            <Link to="/" className="text-sm text-primary hover:underline underline-offset-4">تسجيل الدخول</Link>
            <span className="text-sm text-on-surface-variant">لديك حساب بالفعل؟</span>
          </div>
        </div>
      </div>
    </div>
  );
}
