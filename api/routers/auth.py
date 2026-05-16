"""
APEX — Auth Router
Endpoints: signup, login, me, next-id
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
import bcrypt
import json

from fastapi import Depends

from api.utils import get_db, generate_token, get_token_expiry, get_current_student

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
        token = generate_token()
        conn.execute(
            "INSERT INTO auth_tokens (token, student_id, expires_at) VALUES (?, ?, ?)",
            (token, data.student_id, get_token_expiry()),
        )
        conn.commit()

    return {
        "status": "ok",
        "student_id": data.student_id,
        "full_name": data.full_name,
        "token": token,
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

    token = generate_token()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO auth_tokens (token, student_id, expires_at) VALUES (?, ?, ?)",
            (token, row["student_id"], get_token_expiry()),
        )
        conn.commit()

    return {
        "status": "ok",
        "student_id": row["student_id"],
        "full_name": row["full_name"],
        "coach_name": row["coach_name"],
        "diagnostic_done": bool(row["diagnostic_done"]),
        "stars_total": row["stars_total"],
        "token": token,
    }


@router.post("/logout")
def logout(authorization: str = ""):
    """Invalidate a session token."""
    if authorization.startswith("Bearer "):
        token = authorization[7:]
        with get_db() as conn:
            conn.execute("DELETE FROM auth_tokens WHERE token = ?", (token,))
            conn.commit()
    return {"status": "ok"}


@router.get("/me/{student_id}")
def get_me(student_id: str, current_student: str = Depends(get_current_student)):
    """Get current student profile."""
    if current_student != student_id:
        raise HTTPException(403, "Access denied")
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
