"""Quick status check for all APEX systems."""
import json, os, sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

print("=== APEX PIPELINE STATUS ===\n")
has_errors = False

# 1. Neo4j
try:
    from neo4j import GraphDatabase
    d = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "apex_intelligence_2026"))
    with d.session() as s:
        nodes = s.run("MATCH (n) RETURN count(n) as c").single()["c"]
        rels = s.run("MATCH ()-[r]->() RETURN count(r) as c").single()["c"]
        print(f"Neo4j Knowledge Graph: {nodes} nodes, {rels} relationships")
    d.close()
except Exception as e:
    has_errors = True
    print(f"Neo4j: ERROR - {e}")

# 2. Qdrant
try:
    from qdrant_client import QdrantClient
    q = QdrantClient(host="localhost", port=6333)
    info = q.get_collection("curriculum_concepts")
    print(f"Qdrant Vectors:        {info.points_count} vectors ({info.config.params.vectors.size}D)")
except Exception as e:
    has_errors = True
    print(f"Qdrant: ERROR - {e}")

# 3. SINKT Data
sinkt_dir = "data/sinkt_data"
if os.path.exists(sinkt_dir):
    files = os.listdir(sinkt_dir)
    print(f"SINKT Training Data:   {len(files)} files")
else:
    print("SINKT: NOT GENERATED")

# 4. Curriculum
with open("data/curriculum.json", "r", encoding="utf-8") as f:
    c = json.load(f)
total_c = sum(len(sec["concepts"]) for ch in c["chapters"] for sec in ch["sections"])
total_q = sum(len(con["questions"]) for ch in c["chapters"] for sec in ch["sections"] for con in sec["concepts"])
print(f"Curriculum JSON:       {total_c} concepts, {total_q} questions")

# 5. Diagnostic
try:
    from src.models import Curriculum
    from src.diagnostic_selector import DiagnosticSelector
    cur = Curriculum(**c)
    sel = DiagnosticSelector(cur)
    items = sel.select_diagnostic_questions(max_questions=10)
    print(f"Diagnostic Ready:      {len(items)} questions selected")
except Exception as e:
    has_errors = True
    print(f"Diagnostic: ERROR - {e}")

# 6. Spec-Kit
if os.path.exists(".speckit"):
    print("Spec-Kit:              INITIALIZED")
else:
    print("Spec-Kit:              NOT INITIALIZED")

if has_errors:
    print("\n=== SYSTEM CHECK COMPLETE: ACTION NEEDED ===")
    sys.exit(1)

print("\n=== ALL SYSTEMS OPERATIONAL ===")
