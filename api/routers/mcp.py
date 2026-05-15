"""
APEX — MCP Agent Router
Endpoints: tools schema, execute tool, coach prompt
"""

from fastapi import APIRouter
from api.utils import DB_PATH
from src.mcp_agent import MCPAgent

router = APIRouter(prefix="/api/mcp", tags=["MCP Agent"])


@router.get("/tools")
def api_mcp_tools():
    agent = MCPAgent(DB_PATH)
    return {"tools": agent.get_tools_schema()}


@router.post("/execute")
def api_mcp_execute(data: dict):
    tool_name = data.get("tool", "")
    params = data.get("params", {})
    agent = MCPAgent(DB_PATH)
    return agent.execute_tool(tool_name, params)


@router.get("/coach-prompt/{student_id}")
def api_coach_prompt(student_id: str):
    agent = MCPAgent(DB_PATH)
    prompt = agent.build_system_prompt(student_id)
    return {"system_prompt": prompt, "student_id": student_id}
