/**
 * APEX Backend Bridge
 * Connects React frontend to the curriculum-parser Python backend
 * 
 * Multi-curriculum support: fetches data by active curriculum slug from API.
 * Falls back to static files if API is unavailable.
 */

const API = import.meta.env.VITE_API_URL ?? '';

export function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('apex_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ═══════════════════════════════════════════
// Types matching L1 output (curriculum.json)
// ═══════════════════════════════════════════

export interface L1Concept {
  id: string;                    // e.g. "sec1_1_con1"
  name: string;                  // e.g. "Definition and Notation of Functions"
  description: string;           // Full description
  section_title?: string;        // Parent section title (from API)
  prerequisites: string[];       // Array of concept IDs
  key_formulas: string[];        // e.g. ["y = f(x)"]
  is_core: boolean;              // Is this a core concept?
  difficulty_level: number;      // 0.0 - 1.0
  exercise_count: number;        // Number of exercises
  exercise_range: string;        // e.g. "1-7"
  questions: L1Question[];
}

export interface L1Question {
  id: string;
  text: string;
  difficulty: string;
  question_type: string;
  answer_hint: string;
  correct_answer: string;
  options: string[];
  concept_id: string;
  is_diagnostic: boolean;
  bloom_level: number;
}

export interface L1Section {
  id: string;                    // e.g. "sec1_1"
  title: string;                 // e.g. "1.1 Functions and Their Graphs"
  page_start: number;
  total_exercises: number;
  concepts: L1Concept[];
}

export interface L1Chapter {
  id: string;
  number: number;
  title: string;                 // e.g. "Functions"
  summary: string;
  sections: L1Section[];
}

export interface L1Curriculum {
  book_title: string;            // "Functions" (Thomas' Calculus Ch1)
  chapters: L1Chapter[];
}

export interface DiagnosticQuestion {
  id: string;
  concept_id: string;
  concept_name: string;
  section_title: string;
  text: string;
  options: string[];
  correct_answer: string;
}

export interface MasterySnapshot {
  concept_id: string;
  concept_name: string;
  mastery_estimate: number;
  mastery_level: string;
  attempts: number;
  correct_count: number;
}

export interface StudentState {
  student_id: string;
  diagnostic_complete: boolean;
  mastery_snapshots: Record<string, MasterySnapshot>;
  overall_mastery: number;
  weakest_concepts: string[];
  strongest_concepts: string[];
}

// ═══════════════════════════════════════════
// Cached data (per-slug)
// ═══════════════════════════════════════════

let _curriculumCache: Record<string, L1Curriculum> = {};
let _diagnosticQuestions: DiagnosticQuestion[] | null = null;

// ═══════════════════════════════════════════
// L1: Curriculum Data (multi-curriculum)
// ═══════════════════════════════════════════

export async function fetchCurriculum(slug?: string): Promise<L1Curriculum | null> {
  const activeSlug = slug || localStorage.getItem('apex_active_curriculum') || '';
  
  if (activeSlug && _curriculumCache[activeSlug]) return _curriculumCache[activeSlug];

  // Try API first (multi-curriculum)
  if (activeSlug) {
    try {
      const res = await fetch(`${API}/api/curricula/${activeSlug}`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        const curriculum = data.curriculum_json as L1Curriculum;
        if (curriculum?.chapters) {
          _curriculumCache[activeSlug] = curriculum;
          console.log('[L1] Curriculum loaded from API:', activeSlug);
          return curriculum;
        }
      }
    } catch (e) {
      console.warn('[L1] API not available, falling back to static:', e);
    }
  }

  return null;
}

export async function fetchDiagnosticQuestions(): Promise<DiagnosticQuestion[]> {
  if (_diagnosticQuestions) return _diagnosticQuestions;
  try {
    const res = await fetch('/data/diagnostic_questions.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _diagnosticQuestions = await res.json();
    console.log('[L1] Diagnostic questions loaded:', _diagnosticQuestions!.length);
    return _diagnosticQuestions!;
  } catch (e) {
    console.warn('[L1] diagnostic_questions.json not available:', e);
    return [];
  }
}

/** Clear cached curriculum data (call when switching curricula) */
export function clearCurriculumCache() {
  _curriculumCache = {};
}

// ═══════════════════════════════════════════
// L1: Computed Stats
// ═══════════════════════════════════════════

export interface CurriculumStats {
  book_title: string;
  chapters: number;
  sections: number;
  concepts: number;
  exercises: number;
  core_concepts: number;
  prerequisites_count: number;  // concepts with prerequisites
  difficulty_avg: number;
  sections_data: { id: string; title: string; concept_count: number; exercise_count: number; concept_ids?: string[] }[];
  difficulty_distribution: { easy: number; medium: number; hard: number };
}

export async function getCurriculumStats(slug?: string): Promise<CurriculumStats | null> {
  const activeSlug = slug || localStorage.getItem('apex_active_curriculum') || '';

  // Try API first
  if (activeSlug) {
    try {
      const res = await fetch(`${API}/api/curricula/${activeSlug}/stats`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        console.log('[L1] Stats loaded from API:', activeSlug);
        return data as CurriculumStats;
      }
    } catch (e) {
      console.warn('[L1] Stats API failed, computing locally:', e);
    }
  }

  // Fallback: compute from curriculum JSON
  const cur = await fetchCurriculum(slug);
  if (!cur) return null;

  let sections = 0;
  let concepts = 0;
  let exercises = 0;
  let core_concepts = 0;
  let prereq_count = 0;
  let difficulty_sum = 0;
  let easy = 0, medium = 0, hard = 0;
  const sections_data: CurriculumStats['sections_data'] = [];

  for (const ch of cur.chapters || []) {
    for (const sec of ch.sections || []) {
      sections++;
      const sec_concepts = sec.concepts?.length || 0;
      const sec_exercises = sec.total_exercises || 0;
      sections_data.push({
        id: sec.id,
        title: sec.title,
        concept_count: sec_concepts,
        exercise_count: sec_exercises,
        concept_ids: (sec.concepts || []).map((c: L1Concept) => c.id),
      });

      for (const con of sec.concepts || []) {
        concepts++;
        exercises += con.exercise_count || 0;
        if (con.is_core) core_concepts++;
        if (con.prerequisites?.length > 0) prereq_count++;
        difficulty_sum += con.difficulty_level || 0.5;

        const d = con.difficulty_level || 0.5;
        if (d < 0.35) easy++;
        else if (d < 0.65) medium++;
        else hard++;
      }
    }
  }

  return {
    book_title: cur.book_title || "Thomas' Calculus — Chapter 1",
    chapters: cur.chapters?.length || 0,
    sections,
    concepts,
    exercises,
    core_concepts,
    prerequisites_count: prereq_count,
    difficulty_avg: concepts > 0 ? difficulty_sum / concepts : 0.5,
    sections_data,
    difficulty_distribution: { easy, medium, hard },
  };
}

// ═══════════════════════════════════════════
// L1: Concept Access
// ═══════════════════════════════════════════

export async function getAllConcepts(slug?: string): Promise<L1Concept[]> {
  const activeSlug = slug || localStorage.getItem('apex_active_curriculum') || '';

  // Try API first
  if (activeSlug) {
    try {
      const res = await fetch(`${API}/api/curricula/${activeSlug}/concepts`, { headers: getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        console.log('[L1] Concepts loaded from API:', data.length);
        return data as L1Concept[];
      }
    } catch (e) {
      console.warn('[L1] Concepts API failed, loading from JSON:', e);
    }
  }

  // Fallback
  const cur = await fetchCurriculum(slug);
  if (!cur) return [];
  const all: L1Concept[] = [];
  for (const ch of cur.chapters || []) {
    for (const sec of ch.sections || []) {
      for (const con of sec.concepts || []) {
        all.push(con);
      }
    }
  }
  return all;
}

export async function getConceptById(id: string): Promise<L1Concept | null> {
  const all = await getAllConcepts();
  return all.find(c => c.id === id) || null;
}

export async function getConceptPrerequisites(id: string): Promise<L1Concept[]> {
  const concept = await getConceptById(id);
  if (!concept?.prerequisites?.length) return [];
  const all = await getAllConcepts();
  return concept.prerequisites
    .map(pid => all.find(c => c.id === pid))
    .filter(Boolean) as L1Concept[];
}

export async function getCoreConcepts(): Promise<L1Concept[]> {
  const all = await getAllConcepts();
  return all.filter(c => c.is_core);
}

// ═══════════════════════════════════════════
// Student State
// ═══════════════════════════════════════════

export async function fetchStudentState(studentId: string): Promise<StudentState | null> {
  // Try API first
  try {
    const res = await fetch(`/api/students/${studentId}`, { headers: getAuthHeader() });
    if (res.ok) return await res.json();
  } catch {}
  // Fallback: localStorage
  const stored = localStorage.getItem(`apex_student_${studentId}`);
  return stored ? JSON.parse(stored) : null;
}

export async function saveStudentState(state: StudentState): Promise<void> {
  try {
    await fetch(`/api/students/${state.student_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(state),
    });
  } catch {}
  localStorage.setItem(`apex_student_${state.student_id}`, JSON.stringify(state));
}

// ═══════════════════════════════════════════
// RAG Engine
// ═══════════════════════════════════════════

export async function askRAG(question: string, studentId?: string): Promise<string | null> {
  try {
    const res = await fetch('/api/rag/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, student_id: studentId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.answer || null;
  } catch {
    return null;
  }
}

export async function isBackendAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════
// Auth API
// ═══════════════════════════════════════════

export interface SignupData {
  student_id: string;
  password: string;
  full_name?: string;
  email?: string;
}

export interface AuthResult {
  status: string;
  student_id: string;
  full_name: string;
  coach_name?: string;
  diagnostic_done?: boolean;
  stars_total?: number;
  message?: string;
}

export async function signup(data: SignupData): Promise<AuthResult> {
  const res = await fetch(`${API}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.detail || 'فشل إنشاء الحساب');
  return result;
}

export async function login(studentId: string, password: string): Promise<AuthResult> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: studentId, password }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.detail || 'فشل تسجيل الدخول');
  return result;
}

export async function getCurrentStudent(studentId: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API}/api/auth/me/${studentId}`, { headers: getAuthHeader() });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

// ═══════════════════════════════════════════
// Interactions API
// ═══════════════════════════════════════════

export interface InteractionData {
  student_id: string;
  question_id: string;
  concept_id: string;
  session_id: string;
  session_type?: string;
  correct?: boolean;
  attempt_number?: number;
  prior_attempts?: number;
  confidence_level?: number;
  hint_used?: boolean;
  explanation_viewed?: boolean;
  student_explanation?: string;
  input_modality?: string;
  question_pattern?: string;
  question_regenerated?: number;
  regeneration_reason?: string;
  rest_requested?: boolean;
  coach_called?: boolean;
  coach_interaction_type?: string;
  session_end_type?: string;
  mastery_gate_passed?: boolean;
}

export async function submitInteraction(data: InteractionData): Promise<{ interaction_id: number }> {
  const res = await fetch(`${API}/api/interactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.detail || 'فشل تسجيل التفاعل');
  return result;
}

