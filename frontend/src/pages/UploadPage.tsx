import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudUpload, FileText, Sparkles, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useCurriculum } from '../context/CurriculumContext';
import AppShell from '../components/AppShell';

const API = import.meta.env.VITE_API_URL ?? '';

export default function UploadPage() {
  const navigate = useNavigate();
  const { refreshCurricula } = useCurriculum();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [enrichProgress, setEnrichProgress] = useState('');

  const steps = [
    { num: 1, title: 'رفع الملف', desc: 'إرسال الملف إلى الخادم.' },
    { num: 2, title: 'تحليل PDF', desc: 'استخراج الهيكل بدون ذكاء اصطناعي.' },
    { num: 3, title: 'إثراء بالـ AI', desc: 'وصف المفاهيم والمتطلبات السابقة.' },
    { num: 4, title: 'حفظ البيانات', desc: 'تخزين كل شيء في قاعدة البيانات.' },
    { num: 5, title: 'جاهز!', desc: 'المادة أصبحت متاحة للاختبار التشخيصي.' },
  ];

  const resolveStep = (status: string): number => {
    if (status === 'processing') return 1;
    if (status === 'extracting_pdf' || status === 'analyzing_pdf') return 2;
    if (status.startsWith('enriching')) return 3;
    if (status === 'storing') return 4;
    if (status === 'ready') return 5;
    return 1;
  };

  const pollStatus = async (slug: string) => {
    try {
      const res = await fetch(`${API}/api/curricula`);
      if (!res.ok) return;
      const data = await res.json();
      const item = data.find((c: any) => c.slug === slug);
      if (!item) return;

      setStep(resolveStep(item.status));

      // Show chunk progress when enriching
      if (item.status.startsWith('enriching (')) {
        setEnrichProgress(item.status.replace('enriching ', ''));
      } else {
        setEnrichProgress('');
      }

      if (item.status === 'ready') {
        await refreshCurricula();
        // Save active curriculum for diagnostic test
        localStorage.setItem('apex_active_curriculum', slug);
        setTimeout(() => navigate('/diagnostic'), 800);
      } else if (item.status === 'error') {
        setError(item.error_message || 'حدث خطأ أثناء التحليل');
        setUploading(false);
      } else {
        setTimeout(() => pollStatus(slug), 2000);
      }
    } catch {
      setTimeout(() => pollStatus(slug), 3000);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setStep(1);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name.trim() || file.name.replace('.pdf', ''));
      formData.append('student_id', localStorage.getItem('apex_current_student') || '');

      const res = await fetch(`${API}/api/curricula/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setTimeout(() => pollStatus(data.slug), 2000);
    } catch (e: any) {
      setError(e.message || 'فشل الاتصال بالخادم');
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') setFile(f);
  };

  return (
    <AppShell>
      <div className="page-transition">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-on-surface mb-2">ارفع كتابك الدراسي</h1>
          <p className="text-on-surface-variant max-w-lg mx-auto">حوّل مناهجك الدراسية إلى خريطة تفاعلية مدعومة بالذكاء الاصطناعي.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Steps Panel */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 justify-end mb-6">
              <h2 className="text-lg font-semibold text-on-surface">خطوات التحليل الذكي</h2>
              <Sparkles size={20} className="text-primary" />
            </div>
            <div className="space-y-5">
              {steps.map(s => (
                <div key={s.num} className="flex items-start gap-3 justify-end">
                  <div className="text-right">
                    <p className={`font-medium text-sm ${step >= s.num ? 'text-primary' : 'text-on-surface'}`}>{s.title}</p>
                    <p className="text-xs text-on-surface-variant">{s.desc}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    step > s.num ? 'bg-tertiary/15 text-tertiary border border-tertiary/20' :
                    step === s.num ? 'bg-primary text-on-primary animate-pulse' :
                    'bg-surface-container-high text-on-surface-variant border border-outline-variant/30'
                  }`}>
                    {step > s.num ? <CheckCircle2 size={16} /> : step === s.num ? <Loader2 size={16} className="animate-spin" /> : s.num}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-3 rounded-lg bg-surface-container/40 flex items-center gap-2 justify-end">
              {enrichProgress ? (
                <span className="text-xs text-primary font-medium">إثراء الـ AI: {enrichProgress}</span>
              ) : (
                <span className="text-xs text-on-surface-variant">التحليل يستغرق 2-5 دقائق حسب حجم الكتاب.</span>
              )}
              <Sparkles size={14} className="text-primary" />
            </div>
          </div>

          {/* Upload Zone */}
          <div className="flex flex-col gap-4">
            {/* Name Input */}
            <div className="glass-card rounded-2xl p-4">
              <label className="text-sm text-on-surface-variant mb-2 block text-right">اسم المادة (اختياري)</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="مثال: حساب التفاضل — الفصل الأول"
                className="auth-input text-right text-sm"
                dir="rtl"
              />
            </div>

            {/* Drop Zone */}
            <div
              className={`upload-dropzone flex-1 ${file ? 'upload-dropzone-active' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />

              {file ? (
                <>
                  <FileText size={48} className="text-tertiary mb-4" />
                  <p className="text-lg font-medium text-on-surface mb-1">{file.name}</p>
                  <p className="text-sm text-on-surface-variant mb-2">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </>
              ) : (
                <>
                  <CloudUpload size={48} className="text-primary mb-4" />
                  <p className="text-lg font-medium text-on-surface mb-1">اسحب وأفلت ملف الـ PDF هنا</p>
                  <p className="text-sm text-on-surface-variant mb-4">أو انقر لاختيار ملف من جهازك</p>
                  <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                    <span>✓ الحد الأقصى 50 ميجابايت</span>
                    <span>📄 يدعم ملفات PDF فقط</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 rounded-xl flex items-center gap-3 justify-end bg-error/10 border border-error/20">
            <span className="text-sm text-error">{error}</span>
            <AlertCircle size={18} className="text-error" />
          </div>
        )}

        {/* Upload Button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn-primary w-full max-w-[500px] py-3.5 text-lg rounded-xl"
          >
            {uploading ? 'جاري التحليل...' : 'ارفع الكتاب وابدأ التحليل'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
