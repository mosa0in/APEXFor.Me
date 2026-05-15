import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { questions as prerequisiteQuestions, Question } from '../data/questions';
import { questionsL1 } from '../data/questions_l1';
import { exportInteractionsCSV, exportSessionSummaryJSON, ResponseRow, SessionSummary } from '../utils/exportExcel';

// Data version — increment to clear stale localStorage
const DATA_VERSION = 3;

// Max rephrase attempts per question
export const MAX_REPHRASE_PER_QUESTION = 3;

// Static fallback questions (only used when no curriculum is active)
const staticFallbackQuestions: Question[] = [...questionsL1, ...prerequisiteQuestions];

/**
 * Load diagnostic questions from the backend API for a specific curriculum.
 * Falls back to static questions if API is unavailable.
 */
async function loadQuestionsFromAPI(slug: string): Promise<Question[]> {
  const API = import.meta.env.VITE_API_URL ?? '';
  try {
    const res = await fetch(`${API}/api/curricula/${slug}/diagnostic-questions`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const apiQuestions: Question[] = (data.questions || []).map((q: any) => ({
      id: q.id,
      text: q.text,
      conceptId: q.conceptId,
      concept: q.concept,
      questionType: q.questionType || 'mcq',
      sectionType: q.sectionType || 'main',
      difficulty: q.difficulty,
      options: q.options,
      correctIndex: q.correctIndex,
      correctAnswer: q.correctAnswer || '',
      // These are optional — API questions don't have them
      rephrasedText: undefined,
      hint: undefined,
      solution: undefined,
      simplerExample: undefined,
      errorExample: undefined,
    }));
    console.log(`[APEX] Loaded ${apiQuestions.length} diagnostic questions from API (${slug})`);
    return apiQuestions;
  } catch (e) {
    console.warn('[APEX] Failed to load questions from API, using static fallback:', e);
    return staticFallbackQuestions;
  }
}

function generateSessionId(studentId: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '_');
  const time = now.toTimeString().slice(0, 5).replace(':', '');
  return `APEX_${studentId}_${date}_${time}`;
}

export interface QuestionResponse {
  sessionId: string;
  questionId: number;
  conceptId: string;
  conceptName: string;
  sectionType: 'prerequisite' | 'main';
  questionType: string;
  selectedAnswer: string;
  selectedIndex: number;
  isCorrect: boolean;
  confidence: number;
  difficulty: number;
  reflection: string;
  timeSpent: number;
  usedHint: boolean;
  usedCoach: boolean;
  coachHelpType: string | null;
  usedRephrase: boolean;
  regenerationReason: string | null;
  restRequested: boolean;
  inputModality: 'mouse' | 'keyboard';
  timestamp: string;
}

interface SessionState {
  dataVersion: number;
  studentId: string;
  sessionId: string;
  isActive: boolean;
  currentQuestionIndex: number;
  responses: QuestionResponse[];
  sessionStartTime: number;
  feedbackLevel: 'easy' | 'medium' | 'hard';
  showRephrasedText: boolean;
  rephrasedAIText: string | null;
  currentUsedHint: boolean;
  currentUsedCoach: boolean;
  currentCoachHelpType: string | null;
  currentUsedRephrase: boolean;
  currentRegenerationReason: string | null;
  currentRestRequested: boolean;
  currentRephraseCount: number;
  currentInputModality: 'mouse' | 'keyboard';
  toastMessage: string | null;
  toastType: 'success' | 'error' | 'info';
  aiCoachResponse: string | null;
  aiLoading: boolean;
}

type SessionAction =
  | { type: 'START_SESSION'; studentId: string }
  | { type: 'SUBMIT_RESPONSE'; response: QuestionResponse }
  | { type: 'NEXT_QUESTION' }
  | { type: 'SET_FEEDBACK_LEVEL'; level: 'easy' | 'medium' | 'hard' }
  | { type: 'MARK_HINT_USED' }
  | { type: 'MARK_COACH_USED'; helpType: string }
  | { type: 'MARK_REPHRASE_USED'; aiText?: string; reason?: string }
  | { type: 'TOGGLE_REPHRASE' }
  | { type: 'MARK_REST_REQUESTED' }
  | { type: 'SET_INPUT_MODALITY'; modality: 'mouse' | 'keyboard' }
  | { type: 'RESET_SESSION' }
  | { type: 'SHOW_TOAST'; message: string; toastType: 'success' | 'error' | 'info' }
  | { type: 'HIDE_TOAST' }
  | { type: 'RESTORE_SESSION'; state: Partial<SessionState> }
  | { type: 'SET_AI_COACH_RESPONSE'; response: string | null }
  | { type: 'SET_AI_LOADING'; loading: boolean }
  | { type: 'SET_REPHRASED_AI_TEXT'; text: string };

