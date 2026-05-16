import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useCurriculum } from '../context/CurriculumContext';

interface Toast {
  id: string;
  type: 'success' | 'error';
  name: string;
  message: string;
}

const PROCESSING_STATUSES = new Set([
  'processing', 'extracting_pdf', 'analyzing_pdf', 'enriching', 'storing',
]);

function statusLabel(status: string): string {
  if (status.startsWith('enriching')) {
    const m = status.match(/\((\d+)\/(\d+)\)/);
    return m ? `إثراء بالـ AI — ${m[1]}/${m[2]}` : 'إثراء بالـ AI...';
  }
  const MAP: Record<string, string> = {
    processing:     'جاري المعالجة...',
    extracting_pdf: 'قراءة الـ PDF...',
    analyzing_pdf:  'تحليل الهيكل...',
    storing:        'حفظ البيانات...',
  };
  return MAP[status] ?? 'معالجة...';
}

export default function ProcessingBanner() {
  const { curricula } = useCurriculum();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const prevStatuses = useRef<Record<string, string>>({});

  // Detect status transitions → produce toasts
  useEffect(() => {
    const prev = prevStatuses.current;
    const next: Record<string, string> = {};

    curricula.forEach(c => {
      const s = c.status as string;
      next[c.slug] = s;
      const prevS = prev[c.slug];
      if (!prevS || prevS === s) return;

      if (s === 'ready') {
        const t: Toast = { id: c.slug, type: 'success', name: c.name, message: 'جاهزة للدراسة!' };
        setToasts(ts => [...ts.filter(x => x.id !== c.slug), t]);
        setTimeout(() => setToasts(ts => ts.filter(x => x.id !== c.slug)), 6000);
      } else if (s === 'error') {
        const t: Toast = {
          id: c.slug, type: 'error', name: c.name,
          message: (c.error_message || 'فشل التحليل').substring(0, 100),
        };
        setToasts(ts => [...ts.filter(x => x.id !== c.slug), t]);
      }
    });

    prevStatuses.current = next;
  }, [curricula]);

  const processing = curricula.filter(c =>
    PROCESSING_STATUSES.has(c.status) || (c.status as string).startsWith('enriching')
  );

  const dismiss = (id: string) => setToasts(ts => ts.filter(x => x.id !== id));

  if (processing.length === 0 && toasts.length === 0) return null;

  return (
    <div
      className="fixed top-14 inset-x-0 z-50 flex flex-col gap-1.5 px-3 pt-2 pointer-events-none"
      dir="rtl"
    >
      <div className="max-w-xl mx-auto w-full flex flex-col gap-1.5">

        {/* ── In-progress pills ── */}
        {processing.map(c => (
          <div
            key={c.slug}
            className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm shadow-lg border border-primary/25 backdrop-blur-md"
            style={{ background: 'rgba(17,13,28,0.93)' }}
          >
            <Loader2 size={14} className="text-primary animate-spin shrink-0" />
            <span className="font-medium text-on-surface truncate">{c.name}</span>
            <span className="text-xs text-on-surface-variant mr-auto shrink-0">
              {statusLabel(c.status as string)}
            </span>
          </div>
        ))}

        {/* ── Toast notifications (success / error) ── */}
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm shadow-lg backdrop-blur-md border ${
              t.type === 'success'
                ? 'border-tertiary/30 bg-tertiary/10'
                : 'border-error/30 bg-error/10'
            }`}
            style={{ animation: 'fadeUp 0.25s ease-out' }}
          >
            {t.type === 'success'
              ? <CheckCircle2 size={14} className="text-tertiary shrink-0" />
              : <AlertCircle   size={14} className="text-error shrink-0" />}
            <span className={`font-medium truncate ${t.type === 'success' ? 'text-tertiary' : 'text-error'}`}>
              {t.name}
            </span>
            <span className="text-xs text-on-surface-variant truncate flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
            >
              <X size={13} />
            </button>
          </div>
        ))}

      </div>
    </div>
  );
}
