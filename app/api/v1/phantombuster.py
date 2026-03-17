"""
Phantombuster API Router — Phase 4B.

Exposes Phantombuster agent and container management endpoints for the
Indo Aerial Systems platform.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.services.phantombuster_service import PhantombusterService

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
def list_agents(db: Session = Depends(get_db)) -> list:
    """Return all Phantombuster agents."""
    result = PhantombusterService(db).list_agents()
    # list_agents returns [] on error, not a not_configured dict — passthrough
    return result


@router.get("/agents/{agent_id}")
def get_agent(agent_id: str, db: Session = Depends(get_db)) -> dict:
    """Return details for a single Phantombuster agent."""
    result = PhantombusterService(db).get_agent(agent_id)
    return _check_configured(result)


@router.post("/agents/{agent_id}/launch")
def launch_agent(agent_id: str, body: LaunchRequest = LaunchRequest(), db: Session = Depends(get_db)) -> dict:
    """
    Launch a Phantombuster agent.

    Optionally pass ``{"argument": {...}}`` in the request body to override
    the agent's default arguments.
    """
    result = PhantombusterService(db).launch_agent(agent_id, argument=body.argument)
    return _check_configured(result)


@router.post("/agents/{agent_id}/abort")
def abort_agent(agent_id: str, db: Session = Depends(get_db)) -> dict:
    """Abort a currently-running Phantombuster agent."""
    result = PhantombusterService(db).abort_agent(agent_id)
    return _check_configured(result)


@router.get("/containers/{container_id}")
def get_container_output(container_id: str, db: Session = Depends(get_db)) -> dict:
    """Return the output/status of a Phantombuster container."""
    result = PhantombusterService(db).get_container_output(container_id)
    return _check_configured(result)


@router.get("/agents/{agent_id}/history")
def get_agent_history(agent_id: str) -> dict:
    """Placeholder — agent history retrieval is not yet implemented."""
    return {"message": "not implemented"}
