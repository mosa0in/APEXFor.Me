export interface ResponseRow {
  sessionId: string;
  studentId: string;
  questionId: number;
  conceptId: string;
  conceptName: string;
  sectionType: string;
  questionType: string;
  difficultyLevel: number;
  selectedAnswer: string;
  isCorrect: boolean;
  confidence: number;
  reflection: string;
  timeSpent: number;
  usedHint: boolean;
  usedCoach: boolean;
  coachHelpType: string;
  usedRephrase: boolean;
  regenerationReason: string;
  restRequested: boolean;
  inputModality: string;
  timestamp: string;
}

export interface SessionSummary {
  sessionId: string;
  studentId: string;
  totalTime: number;
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  avgConfidence: number;
  avgDifficulty: number;
  hintCount: number;
  coachCount: number;
  rephraseCount: number;
  restCount: number;
}

function escapeCSV(val: string): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadFile(content: string, fileName: string, mimeType: string): void {
  try {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });

    if ((navigator as any).msSaveBlob) {
      (navigator as any).msSaveBlob(blob, fileName);
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);

    setTimeout(() => {
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 250);
    }, 0);
  } catch (error) {
    console.error('Download failed:', error);
    const encodedUri = `data:${mimeType};charset=utf-8,` + encodeURIComponent(content);
    const w = window.open(encodedUri, '_blank');
    if (!w) {
      alert('تعذر تصدير الملف. يرجى السماح بالنوافذ المنبثقة في المتصفح.');
    }
  }
}

/**
 * Export ONLY interactions data — no summary mixed in.
 * Clean for pandas / SQL / pyKT / DKT pipelines.
 *
 * Timer behavior:
 *   - Starts when question appears on screen
 *   - CONTINUES during rephrase, coach, rest, hint (they're part of problem-solving)
 *   - Ends when student clicks "Submit"
 *   - response_time_ms includes ALL time spent on the question
 */
export function exportInteractionsCSV(responses: ResponseRow[], studentId: string): void {
  const headers = [
    'interaction_order',
    'session_id', 'student_id', 'question_id',
    'concept_id', 'concept_name', 'section_type', 'question_type',
    'difficulty_level', 'student_answer', 'correct', 'confidence_level',
    'student_explanation', 'response_time_ms',
    'question_regenerated', 'regeneration_reason',
    'rest_requested', 'coach_called', 'coach_help_type',
    'hint_used', 'input_modality', 'timestamp'
  ];

  const rows = responses.map((r, i) => [
    (i + 1).toString(),
    escapeCSV(r.sessionId),
    escapeCSV(r.studentId),
    r.questionId.toString(),
    escapeCSV(r.conceptId),
    escapeCSV(r.conceptName),
    escapeCSV(r.sectionType),
    escapeCSV(r.questionType),
    r.difficultyLevel.toString(),
    escapeCSV(r.selectedAnswer),
    r.isCorrect ? '1' : '0',
    r.confidence.toString(),
    escapeCSV(r.reflection),          // empty string if empty, NOT "-"
    r.timeSpent.toString(),
    r.usedRephrase ? '1' : '0',
    escapeCSV(r.regenerationReason),   // empty string if none, NOT "-"
    r.restRequested ? '1' : '0',
    r.usedCoach ? '1' : '0',
    escapeCSV(r.coachHelpType),        // empty string if none, NOT "-"
    r.usedHint ? '1' : '0',
    escapeCSV(r.inputModality),
    escapeCSV(r.timestamp),
  ].join(','));

  // BOM for Arabic support in Excel
  const BOM = '\uFEFF';
  const csvContent = BOM + [headers.join(','), ...rows].join('\r\n');
  const date = new Date().toISOString().slice(0, 10);
  downloadFile(csvContent, `APEX_interactions_${studentId}_${date}.csv`, 'text/csv');
}

/**
 * Export session summary as a separate JSON file.
 * Never mixed with interaction rows.
 */
export function exportSessionSummaryJSON(summary: SessionSummary, studentId: string): void {
  const jsonContent = JSON.stringify({
    session_id: summary.sessionId,
    student_id: summary.studentId,
    total_time_sec: summary.totalTime,
    total_questions: summary.totalQuestions,
    correct_count: summary.correctCount,
    accuracy_percent: summary.accuracy,
    avg_confidence: parseFloat(summary.avgConfidence.toFixed(2)),
    avg_difficulty: parseFloat(summary.avgDifficulty.toFixed(2)),
    hint_count: summary.hintCount,
    coach_count: summary.coachCount,
    rephrase_count: summary.rephraseCount,
    rest_count: summary.restCount,
    exported_at: new Date().toISOString(),
  }, null, 2);

  const date = new Date().toISOString().slice(0, 10);
  // Small delay so browser doesn't block second download
  setTimeout(() => {
    downloadFile(jsonContent, `APEX_session_summary_${studentId}_${date}.json`, 'application/json');
  }, 500);
}
