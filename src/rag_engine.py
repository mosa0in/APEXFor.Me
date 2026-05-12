"""
APEX Curriculum Intelligence — RAG Engine (Component 5)
Retrieval-Augmented Generation powered by Qdrant + Claude.
Forces the LLM to answer ONLY from curriculum content — zero hallucination.
"""

from langchain_anthropic import ChatAnthropic
from langchain.prompts import ChatPromptTemplate
from rich.console import Console

from src.config import settings
from src.qdrant_store import CurriculumVectorStore

console = Console(force_terminal=True)

# ─── RAG System Prompt ───────────────────────────────────────────────────────

RAG_SYSTEM = """You are APEX — an educational AI tutor for curriculum-based learning.
You MUST answer using ONLY the curriculum content provided below.

STRICT RULES:
1. ONLY use information from the CURRICULUM CONTEXT — never use general knowledge.
2. If the answer is NOT in the context, say: "This topic is not covered in the current curriculum."
3. Reference the specific chapter, section, and concept in your answer.
4. Include relevant formulas when available.
5. Match the student's language — if they ask in Arabic, answer in Arabic.
6. Be educational and encouraging — you are a tutor, not a search engine.
7. If the student seems confused, offer to explain prerequisites first.

CURRICULUM CONTEXT:
{context}"""

RAG_PROMPT = ChatPromptTemplate.from_messages([
    ("system", RAG_SYSTEM),
    ("human", "{question}"),
])


class RAGEngine:
    """
    RAG Engine combining Qdrant vector search + Claude LLM.

    Flow:
    1. Student asks a question
    2. Qdrant finds the most relevant curriculum concepts
    3. Context is assembled from matched concepts
    4. Claude answers using ONLY the provided context
    5. Sources are tracked for transparency
    """

    def __init__(
        self,
        vector_store: CurriculumVectorStore | None = None,
        llm: ChatAnthropic | None = None,
    ):
        self.vector_store = vector_store or CurriculumVectorStore()

        self.llm = llm or ChatAnthropic(
            model=settings.LLM_MODEL,
            anthropic_api_key=settings.ANTHROPIC_API_KEY,
            max_tokens=2048,
            temperature=0.1,
        )

        self.chain = RAG_PROMPT | self.llm
        console.print("[bold green]✅ RAG Engine ready (Qdrant + Claude)[/]")

    def ask(self, question: str, top_k: int = 5, chapter_filter: int | None = None) -> dict:
        """
        Ask a question and get an answer grounded in the curriculum.

        Args:
            question: Student's question (English or Arabic).
            top_k: Number of concepts to retrieve.
            chapter_filter: Optional — restrict to specific chapter.

        Returns:
            Dict with 'answer', 'sources', and 'context'.
        """
        console.print(f"\n[bold cyan]Question:[/] {question}")

        # Step 1: Retrieve relevant context from Qdrant
        results = self.vector_store.search(question, top_k=top_k, chapter_filter=chapter_filter)
        context = self.vector_store.get_context_for_rag(question, top_k=top_k)

        # Step 2: Generate answer with Claude
        response = self.chain.invoke({
            "context": context,
            "question": question,
        })

        answer = response.content

        # Step 3: Format sources
        sources = [
            {
                "concept": r["concept_name"],
                "chapter": r["chapter_title"],
                "section": r["section_title"],
                "relevance": f"{r['score']:.2f}",
            }
            for r in results
        ]

        console.print(f"\n[bold green]Answer:[/]")
        console.print(answer)

        if sources:
            console.print(f"\n[dim]Sources:[/]")
            for s in sources:
                console.print(f"  - {s['concept']} ({s['chapter']} > {s['section']}) [{s['relevance']}]")

        return {
            "answer": answer,
            "sources": sources,
            "context_used": context,
        }

    def interactive_mode(self):
        """Start an interactive Q&A session."""
        console.print("\n[bold magenta]=========================================[/]")
        console.print("[bold magenta]  APEX Curriculum Q&A — Interactive Mode[/]")
        console.print("[bold magenta]  Type 'quit' to exit[/]")
        console.print("[bold magenta]=========================================[/]\n")

        while True:
            try:
                question = input("You: ").strip()
                if not question:
                    continue
                if question.lower() in ("quit", "exit", "q"):
                    console.print("[yellow]Goodbye![/]")
                    break

                self.ask(question)
                print()

            except KeyboardInterrupt:
                console.print("\n[yellow]Goodbye![/]")
                break


if __name__ == "__main__":
    engine = RAGEngine()
    engine.interactive_mode()
