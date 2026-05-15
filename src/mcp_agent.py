"""
APEX MCP Agent — Simplified Model Context Protocol Agent
Provides tool-calling interface for the AI Coach to access student state,
curriculum data, and learning engine functions.

Tools available:
  1. get_student_state — current mastery + personality traits
  2. fetch_concept — concept details + prerequisites + questions
  3. get_next_question — adaptive question selection
  4. run_socratic_probe — Socratic question based on gap type
  5. get_learning_path — full path with recommendations
  6. update_mastery — record a new interaction and update BKT
"""
import json
import sqlite3
from typing import Dict, List, Optional, Any

from src.denoising_engine import compute_weighted_correct, classify_confidence_answer
from src.mastery_tracker import bkt_update, check_mastery_gate, get_mastery_level, L0
from src.mindset_analyzer import analyze_mindset_gap
from src.coach_analyzer import analyze_student_behavior
from src.question_selector import select_next_questions, get_learning_path
from src.graph_engine import SQLiteGraphEngine


class MCPAgent:
    """
    Model Context Protocol Agent for APEX Coach.
    Wraps all intelligence engines into a tool-calling interface.
    """

    TOOLS = [
        {
            "name": "get_student_state",
            "description": "Get current student mastery levels, personality traits, and recommendations",
            "parameters": {"student_id": "string"},
        },
        {
            "name": "fetch_concept",
            "description": "Get concept details including prerequisites, related concepts, and questions",
            "parameters": {"concept_id": "string"},
        },
        {
            "name": "get_next_question",
            "description": "Get the optimal next question for adaptive learning",
            "parameters": {"student_id": "string", "curriculum_slug": "string"},
        },
        {
            "name": "run_socratic_probe",
            "description": "Generate a Socratic question based on student's gap type",
            "parameters": {"gap_type": "string", "concept_name": "string", "student_explanation": "string"},
        },
        {
            "name": "get_learning_path",
            "description": "Get the full learning path with concept statuses and progress",
            "parameters": {"student_id": "string", "curriculum_slug": "string"},
        },
    ]

    def __init__(self, db_path: str):
        self.db_path = db_path

    def _get_db(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def execute_tool(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool by name with given parameters."""
        handler = getattr(self, f"_tool_{tool_name}", None)
        if not handler:
            return {"error": f"Unknown tool: {tool_name}"}
        try:
            return handler(**params)
        except Exception as e:
            return {"error": str(e)}

    def get_tools_schema(self) -> List[dict]:
        """Return tool schemas for LLM function calling."""
        return self.TOOLS

    def build_system_prompt(self, student_id: str) -> str:
        """Build a context-rich system prompt for the AI Coach."""
        conn = self._get_db()
        try:
            # Get student state
            analysis = analyze_student_behavior(conn, student_id)
            traits = analysis.get("personality_traits", {})
            stats = analysis.get("session_stats", {})
            recs = analysis.get("recommendations", [])

            # Get mastery
            mastery_rows = conn.execute(
                "SELECT concept_id, mastery_estimate FROM mastery_snapshots WHERE student_id = ?",
                (student_id,)
            ).fetchall()
            mastery_map = {r["concept_id"]: round(r["mastery_estimate"], 2) for r in mastery_rows}

            # Get recent interactions for context
            recent = conn.execute(
                "SELECT concept_id, correct, confidence_level, student_explanation, "
                "coach_interaction_type, session_end_type "
                "FROM interactions WHERE student_id = ? ORDER BY timestamp DESC LIMIT 5",
                (student_id,)
            ).fetchall()

            recent_context = []
            for r in recent:
                recent_context.append({
                    "concept": r["concept_id"],
                    "correct": bool(r["correct"]),
                    "confidence": r["confidence_level"],
                    "gap_type": r["session_end_type"],
                    "ca_class": r["coach_interaction_type"],
                    "explanation": (r["student_explanation"] or "")[:100],
                })

            prompt = f"""أنت كوتش تعليمي ذكي في نظام APEX. أنت تتحدث مع الطالب.

## حالة الطالب
- الدقة الكلية: {stats.get('accuracy', 'N/A')}%
- متوسط الثقة: {stats.get('avg_confidence', 'N/A')}/5
- عدد التفاعلات: {stats.get('total_interactions', 0)}

## سمات الشخصية
- يحتاج تشجيع: {traits.get('needs_encouragement', 'medium')}
- فترة الانتباه: {traits.get('attention_span', 'medium')}
- سرعة التعلم: {traits.get('learning_speed', 'medium')}
- معايرة الثقة: {traits.get('confidence_calibration', 'calibrated')}

## مستوى الإتقان الحالي
{json.dumps(mastery_map, indent=2, ensure_ascii=False)}

## آخر 5 تفاعلات
{json.dumps(recent_context, indent=2, ensure_ascii=False)}

## توصيات النظام
{chr(10).join(f'- {r}' for r in recs)}

## قواعد التفاعل
1. إذا كانت الثقة عالية والإجابة خاطئة (conceptual_error) → استخدم أسلوب سقراطي لتحدي المفهوم الخاطئ
2. إذا كانت الثقة منخفضة والإجابة صحيحة (lucky_guess) → شجع الطالب وأكد على فهمه
3. إذا كان الطالب يحتاج تشجيع → استخدم عبارات إيجابية وأبرز نجاحاته
4. دائماً اسأل "كيف وصلت لهذه الإجابة؟" لتفعيل Mindset Detection
5. لا تعطي الإجابة مباشرة — استخدم التلميحات والأسئلة الموجهة
"""
            return prompt
        finally:
            conn.close()

    # ═══ Tool Implementations ═══

    def _tool_get_student_state(self, student_id: str) -> dict:
        conn = self._get_db()
        try:
            analysis = analyze_student_behavior(conn, student_id)

            mastery_rows = conn.execute(
                "SELECT concept_id, mastery_estimate FROM mastery_snapshots WHERE student_id = ?",
                (student_id,)
            ).fetchall()

            return {
                "mastery": {r["concept_id"]: round(r["mastery_estimate"], 3) for r in mastery_rows},
                "traits": analysis["personality_traits"],
                "stats": analysis["session_stats"],
                "recommendations": analysis["recommendations"],
            }
        finally:
            conn.close()

    def _tool_fetch_concept(self, concept_id: str) -> dict:
        conn = self._get_db()
        try:
            graph = SQLiteGraphEngine(conn)
            context = graph.get_concept_with_context(concept_id)
            if not context:
                return {"error": f"Concept {concept_id} not found"}

            related = graph.find_related_concepts(concept_id)
            prereq_chain = graph.get_prerequisite_chain(concept_id)

            return {
                "concept": context["concept"],
                "section": context["section_title"],
                "prerequisites": context["prerequisites"],
                "dependents": context["dependents"],
                "related_concepts": related,
                "prerequisite_chain": prereq_chain,
                "question_count": len(context["questions"]),
            }
        finally:
            conn.close()

    def _tool_get_next_question(self, student_id: str, curriculum_slug: str) -> dict:
        conn = self._get_db()
        try:
            questions = select_next_questions(conn, student_id, curriculum_slug, count=1)
            if questions:
                return {"next": questions[0]}
            return {"next": None, "message": "All concepts mastered!"}
        finally:
            conn.close()

    def _tool_run_socratic_probe(
        self, gap_type: str, concept_name: str, student_explanation: str = ""
    ) -> dict:
        """Generate a Socratic probe based on gap type."""
        probes = {
            "conceptual": [
                f"فكر معي: ماذا يعني {concept_name} بكلماتك الخاصة؟",
                f"لو شرحت {concept_name} لصديقك، كيف ستشرحه؟",
                f"ما الفرق بين ما كتبته وبين التعريف الصحيح لـ {concept_name}؟",
            ],
            "procedural": [
                f"خطواتك منطقية! أين بالتحديد تعتقد حصل الخطأ؟",
                f"لو بدأت من أول خطوة في {concept_name}، ماذا ستفعل؟",
                f"هل يمكنك تتبع الحل خطوة بخطوة وتخبرني أين توقفت؟",
            ],
            "insufficient_data": [
                f"أخبرني: كيف فكرت بالإجابة؟ ما المنطق الذي اتبعته؟",
                f"حتى لو ما كنت متأكد، شاركني تفكيرك — كل محاولة مهمة!",
            ],
        }
        options = probes.get(gap_type, probes["insufficient_data"])
        import random
        chosen = random.choice(options)

        return {
            "probe": chosen,
            "gap_type": gap_type,
            "strategy": "socratic",
            "follow_up": f"بعد ما تجاوب، راح أساعدك تفهم {concept_name} بطريقة أعمق.",
        }

    def _tool_get_learning_path(self, student_id: str, curriculum_slug: str) -> dict:
        conn = self._get_db()
        try:
            return get_learning_path(conn, student_id, curriculum_slug)
        finally:
            conn.close()
