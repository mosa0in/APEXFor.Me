import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Fingerprint, Sparkles, ArrowLeft, Eye, EyeOff, Zap } from 'lucide-react';

const API = import.meta.env.VITE_API_URL ?? '';

export default function LoginPage() {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!studentId.trim()) { setError('الرجاء إدخال رقم الطالب'); return; }
    if (!password) { setError('الرجاء إدخال كلمة المرور'); return; }
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'فشل تسجيل الدخول');

      // Save session
      localStorage.setItem('apex_current_student', data.student_id);
      localStorage.setItem(`apex_student_${data.student_id}`, JSON.stringify({
        student_id: data.student_id,
        full_name: data.full_name,
        diagnostic_done: data.diagnostic_done,
        coach_name: data.coach_name,
        stars_total: data.stars_total,
      }));

      await new Promise(r => setTimeout(r, 300));
      navigate('/roadmap');
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
        <div className="mb-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/15 flex items-center justify-center border border-primary/25">
            <Sparkles className="text-primary" size={28} />
          </div>
          <h1 className="text-4xl font-bold text-primary mb-1">APEX</h1>
          <p className="text-sm text-on-surface-variant">Adaptive Pedagogical Explorer</p>
        </div>

        {/* Auth Card */}
        <div className="auth-card flex flex-col items-center">
          {/* Glow blob */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/15 rounded-full blur-[80px]" />

          <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mb-5 border border-primary/25">
            <Fingerprint className="text-primary" size={28} />
          </div>

          <h2 className="text-2xl font-bold text-on-surface mb-2 text-center">أهلاً بك أيها المستكشف</h2>
          <p className="text-sm text-on-surface-variant text-center mb-7 max-w-sm leading-relaxed">
            هذا الاختبار لا يقيس علامتك، بل يساعد النظام على معرفة نقطة البداية المناسبة لك.
          </p>

          <div className="w-full space-y-4">
            {/* Student ID */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant px-1" htmlFor="login-student-id">
                رقم الطالب (Student ID)
              </label>
              <input
                id="login-student-id"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="أدخل رقمك التعريفي هنا..."
                className="auth-input"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-on-surface-variant px-1" htmlFor="login-password">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="أدخل كلمة المرور..."
                  className="auth-input pr-4 pl-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <p className="text-error text-sm text-center" role="alert">{error}</p>}

            {/* Button */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="btn-primary w-full py-3.5 text-lg rounded-xl mt-2"
            >
              <span>{loading ? 'جاري التحميل...' : 'تسجيل الدخول'}</span>
              <ArrowLeft size={20} />
            </button>
          </div>

          {/* Signup Link */}
          <div className="mt-6 flex items-center gap-2">
            <Link to="/signup" className="text-sm text-primary hover:underline underline-offset-4">إنشاء حساب جديد</Link>
            <span className="text-sm text-on-surface-variant">ليس لديك حساب؟</span>
          </div>

          {/* AI Chip */}
          <div className="mt-5 flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container/50 border border-primary/10">
            <Zap size={14} className="text-secondary" fill="currentColor" />
            <span className="text-xs text-secondary">الذكاء الاصطناعي جاهز لتحليل مهاراتك</span>
          </div>
        </div>
      </div>
    </div>
  );
}