const initialState: SessionState = {
  dataVersion: DATA_VERSION,
  studentId: '',
  sessionId: '',
  isActive: false,
  currentQuestionIndex: 0,
  responses: [],
  sessionStartTime: 0,
  feedbackLevel: 'medium',
  showRephrasedText: false,
  rephrasedAIText: null,
  currentUsedHint: false,
  currentUsedCoach: false,
  currentCoachHelpType: null,
  currentUsedRephrase: false,
  currentRegenerationReason: null,
  currentRestRequested: false,
  currentRephraseCount: 0,
  currentInputModality: 'mouse',
  toastMessage: null,
  toastType: 'info',
  aiCoachResponse: null,
  aiLoading: false,
};

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'START_SESSION':
      return { ...initialState, studentId: action.studentId, sessionId: generateSessionId(action.studentId), isActive: true, sessionStartTime: Date.now() };
    case 'SUBMIT_RESPONSE':
      return { ...state, responses: [...state.responses, action.response] };
    case 'NEXT_QUESTION':
      return { ...state, currentQuestionIndex: state.currentQuestionIndex + 1, showRephrasedText: false, rephrasedAIText: null, currentUsedHint: false, currentUsedCoach: false, currentCoachHelpType: null, currentUsedRephrase: false, currentRegenerationReason: null, currentRestRequested: false, currentRephraseCount: 0, currentInputModality: 'mouse', aiCoachResponse: null };
    case 'SET_FEEDBACK_LEVEL':
      return { ...state, feedbackLevel: action.level };
    case 'MARK_HINT_USED':
      return { ...state, currentUsedHint: true };
    case 'MARK_COACH_USED':
      return { ...state, currentUsedCoach: true, currentCoachHelpType: action.helpType };
    case 'MARK_REPHRASE_USED':
      return { ...state, currentUsedRephrase: true, showRephrasedText: true, rephrasedAIText: action.aiText || null, currentRegenerationReason: action.reason || null, currentRephraseCount: state.currentRephraseCount + 1 };
    case 'TOGGLE_REPHRASE':
      return { ...state, showRephrasedText: !state.showRephrasedText };
    case 'MARK_REST_REQUESTED':
      return { ...state, currentRestRequested: true };
    case 'SET_INPUT_MODALITY':
      return { ...state, currentInputModality: action.modality };
    case 'RESET_SESSION': {
      // GAP-08: Archive before clearing
      try {
        const history = JSON.parse(localStorage.getItem('apex_history') || '[]');
        if (state.responses.length > 0) {
          history.push({ sessionId: state.sessionId, studentId: state.studentId, responses: state.responses, completedAt: new Date().toISOString() });
          localStorage.setItem('apex_history', JSON.stringify(history));
        }
      } catch { /* ignore */ }
      localStorage.removeItem('apex_session');
      return { ...initialState };
    }
    case 'SHOW_TOAST':
      return { ...state, toastMessage: action.message, toastType: action.toastType };
    case 'HIDE_TOAST':
      return { ...state, toastMessage: null };
    case 'RESTORE_SESSION':
      return { ...state, ...action.state };
    case 'SET_AI_COACH_RESPONSE':
      return { ...state, aiCoachResponse: action.response, aiLoading: false };
    case 'SET_AI_LOADING':
      return { ...state, aiLoading: action.loading };
    case 'SET_REPHRASED_AI_TEXT':
      return { ...state, rephrasedAIText: action.text, showRephrasedText: true };
    default:
      return state;
  }
}

