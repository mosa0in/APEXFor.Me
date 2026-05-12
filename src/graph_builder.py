"""
Curriculum Parser — Knowledge Graph Builder (Component 3)
Stores the extracted curriculum structure in Neo4j as a Knowledge Graph.
Nodes: Book, Chapter, Section, Concept, Question
Relationships: CONTAINS, REQUIRES (prerequisite), TESTED_BY, RELATED_TO
"""

from neo4j import GraphDatabase
from rich.console import Console
from rich.progress import track

from src.config import settings
from src.models import Curriculum, Chapter, Section, Concept, Question

console = Console()


class KnowledgeGraphBuilder:
    """Builds and manages the curriculum Knowledge Graph in Neo4j."""

    def __init__(
        self,
        uri: str | None = None,
        username: str | None = None,
        password: str | None = None,
    ):
        self.uri = uri or settings.NEO4J_URI
        self.username = username or settings.NEO4J_USERNAME
        self.password = password or settings.NEO4J_PASSWORD
        self.driver = GraphDatabase.driver(self.uri, auth=(self.username, self.password))
        console.print(f"[cyan]🔵 Connected to Neo4j at {self.uri}[/]")

    def close(self):
        """Close the database connection."""
        self.driver.close()

    def clear_database(self):
        """⚠️ Delete all nodes and relationships — use for fresh imports."""
        with self.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
        console.print("[yellow]🗑️  Database cleared[/]")

    def create_constraints(self):
        """Create uniqueness constraints for node IDs."""
        constraints = [
            "CREATE CONSTRAINT IF NOT EXISTS FOR (b:Book) REQUIRE b.title IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (ch:Chapter) REQUIRE ch.id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (sec:Section) REQUIRE sec.id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (con:Concept) REQUIRE con.id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (q:Question) REQUIRE q.id IS UNIQUE",
        ]
        with self.driver.session() as session:
            for c in constraints:
                session.run(c)
        console.print("[green]✅ Constraints created[/]")

    # ─── Node Creation ────────────────────────────────────────────────────────

    def _create_book(self, curriculum: Curriculum):
        """Create the root Book node."""
        query = """
        MERGE (b:Book {title: $title})
        SET b.authors = $authors,
            b.edition = $edition,
            b.language = $language,
            b.total_concepts = $total_concepts,
            b.total_questions = $total_questions
        """
        with self.driver.session() as session:
            session.run(query, {
                "title": curriculum.book_title,
                "authors": curriculum.authors,
                "edition": curriculum.edition,
                "language": curriculum.language,
                "total_concepts": curriculum.total_concepts,
                "total_questions": curriculum.total_questions,
            })

    def _create_chapter(self, chapter: Chapter, book_title: str):
        """Create a Chapter node and link it to the Book."""
        query = """
        MATCH (b:Book {title: $book_title})
        MERGE (ch:Chapter {id: $id})
        SET ch.number = $number,
            ch.title = $title,
            ch.summary = $summary
        MERGE (b)-[:CONTAINS]->(ch)
        """
        with self.driver.session() as session:
            session.run(query, {
                "book_title": book_title,
                "id": chapter.id,
                "number": chapter.number,
                "title": chapter.title,
                "summary": chapter.summary,
            })

    def _create_section(self, section: Section, chapter_id: str):
        """Create a Section node and link it to its Chapter."""
        query = """
        MATCH (ch:Chapter {id: $chapter_id})
        MERGE (sec:Section {id: $id})
        SET sec.title = $title,
            sec.page_start = $page_start
        MERGE (ch)-[:CONTAINS]->(sec)
        """
        with self.driver.session() as session:
            session.run(query, {
                "chapter_id": chapter_id,
                "id": section.id,
                "title": section.title,
                "page_start": section.page_start,
            })

    def _create_concept(self, concept: Concept, section_id: str):
        """Create a Concept node and link it to its Section."""
        query = """
        MATCH (sec:Section {id: $section_id})
        MERGE (con:Concept {id: $id})
        SET con.name = $name,
            con.description = $description,
            con.key_formulas = $key_formulas
        MERGE (sec)-[:CONTAINS]->(con)
        """
        with self.driver.session() as session:
            session.run(query, {
                "section_id": section_id,
                "id": concept.id,
                "name": concept.name,
                "description": concept.description,
                "key_formulas": concept.key_formulas,
            })

    def _create_question(self, question: Question, concept_id: str):
        """Create a Question node and link it to its Concept."""
        query = """
        MATCH (con:Concept {id: $concept_id})
        MERGE (q:Question {id: $id})
        SET q.text = $text,
            q.difficulty = $difficulty,
            q.question_type = $question_type,
            q.answer_hint = $answer_hint
        MERGE (con)-[:TESTED_BY]->(q)
        """
        with self.driver.session() as session:
            session.run(query, {
                "concept_id": concept_id,
                "id": question.id,
                "text": question.text,
                "difficulty": question.difficulty,
                "question_type": question.question_type,
                "answer_hint": question.answer_hint,
            })

    def _create_prerequisites(self, concept: Concept):
        """Create REQUIRES relationships between concepts."""
        if not concept.prerequisites:
            return

        query = """
        MATCH (c:Concept {id: $concept_id})
        MATCH (p:Concept {id: $prereq_id})
        MERGE (c)-[:REQUIRES]->(p)
        """
        with self.driver.session() as session:
            for prereq_id in concept.prerequisites:
                try:
                    session.run(query, {"concept_id": concept.id, "prereq_id": prereq_id})
                except Exception:
                    pass  # Skip if prerequisite doesn't exist yet

    # ─── Full Graph Build ────────────────────────────────────────────────────

    def build_full_graph(self, curriculum: Curriculum, clear_first: bool = True):
        """
        Build the complete Knowledge Graph from a Curriculum model.

        Args:
            curriculum: Validated Curriculum pydantic model.
            clear_first: If True, wipes the database before importing.
        """
        console.print("\n[bold cyan]🔵 Building Knowledge Graph in Neo4j...[/]")

        if clear_first:
            self.clear_database()

        self.create_constraints()

        # 1. Create Book node
        self._create_book(curriculum)
        console.print(f"[green]  📕 Book: {curriculum.book_title}[/]")

        # 2. Create chapters, sections, concepts, questions
        for chapter in track(curriculum.chapters, description="Building graph..."):
            self._create_chapter(chapter, curriculum.book_title)

            for section in chapter.sections:
                self._create_section(section, chapter.id)

                for concept in section.concepts:
                    self._create_concept(concept, section.id)

                    for question in concept.questions:
                        self._create_question(question, concept.id)

        # 3. Create prerequisite relationships (second pass)
        console.print("[dim]  Linking prerequisites...[/]")
        for chapter in curriculum.chapters:
            for section in chapter.sections:
                for concept in section.concepts:
                    self._create_prerequisites(concept)

        # 4. Print summary
        stats = self.get_stats()
        console.print(f"\n[bold green]✅ Knowledge Graph built![/]")
        console.print(f"   📊 Nodes:         {stats['total_nodes']}")
        console.print(f"   🔗 Relationships: {stats['total_rels']}")
        console.print(f"   📖 Chapters:      {stats['chapters']}")
        console.print(f"   💡 Concepts:      {stats['concepts']}")
        console.print(f"   ❓ Questions:     {stats['questions']}")

    def get_stats(self) -> dict:
        """Get graph statistics."""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (n) WITH count(n) AS nodes
                MATCH ()-[r]->() WITH nodes, count(r) AS rels
                OPTIONAL MATCH (ch:Chapter) WITH nodes, rels, count(ch) AS chapters
                OPTIONAL MATCH (con:Concept) WITH nodes, rels, chapters, count(con) AS concepts
                OPTIONAL MATCH (q:Question)
                RETURN nodes, rels, chapters, concepts, count(q) AS questions
            """).single()

            return {
                "total_nodes": result["nodes"],
                "total_rels": result["rels"],
                "chapters": result["chapters"],
                "concepts": result["concepts"],
                "questions": result["questions"],
            }

    # ─── Query Helpers ───────────────────────────────────────────────────────

    def get_concept_with_context(self, concept_id: str) -> dict | None:
        """Get a concept with its section, chapter, prerequisites, and questions."""
        query = """
        MATCH (ch:Chapter)-[:CONTAINS]->(sec:Section)-[:CONTAINS]->(con:Concept {id: $id})
        OPTIONAL MATCH (con)-[:TESTED_BY]->(q:Question)
        OPTIONAL MATCH (con)-[:REQUIRES]->(prereq:Concept)
        RETURN con, sec, ch,
               collect(DISTINCT q) AS questions,
               collect(DISTINCT prereq) AS prerequisites
        """
        with self.driver.session() as session:
            result = session.run(query, {"id": concept_id}).single()
            if not result:
                return None

            return {
                "concept": dict(result["con"]),
                "section": dict(result["sec"]),
                "chapter": dict(result["ch"]),
                "questions": [dict(q) for q in result["questions"]],
                "prerequisites": [dict(p) for p in result["prerequisites"]],
            }


if __name__ == "__main__":
    import json

    # Test with sample data
    sample = Curriculum(
        book_title="Test Calculus",
        chapters=[
            Chapter(
                id="ch1", number=1, title="Limits",
                sections=[
                    Section(
                        id="sec1_1", title="Rates of Change",
                        concepts=[
                            Concept(
                                id="con1_1_1",
                                name="Average Rate of Change",
                                description="Change in f(x) over an interval",
                                questions=[
                                    Question(id="q1_1_1_1", text="Find avg rate of change of f(x)=x²")
                                ]
                            )
                        ]
                    )
                ]
            )
        ]
    )

    builder = KnowledgeGraphBuilder()
    builder.build_full_graph(sample)
    builder.close()
