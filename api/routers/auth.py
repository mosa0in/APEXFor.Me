"""
APEX — Auth Router
Endpoints: signup, login, me, next-id
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import bcrypt
import json

from api.utils import get_db

router = APIRouter(prefix="/api/auth", tags=["Auth"])


# ═══════════════════════════════════════════
# Pydantic Models
# ═══════════════════════════════════════════

class SignupRequest(BaseModel):
    student_id: str
    password: str
    full_name: str = ""
    email: str = ""


class LoginRequest(BaseModel):
    student_id: str
    password: str


# ═══════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════

@router.get("/next-id")
def next_student_id():
    """Generate the next sequential student ID."""
    with get_db() as conn:
        row = conn.execute("SELECT COUNT(*) as cnt FROM students").fetchone()
        count = (row["cnt"] if row else 0) + 1
        year = datetime.now().year
        return {"next_id": f"STU-{year}-{count:03d}"}


@router.post("/signup")
def signup(data: SignupRequest):
    """Create a new student account."""
    if not data.student_id.strip() or len(data.student_id) < 2:
        raise HTTPException(400, "رقم الطالب يجب أن يكون حرفين على الأقل")
    if not data.password or len(data.password) < 4:
        raise HTTPException(400, "كلمة المرور يجب أن تكون 4 أحرف على الأقل")

    with get_db() as conn:
        existing = conn.execute("SELECT student_id FROM students WHERE student_id = ?",
                                (data.student_id,)).fetchone()
        if existing:
            raise HTTPException(409, "رقم الطالب مسجل مسبقاً")

        pw_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
        conn.execute("""
            INSERT INTO students (student_id, password_hash, full_name, email)
            VALUES (?, ?, ?, ?)
        """, (data.student_id, pw_hash, data.full_name, data.email))
        conn.commit()

    return {
        "status": "ok",
        "student_id": data.student_id,
        "full_name": data.full_name,
        "message": "تم إنشاء الحساب بنجاح"
    }


@router.post("/login")
def login(data: LoginRequest):
    """Authenticate a student."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM students WHERE student_id = ?",
                           (data.student_id,)).fetchone()

    if not row:
        raise HTTPException(401, "رقم الطالب غير موجود")

    if not bcrypt.checkpw(data.password.encode(), row["password_hash"].encode()):
        raise HTTPException(401, "كلمة المرور غير صحيحة")

    return {
        "status": "ok",
        "student_id": row["student_id"],
        "full_name": row["full_name"],
        "coach_name": row["coach_name"],
        "diagnostic_done": bool(row["diagnostic_done"]),
        "stars_total": row["stars_total"],
    }


@router.get("/me/{student_id}")
def get_me(student_id: str):
    """Get current student profile."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM students WHERE student_id = ?",
                           (student_id,)).fetchone()
    if not row:
        raise HTTPException(404, "الطالب غير موجود")

    d = dict(row)
    del d["password_hash"]
    for k in ("coach_personality_json", "reward_style", "mastery_gates_passed", "badges"):
        try:
            d[k] = json.loads(d.get(k, "{}") or "{}")
        except json.JSONDecodeError:
            pass
    return d