interface SessionContextValue {
  state: SessionState;
  questions: Question[];
  questionsLoading: boolean;
  totalQuestions: number;
  currentQuestion: Question | null;
  isLastQuestion: boolean;
  isCheckpoint: boolean;
  startSession: (studentId: string) => void;
  submitResponse: (data: { selectedAnswer: string; selectedIndex: number; isCorrect: boolean; confidence: number; difficulty: number; reflection: string }) => void;
  nextQuestion: () => void;
  setFeedbackLevel: (level: 'easy' | 'medium' | 'hard') => void;
  markHintUsed: () => void;
  markCoachUsed: (helpType: string) => void;
  markRephraseUsed: (aiText?: string, reason?: string) => void;
  toggleRephrase: () => void;
  markRestRequested: () => void;
  setInputModality: (modality: 'mouse' | 'keyboard') => void;
  resetSession: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: () => void;
  getSessionSummary: () => SessionSummary;
  exportData: () => void;
  setAICoachResponse: (response: string | null) => void;
  setAILoading: (loading: boolean) => void;
  setRephrasedAIText: (text: string) => void;
  dispatch: React.Dispatch<SessionAction>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  const [questions, setQuestions] = useState<Question[]>(staticFallbackQuestions);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Timer Design (response_time_ms):
   * - STARTS: when question first appears on screen (useEffect on currentQuestionIndex)
   * - CONTINUES: during rephrase, coach, rest, hint (they're part of problem-solving)
   * - ENDS: when student clicks "Submit" (submitResponse reads ref)
   * - Uses useRef to prevent stale closure issues with React state
   */
  const questionStartTimeRef = useRef<number>(Date.now());

  // Reset timer when question changes
  useEffect(() => {
    questionStartTimeRef.current = Date.now();
    console.log(`[APEX Timer] Q${state.currentQuestionIndex + 1} started at ${new Date().toISOString()}`);
  }, [state.currentQuestionIndex, state.isActive]);

  useEffect(() => {
    if (state.isActive) {
      const toSave = { dataVersion: DATA_VERSION, studentId: state.studentId, sessionId: state.sessionId, isActive: state.isActive, currentQuestionIndex: state.currentQuestionIndex, responses: state.responses, sessionStartTime: state.sessionStartTime, feedbackLevel: state.feedbackLevel };
      localStorage.setItem('apex_session', JSON.stringify(toSave));
    }
  }, [state.isActive, state.currentQuestionIndex, state.responses.length]);

  useEffect(() => {
    const saved = localStorage.getItem('apex_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Clear stale data from old versions
        if (!parsed.dataVersion || parsed.dataVersion < DATA_VERSION) {
          console.log('[APEX] Clearing stale session data (old version)');
          localStorage.removeItem('apex_session');
          return;
        }
        if (parsed.isActive) {
          dispatch({ type: 'RESTORE_SESSION', state: parsed });
          questionStartTimeRef.current = Date.now();
          // Also reload questions for the active curriculum
          const slug = localStorage.getItem('apex_active_curriculum') || '';
          if (slug) {
            loadQuestionsFromAPI(slug).then(setQuestions);
          }
        }
      } catch { /* ignore */ }
    }
  }, []);

  // Load questions from API when session starts
  useEffect(() => {
    if (state.isActive && state.studentId) {
      const slug = localStorage.getItem('apex_active_curriculum') || '';
      if (slug) {
        setQuestionsLoading(true);
        loadQuestionsFromAPI(slug).then(qs => {
          setQuestions(qs);
          setQuestionsLoading(false);
        });
      }
    }
  }, [state.isActive, state.studentId]);

  const totalQuestions = questions.length;
  const currentQuestion = state.currentQuestionIndex < totalQuestions ? questions[state.currentQuestionIndex] : null;
  const isLastQuestion = state.currentQuestionIndex >= totalQuestions - 1;
  const isCheckpoint = state.responses.length > 0 && state.responses.length % 5 === 0;

  const startSession = useCallback((studentId: string) => {
    dispatch({ type: 'START_SESSION', studentId });
    questionStartTimeRef.current = Date.now();
  }, []);

  const submitResponse = useCallback((data: { selectedAnswer: string; selectedIndex: number; isCorrect: boolean; confidence: number; difficulty: number; reflection: string }) => {
    // *** FIX: Read from ref, never stale ***
    const timeSpent = Date.now() - questionStartTimeRef.current;
    const q = currentQuestion;
    console.log(`[APEX Timer] Question answered in ${timeSpent}ms (started: ${questionStartTimeRef.current}, now: ${Date.now()})`);
    dispatch({ type: 'SUBMIT_RESPONSE', response: {
      sessionId: state.sessionId,
      questionId: q?.id ?? 0,
      conceptId: q?.conceptId ?? '',
      conceptName: q?.concept ?? '',
      sectionType: q?.sectionType ?? 'prerequisite',
      questionType: 'MCQ',
      ...data,
      timeSpent,
      usedHint: state.currentUsedHint,
      usedCoach: state.currentUsedCoach,
      coachHelpType: state.currentCoachHelpType,
      usedRephrase: state.currentUsedRephrase,
      regenerationReason: state.currentRegenerationReason,
      restRequested: state.currentRestRequested,
      inputModality: state.currentInputModality,
      timestamp: new Date().toISOString(),
    }});
  }, [state.sessionId, state.currentUsedHint, state.currentUsedCoach, state.currentCoachHelpType, state.currentUsedRephrase, state.currentRegenerationReason, state.currentRestRequested, state.currentInputModality, currentQuestion]);

  const nextQuestion = useCallback(() => {
    dispatch({ type: 'NEXT_QUESTION' });
    // Timer reset handled by useEffect above
  }, []);

