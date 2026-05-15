import { useEffect, useState } from 'react';
import { Brain, X, Loader2, MessageCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL ?? '';

interface Props {
  conceptName: string;
  gapType: 'conceptual' | 'procedural' | 'none';
  explanation: string;
  onClose: () => void;
}

export default function SessionCoachModal({ conceptName, gapType, explanation, onClose }: Props) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [studentReply, setStudentReply] = useState('');

  useEffect(() => {
    fetchSocratic();
  }, []);

  async function fetchSocratic() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/coach/socratic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept_name: conceptName,
          gap_type: gapType,
          student_explanation: explanation,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuestion(data.socratic_question || '');
      }
    } catch {
      setQuestion(`كيف تصف مفهوم "${conceptName}" بكلماتك الخاصة؟`);
    }
    setLoading(false);
  }

  const gapLabel = gapType === 'conceptual' ? 'فجوة مفاهيمية' : 'فجوة إجرائية';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="glass-card rounded-2xl p-6 max-w-md w-full" style={{ animation: 'fadeUp 0.3s ease-out' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <X size={20} />
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-on-surface">المدرب السقراطي</h2>
            <Brain size={18} className="text-primary" />
          </div>
        </div>

        {/* Concept + gap badge */}
        <div className="flex items-center gap-2 justify-end mb-4">
          <span className="text-xs px-2 py-0.5 rounded-full bg-error/15 text-error">{gapLabel}</span>
          <span className="text-sm text-on-surface font-medium">{conceptName}</span>
        </div>

        {/* Socratic question */}
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 mb-4 min-h-[80px] flex items-start gap-3">
          <MessageCircle size={16} className="text-primary mt-0.5 shrink-0" />
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Loader2 size={14} className="animate-spin" />
              <span>المدرب يفكر...</span>
            </div>
          ) : (
            <p className="text-sm text-on-surface text-right leading-relaxed" dir="rtl">{question}</p>
          )}
        </div>

        {/* Student reply */}
        <textarea
          value={studentReply}
          onChange={e => setStudentReply(e.target.value)}
          placeholder="اكتب إجابتك هنا..."
          className="w-full h-20 bg-surface-container-low border border-outline-variant/20 rounded-xl p-3 text-sm text-on-surface text-right resize-none focus:outline-none focus:border-primary/40 mb-4"
          dir="rtl"
        />

        <button onClick={onClose} className="btn-primary w-full py-2.5 rounded-xl text-sm">
          <span>شكراً، فهمت الآن</span>
        </button>
      </div>
    </div>
  );
}
