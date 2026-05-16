"""Upload pre-built dist/ + backend Python files to production server."""
import sys, io, os
if sys.stdout and hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import paramiko

HOST = "187.77.65.175"
USER = "root"
REMOTE_DIR = "/opt/apex/frontend/dist"
REMOTE_API  = "/opt/apex"
LOCAL_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")
LOCAL_ROOT = os.path.dirname(os.path.abspath(__file__))
SSH_KEY = os.path.join(os.environ.get("USERPROFILE", os.path.expanduser("~")), ".ssh", "id_ed25519")

# Backend Python files to sync (relative to LOCAL_ROOT)
BACKEND_FILES = [
    "api/server.py",
    "api/pipeline.py",
    "api/utils.py",
    "src/ai_enricher.py",
    "src/config.py",
    "src/models.py",
    "src/docling_extractor.py",
    "src/external_concept_generator.py",
    "src/diagnostic_selector.py",
    "src/question_generator.py",
    "src/question_selector.py",
    "src/mastery_tracker.py",
    "api/routers/learn.py",
]

def _ensure_remote_dir(sftp, remote_path: str):
    parts = remote_path.split("/")
    for i in range(1, len(parts) + 1):
        p = "/".join(parts[:i])
        if not p:
            continue
        try:
            sftp.stat(p)
        except FileNotFoundError:
            try:
                sftp.mkdir(p)
            except IOError:
                pass

def main():
    print("APEX — Upload pre-built dist/ + backend files")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, key_filename=SSH_KEY, timeout=15)
    sftp = client.open_sftp()

    # ── 1. Frontend dist ─────────────────────────────────────────────────
    count = 0
    for root, dirs, files in os.walk(LOCAL_DIST):
        for f in files:
            local_path = os.path.join(root, f)
            rel = os.path.relpath(local_path, LOCAL_DIST)
            remote_path = f"{REMOTE_DIR}/{rel}".replace("\\", "/")
            remote_parent = "/".join(remote_path.split("/")[:-1])
            _ensure_remote_dir(sftp, remote_parent)
            sftp.put(local_path, remote_path)
            count += 1
            print(f"  {rel}")

    print(f"\nUploaded {count} dist files")

    # ── 2. Backend Python files ──────────────────────────────────────────
    backend_count = 0
    for rel in BACKEND_FILES:
        local_path = os.path.join(LOCAL_ROOT, rel)
        if not os.path.exists(local_path):
            print(f"  [SKIP] {rel} (not found locally)")
            continue
        remote_path = f"{REMOTE_API}/{rel}".replace("\\", "/")
        remote_parent = "/".join(remote_path.split("/")[:-1])
        _ensure_remote_dir(sftp, remote_parent)
        sftp.put(local_path, remote_path)
        print(f"  [py] {rel}")
        backend_count += 1

    print(f"Uploaded {backend_count} backend files")

    sftp.close()

    # ── 3. Restart services ──────────────────────────────────────────────
    stdin, stdout, stderr = client.exec_command("systemctl restart nginx")
    stdout.read()
    print("Nginx restarted")

    stdin, stdout, stderr = client.exec_command("systemctl restart apex-api")
    stdout.read()
    print("API restarted")

    import time; time.sleep(3)
    stdin, stdout, stderr = client.exec_command("curl -s http://localhost:8000/api/health")
    health = stdout.read().decode()
    print(f"API: {health[:150]}")

    # Check curricula status
    stdin, stdout, stderr = client.exec_command(
        "curl -s http://localhost:8000/api/curricula | python3 -c \""
        "import sys,json; data=json.load(sys.stdin); "
        "[print(f'  {c[\\\"slug\\\"]:40s} status={c[\\\"status\\\"]:15s} concepts={c[\\\"total_concepts\\\"]}') for c in data]\""
    )
    print("Curricula status:")
    print(stdout.read().decode())

    client.close()
    print(f"\nLive at: https://apexfor.me")

if __name__ == "__main__":
    main()
