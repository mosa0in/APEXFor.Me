import React, { useState, useEffect } from 'react';
import type { Question, QuestionOption, QuestionType } from '../data/questions';
import { CheckCircle, XCircle } from './icons';

// ═══════════════════════════════════════════════════════
// Unified answer payload — all renderers emit this
// ═══════════════════════════════════════════════════════

export interface AnswerPayload {
  /** Which type of question was answered */
  questionType: QuestionType;
  /** The text of the selected answer (for any type) */
  selectedAnswer: string;
  /** Selected option index (MCQ/true-false only, -1 for text) */
  selectedIndex: number;
  /** Whether the answer is correct */
  isCorrect: boolean;
  /** Free-form text answer (text_input only) */
  textAnswer?: string;
}

// ═══════════════════════════════════════════════════════
// Props shared by all renderers
// ═══════════════════════════════════════════════════════

interface QuestionRendererProps {
  question: Question;
  onAnswer: (payload: AnswerPayload) => void;
  disabled: boolean;
  resultRevealed: boolean;
  selectedIndex: number | null;
  inputModality?: 'mouse' | 'keyboard';
  onSelectOption?: (idx: number) => void;
}

// ═══════════════════════════════════════════════════════
// Main Renderer — switches by question type
// ═══════════════════════════════════════════════════════

export default function QuestionRenderer(props: QuestionRendererProps) {
  const qType = props.question.questionType || 'mcq';

  switch (qType) {
    case 'true_false':
      return <TrueFalseInput {...props} />;
    case 'text_input':
      return <TextAnswerInput {...props} />;
    case 'mcq':
    default:
      return <MCQInput {...props} />;
  }
}

// ═══════════════════════════════════════════════════════
// MCQ — Grid of option buttons (existing design)
// ═══════════════════════════════════════════════════════

function MCQInput({ question, disabled, resultRevealed, selectedIndex, onSelectOption }: QuestionRendererProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="radiogroup" aria-label="خيارات الإجابة">
      {question.options.map((opt, idx) => (
        <OptionBtn
          key={idx}
          label={opt.label}
          content={opt.content}
          shortcut={idx + 1}
          selected={selectedIndex === idx}
          disabled={disabled}
          isCorrectAnswer={resultRevealed && idx === question.correctIndex}
          isWrongAnswer={resultRevealed && selectedIndex === idx && idx !== question.correctIndex}
          onClick={() => onSelectOption?.(idx)}
        />
      ))}
    </div>
  );
}

function OptionBtn({ label, content, shortcut, onClick, selected = false, disabled = false, isCorrectAnswer = false, isWrongAnswer = false }: {
  label: string; content: string; shortcut: number; onClick: () => void;
  selected?: boolean; disabled?: boolean; isCorrectAnswer?: boolean; isWrongAnswer?: boolean;
}) {
  let cls = 'flex items-center gap-3 p-3.5 rounded-xl border transition-all text-right ';
  if (isCorrectAnswer) cls += 'answer-correct';
  else if (isWrongAnswer) cls += 'answer-wrong';
  else if (selected) cls += 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(111,209,215,0.15)]';
  else cls += 'border-primary/20 bg-surface-bright/30 hover:bg-surface-bright/60 hover:border-primary/50 group';

  let badge = 'w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base transition-colors ';
  if (isCorrectAnswer) badge += 'bg-tertiary text-on-tertiary';
  else if (isWrongAnswer) badge += 'bg-error text-on-error';
  else if (selected) badge += 'bg-primary text-on-primary';
  else badge += 'bg-surface-container text-primary group-hover:bg-primary group-hover:text-on-primary';

  return (
    <button onClick={onClick} disabled={disabled} className={cls} role="radio" aria-checked={selected}>
      <div className={badge}>{label}</div>
      <span className="text-base font-mono flex-1" dir="ltr">{content}</span>
      <span className="text-xs text-on-surface-variant/30 font-mono">{shortcut}</span>
      {isCorrectAnswer && <CheckCircle className="w-4 h-4 text-tertiary" />}
      {isWrongAnswer && <XCircle className="w-4 h-4 text-error" />}
    </button>
  );
}

// ═══════════════════════════════════════════════════════
// True / False — Two large toggle buttons
// ═══════════════════════════════════════════════════════

