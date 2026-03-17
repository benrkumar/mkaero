"""
Phantombuster API Router — Phase 4B.

Exposes Phantombuster agent and container management endpoints for the
Indo Aerial Systems platform.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.phantombuster_service import phantombuster_service

router = APIRouter(prefix="/phantombuster", tags=["Phantombuster"])

NOT_CONFIGURED = {"status": "not_configured"}


def _check_configured(result: dict) -> dict:
    """Raise 503 if phantombuster_service returned a not_configured sentinel."""
    if result == NOT_CONFIGURED:
        raise HTTPException(status_code=503, detail="Phantombuster not configured")
    return result


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class LaunchRequest(BaseModel):
    argument: Optional[dict] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/agents")
def list_agents() -> list:
    """Return all Phantombuster agents."""
    result = phantombuster_service.list_agents()
    # list_agents returns [] on error, not a not_configured dict — passthrough
    return result


@router.get("/agents/{agent_id}")
def get_agent(agent_id: str) -> dict:
    """Return details for a single Phantombuster agent."""
    result = phantombuster_service.get_agent(agent_id)
    return _check_configured(result)


@router.post("/agents/{agent_id}/launch")
def launch_agent(agent_id: str, body: LaunchRequest = LaunchRequest()) -> dict:
    """
    Launch a Phantombuster agent.

    Optionally pass ``{"argument": {...}}`` in the request body to override
    the agent's default arguments.
    """
    result = phantombuster_service.launch_agent(agent_id, argument=body.argument)
    return _check_configured(result)


@router.post("/agents/{agent_id}/abort")
def abort_agent(agent_id: str) -> dict:
    """Abort a currently-running Phantombuster agent."""
    result = phantombuster_service.abort_agent(agent_id)
    return _check_configured(result)


@router.get("/containers/{container_id}")
def get_container_output(container_id: str) -> dict:
    """Return the output/status of a Phantombuster container."""
    result = phantombuster_service.get_container_output(container_id)
    return _check_configured(result)


@router.get("/agents/{agent_id}/history")
def get_agent_history(agent_id: str) -> dict:
    """Placeholder — agent history retrieval is not yet implemented."""
    return {"message": "not implemented"}
