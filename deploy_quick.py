"""Quick redeploy — re-upload changed files and rebuild frontend."""
import sys, io, os
if sys.stdout and hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import paramiko

HOST = "187.77.65.175"
USER = "root"
REMOTE_DIR = "/opt/apex"
LOCAL_ROOT = os.path.dirname(os.path.abspath(__file__))
SSH_KEY = os.path.join(os.environ.get("USERPROFILE", os.path.expanduser("~")), ".ssh", "id_ed25519")

def ssh_connect():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    if os.path.exists(SSH_KEY):
        client.connect(HOST, username=USER, key_filename=SSH_KEY, timeout=15)
    else:
        # Fallback to password from env
        password = os.environ.get("APEX_SSH_PASSWORD", "")
        if not password:
            raise RuntimeError("No SSH key found and APEX_SSH_PASSWORD not set")
        client.connect(HOST, username=USER, password=password, timeout=15)
    return client

def run(client, cmd, show=True, timeout=180):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if show and out.strip():
        print(f"  {out.strip()[:300]}")
    return out.strip()

def main():
    print("APEX Quick Redeploy")
    client = ssh_connect()
    sftp = client.open_sftp()

    # Re-upload frontend source
    print("[1] Re-uploading frontend files...")
    frontend_dir = os.path.join(LOCAL_ROOT, "frontend")
    count = 0
    for root, dirs, files in os.walk(frontend_dir):
        dirs[:] = [d for d in dirs if d not in ("node_modules", "dist", ".git")]
        for f in files:
            local_path = os.path.join(root, f)
            rel = os.path.relpath(local_path, frontend_dir)
            remote_path = f"{REMOTE_DIR}/frontend/{rel}".replace("\\", "/")
            remote_parent = "/".join(remote_path.split("/")[:-1])
            try:
                sftp.stat(remote_parent)
            except FileNotFoundError:
                parts = remote_parent.split("/")
                for i in range(1, len(parts) + 1):
                    p = "/".join(parts[:i])
                    try: sftp.mkdir(p)
                    except IOError: pass
            sftp.put(local_path, remote_path)
            count += 1
    sftp.close()
    print(f"  Uploaded {count} files")

    # Re-upload backend files (api/ + src/)
    print("[1b] Re-uploading backend files...")
    sftp = client.open_sftp()
    backend_count = 0
    for subdir in ["api", "src"]:
        local_dir = os.path.join(LOCAL_ROOT, subdir)
        if not os.path.isdir(local_dir):
            continue
        for root, dirs, files in os.walk(local_dir):
            dirs[:] = [d for d in dirs if d not in ("__pycache__", ".git")]
            for f in files:
                if not f.endswith((".py", ".json", ".txt")):
                    continue
                local_path = os.path.join(root, f)
                rel = os.path.relpath(local_path, local_dir)
                remote_path = f"{REMOTE_DIR}/{subdir}/{rel}".replace("\\", "/")
                remote_parent = "/".join(remote_path.split("/")[:-1])
                try:
                    sftp.stat(remote_parent)
                except FileNotFoundError:
                    parts = remote_parent.split("/")
                    for i in range(1, len(parts) + 1):
                        p = "/".join(parts[:i])
                        try: sftp.mkdir(p)
                        except IOError: pass
                sftp.put(local_path, remote_path)
                backend_count += 1
    sftp.close()
    print(f"  Uploaded {backend_count} backend files")

    # Upload root-level HTML tools
    print("[1c] Uploading HTML tools + requirements...")
    sftp = client.open_sftp()
    for fname in ["data_collector.html", "diagnostic_ui.html", "requirements.txt"]:
        local_path = os.path.join(LOCAL_ROOT, fname)
        if os.path.exists(local_path):
            sftp.put(local_path, f"{REMOTE_DIR}/{fname}")
            print(f"  {fname}")
    sftp.close()

    # Upload backend .env (API key for production)
    print("[1d] Writing .env on server...")
    local_env = os.path.join(LOCAL_ROOT, ".env")
    if os.path.exists(local_env):
        with open(local_env, "r", encoding="utf-8") as f:
            env_content = f.read()
        # Write via heredoc (safe for special chars)
        import base64
        env_b64 = base64.b64encode(env_content.encode()).decode()
        run(client, f"echo '{env_b64}' | base64 -d > {REMOTE_DIR}/.env", show=False)
        print("  .env written")
    else:
        print("  WARNING: local .env not found — skipping")

    # Set production env — empty API URL = same-origin (nginx proxy)
    print("[2] Setting production env...")
    run(client, f"""cat > {REMOTE_DIR}/frontend/.env.production << 'EOF'
VITE_API_URL=
EOF""", show=False)

    # Rebuild
    print("[3] Rebuilding frontend...")
    result = run(client, f"cd {REMOTE_DIR}/frontend && npm run build 2>&1 | tail -10")
    check = run(client, f"ls {REMOTE_DIR}/frontend/dist/index.html 2>/dev/null && echo 'OK' || echo 'FAIL'", show=False)
    print(f"  Build: {check}")

    # Restart API
    print("[4] Restarting services...")
    run(client, "systemctl restart apex-api", show=False)
    run(client, "systemctl restart nginx", show=False)

    import time; time.sleep(2)
    health = run(client, "curl -s http://localhost:8000/api/health", show=False)
    print(f"  API: {health[:150]}")
    print(f"\n  Live at: http://{HOST}")

    client.close()

if __name__ == "__main__":
    main()