function TrueFalseInput({ question, disabled, resultRevealed, selectedIndex, onSelectOption }: QuestionRendererProps) {
  const trueIdx = 0;
  const falseIdx = 1;

  const btnBase = 'flex-1 flex flex-col items-center justify-center gap-3 py-8 rounded-2xl border-2 transition-all cursor-pointer font-bold text-xl';

  const getClass = (idx: number) => {
    const isSelected = selectedIndex === idx;
    const isCorrect = resultRevealed && idx === question.correctIndex;
    const isWrong = resultRevealed && isSelected && idx !== question.correctIndex;

    if (isCorrect) return `${btnBase} border-tertiary bg-tertiary/15 text-tertiary shadow-[0_0_20px_rgba(90,246,214,0.2)]`;
    if (isWrong) return `${btnBase} border-error bg-error/15 text-error`;
    if (isSelected) return `${btnBase} border-primary bg-primary/15 text-primary shadow-[0_0_20px_rgba(111,209,215,0.15)]`;
    return `${btnBase} border-primary/20 bg-surface-bright/30 text-on-surface hover:bg-surface-bright/60 hover:border-primary/50`;
  };

  return (
    <div className="flex gap-4" role="radiogroup" aria-label="صح أو خطأ">
      <button onClick={() => onSelectOption?.(trueIdx)} disabled={disabled} className={getClass(trueIdx)} role="radio" aria-checked={selectedIndex === trueIdx}>
        <span className="text-4xl">✓</span>
        <span>صح</span>
        {resultRevealed && trueIdx === question.correctIndex && <CheckCircle className="w-5 h-5" />}
        {resultRevealed && selectedIndex === trueIdx && trueIdx !== question.correctIndex && <XCircle className="w-5 h-5" />}
      </button>
      <button onClick={() => onSelectOption?.(falseIdx)} disabled={disabled} className={getClass(falseIdx)} role="radio" aria-checked={selectedIndex === falseIdx}>
        <span className="text-4xl">✗</span>
        <span>خطأ</span>
        {resultRevealed && falseIdx === question.correctIndex && <CheckCircle className="w-5 h-5" />}
        {resultRevealed && selectedIndex === falseIdx && falseIdx !== question.correctIndex && <XCircle className="w-5 h-5" />}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Text Input — Textarea with reference answer reveal
// ═══════════════════════════════════════════════════════

function TextAnswerInput({ question, disabled, resultRevealed, onAnswer }: QuestionRendererProps) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Reset when question changes
  useEffect(() => {
    setText('');
    setSubmitted(false);
  }, [question.id]);

  const handleSubmitText = () => {
    if (!text.trim() || submitted) return;
    setSubmitted(true);

    // Simple scoring: check if answer contains key parts of correct answer
    const correct = question.correctAnswer || '';
    let isCorrect = false;
    if (correct) {
      const normalizedText = text.trim().toLowerCase().replace(/\s+/g, ' ');
      const normalizedCorrect = correct.trim().toLowerCase().replace(/\s+/g, ' ');
      // Exact or partial match
      isCorrect = normalizedText === normalizedCorrect || normalizedText.includes(normalizedCorrect) || normalizedCorrect.includes(normalizedText);
    }

    onAnswer({
      questionType: 'text_input',
      selectedAnswer: text.trim(),
      selectedIndex: -1,
      isCorrect,
      textAnswer: text.trim(),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled || submitted}
          placeholder="اكتب إجابتك هنا..."
          className={`w-full min-h-[140px] bg-surface-container/50 border rounded-2xl p-5 text-on-surface resize-none placeholder:text-on-surface-variant/50 text-base leading-relaxed transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 ${
            submitted ? 'opacity-70 border-primary/30' : 'border-primary/20 hover:border-primary/50'
          }`}
          dir="rtl"
        />
        {/* Word count */}
        <div className="absolute bottom-3 left-3 text-xs text-on-surface-variant/40 font-mono">
          {text.trim().split(/\s+/).filter(Boolean).length} كلمة
        </div>
      </div>

      {!submitted && !disabled && (
        <button
          onClick={handleSubmitText}
          disabled={!text.trim()}
          className="btn-primary py-3 rounded-xl text-base self-center px-12 disabled:opacity-40"
        >
          تأكيد الإجابة
        </button>
      )}

      {/* Show reference answer after result is revealed */}
      {resultRevealed && question.correctAnswer && (
        <div className="glass-card rounded-2xl p-5 border-tertiary/30 bg-tertiary/5" style={{ animation: 'page-enter 0.4s ease-out' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-tertiary" />
            <span className="text-sm font-bold text-tertiary">الإجابة النموذجية</span>
          </div>
          <p className="text-on-surface-variant leading-relaxed">{question.correctAnswer}</p>
        </div>
      )}
    </div>
  );
}