  const setFeedbackLevel = useCallback((level: 'easy' | 'medium' | 'hard') => dispatch({ type: 'SET_FEEDBACK_LEVEL', level }), []);
  const markHintUsed = useCallback(() => dispatch({ type: 'MARK_HINT_USED' }), []);
  const markCoachUsed = useCallback((helpType: string) => dispatch({ type: 'MARK_COACH_USED', helpType }), []);
  const markRephraseUsed = useCallback((aiText?: string, reason?: string) => dispatch({ type: 'MARK_REPHRASE_USED', aiText, reason }), []);
  const toggleRephrase = useCallback(() => dispatch({ type: 'TOGGLE_REPHRASE' }), []);
  const markRestRequested = useCallback(() => dispatch({ type: 'MARK_REST_REQUESTED' }), []);
  const setInputModality = useCallback((modality: 'mouse' | 'keyboard') => dispatch({ type: 'SET_INPUT_MODALITY', modality }), []);
  const resetSession = useCallback(() => dispatch({ type: 'RESET_SESSION' }), []);
  const setAICoachResponse = useCallback((response: string | null) => dispatch({ type: 'SET_AI_COACH_RESPONSE', response }), []);
  const setAILoading = useCallback((loading: boolean) => dispatch({ type: 'SET_AI_LOADING', loading }), []);
  const setRephrasedAIText = useCallback((text: string) => dispatch({ type: 'SET_REPHRASED_AI_TEXT', text }), []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    dispatch({ type: 'SHOW_TOAST', message, toastType: type });
    toastTimerRef.current = setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), 3500);
  }, []);
  const hideToast = useCallback(() => dispatch({ type: 'HIDE_TOAST' }), []);

  // *** FIX: Compute summary FROM responses, not from separate counters ***
  const getSessionSummary = useCallback((): SessionSummary => {
    const r = state.responses;
    // timeSpent per question is in ms, convert total to seconds
    const totalTime = Math.round(r.reduce((sum, x) => sum + (x.timeSpent || 0), 0) / 1000);
    const correctCount = r.filter(x => x.isCorrect).length;
    const hintCount = r.filter(x => x.usedHint).length;
    const coachCount = r.filter(x => x.usedCoach).length;
    const rephraseCount = r.filter(x => x.usedRephrase).length;
    const restCount = r.filter(x => x.restRequested).length;
    return {
      sessionId: state.sessionId,
      studentId: state.studentId,
      totalTime,
      totalQuestions: r.length,
      correctCount,
      accuracy: r.length > 0 ? Math.round((correctCount / r.length) * 100) : 0,
      avgConfidence: r.length > 0 ? parseFloat((r.reduce((a, b) => a + b.confidence, 0) / r.length).toFixed(2)) : 0,
      avgDifficulty: r.length > 0 ? parseFloat((r.reduce((a, b) => a + b.difficulty, 0) / r.length).toFixed(2)) : 0,
      hintCount,
      coachCount,
      rephraseCount,
      restCount,
    };
  }, [state]);

  const exportData = useCallback(() => {
    if (state.responses.length === 0) {
      showToast('لا توجد بيانات للتصدير', 'error');
      return;
    }
    try {
      const summary = getSessionSummary();
      const rows: ResponseRow[] = state.responses.map(r => ({
        sessionId: r.sessionId,
        studentId: state.studentId,
        questionId: r.questionId,
        conceptId: r.conceptId,
        conceptName: r.conceptName,
        sectionType: r.sectionType,
        questionType: r.questionType,
        difficultyLevel: r.difficulty,
        selectedAnswer: r.selectedAnswer,
        isCorrect: r.isCorrect,
        confidence: r.confidence,
        reflection: r.reflection,
        timeSpent: r.timeSpent,
        usedHint: r.usedHint,
        usedCoach: r.usedCoach,
        coachHelpType: r.coachHelpType ?? '',
        usedRephrase: r.usedRephrase,
        regenerationReason: r.regenerationReason ?? '',
        restRequested: r.restRequested,
        inputModality: r.inputModality,
        timestamp: r.timestamp,
      }));

      exportInteractionsCSV(rows, state.studentId);
      exportSessionSummaryJSON(summary, state.studentId);
      showToast('✅ تم تصدير ملفين: interactions.csv + session_summary.json', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('حدث خطأ أثناء التصدير', 'error');
    }
  }, [state.responses, state.studentId, getSessionSummary, showToast]);

  return (
    <SessionContext.Provider value={{ state, questions, questionsLoading, totalQuestions, currentQuestion, isLastQuestion, isCheckpoint, startSession, submitResponse, nextQuestion, setFeedbackLevel, markHintUsed, markCoachUsed, markRephraseUsed, toggleRephrase, markRestRequested, setInputModality, resetSession, showToast, hideToast, getSessionSummary, exportData, setAICoachResponse, setAILoading, setRephrasedAIText, dispatch }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
