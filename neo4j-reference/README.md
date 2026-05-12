# Neo4j 5.26 — Research Reference

This directory documents our use of Neo4j 5.26 Community Edition as the Knowledge Graph engine.

## Source Reference
The full Neo4j 5.26 source code is available at:
`C:\Users\MSI\Downloads\Compressed\neo4j-release-5.26.0\neo4j-release-5.26.0\`

## Why Neo4j for Educational Knowledge Graphs

### Graph Model Advantages
- **Natural representation**: Curriculum hierarchies (Book → Chapter → Section → Concept → Question) map directly to graph structures
- **Relationship queries**: Prerequisites, dependencies, and concept connections are first-class citizens
- **Traversal performance**: Finding "all concepts that depend on X" is O(relationships), not O(n²) joins

### Key Components Used (from source analysis)
1. **Kernel** (`community/kernel/`) — Core graph storage engine
2. **Cypher** (`community/cypher/`) — Declarative graph query language
3. **APOC** (plugin) — Utility procedures for graph algorithms
4. **Vector Index** (5.x) — Enables hybrid graph + vector queries

### Cypher Queries Used in APEX

```cypher
-- Find all prerequisites for a concept (recursive)
MATCH path = (c:Concept {name: "Integration by Parts"})-[:REQUIRES*]->(prereq:Concept)
RETURN nodes(path)

-- Find struggling concepts for a student
MATCH (s:Student {id: $student_id})-[:STRUGGLING_WITH]->(c:Concept)
RETURN c.name, c.description

-- Get adaptive question (easiest unmastered concept)
MATCH (s:Student {id: $student_id})
WHERE NOT (s)-[:MASTERED]->(c)
MATCH (c:Concept)-[:TESTED_BY]->(q:Question)
RETURN q ORDER BY q.difficulty ASC LIMIT 1
```

## Citation
```bibtex
@misc{neo4j2024,
  title={Neo4j: The Graph Database Platform},
  author={{Neo4j, Inc.}},
  year={2024},
  note={Version 5.26, Community Edition},
  url={https://neo4j.com}
}
```