export async function getInteractions(studentId: string, sessionId?: string): Promise<any[]> {
  const url = sessionId
    ? `${API}/api/interactions/${studentId}?session_id=${sessionId}`
    : `${API}/api/interactions/${studentId}`;
  try {
    const res = await fetch(url, { headers: getAuthHeader() });
    if (res.ok) return await res.json();
  } catch {}
  return [];
}

// ═══════════════════════════════════════════
// Mastery API
// ═══════════════════════════════════════════

export interface MasterySnapshotData {
  student_id: string;
  concept_id: string;
  mastery_estimate: number;
  pattern_accuracy: Record<string, number>;
  accuracy_rate: number;
  sessions_count: number;
  last_updated?: string;
}

export async function getMasterySnapshots(studentId: string, slug?: string): Promise<MasterySnapshotData[]> {
  try {
    const slugParam = slug ? `?slug=${encodeURIComponent(slug)}` : '';
    const res = await fetch(`${API}/api/mastery/${studentId}${slugParam}`, { headers: getAuthHeader() });
    if (res.ok) return await res.json();
  } catch {}
  return [];
}

export async function updateMastery(
  studentId: string,
  conceptId: string,
  data: { mastery_estimate: number; pattern_accuracy: Record<string, number>; accuracy_rate: number; sessions_count: number }
): Promise<void> {
  await fetch(`${API}/api/mastery/${studentId}/${conceptId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(data),
  });
}


// ═══════════════════════════════════════════
// Intelligence API — Learning Path, Next Questions, Coach
// ═══════════════════════════════════════════

export async function getLearningPath(studentId: string, slug: string): Promise<any> {
  try {
    const res = await fetch(`${API}/api/learning-path/${studentId}/${slug}`, { headers: getAuthHeader() });
    if (res.ok) return await res.json();
  } catch {}
  return { path: [], progress: 0, mastered: 0, total: 0, next_concepts: [] };
}

export async function getNextQuestions(studentId: string, slug: string, count = 3): Promise<any[]> {
  try {
    const res = await fetch(`${API}/api/next-questions/${studentId}/${slug}?count=${count}`, { headers: getAuthHeader() });
    if (res.ok) {
      const data = await res.json();
      return data.next_questions || [];
    }
  } catch {}
  return [];
}

export async function getSectionProgress(studentId: string, slug: string): Promise<any> {
  try {
    const res = await fetch(`${API}/api/section-progress/${studentId}/${slug}`, { headers: getAuthHeader() });
    if (res.ok) return await res.json();
  } catch {}
  return { completed_sections: [], active_section: null, next_section: null, overall_progress: 0 };
}

export async function getStudentAnalysis(studentId: string): Promise<any> {
  try {
    const res = await fetch(`${API}/api/student-analysis/${studentId}`, { headers: getAuthHeader() });
    if (res.ok) return await res.json();
  } catch {}
  return { personality_traits: {}, session_stats: {}, recommendations: [] };
}
