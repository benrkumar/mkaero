from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.models.sequence_step import SequenceStep
from app.schemas.campaign import SequenceStepCreate, SequenceStepOut, SequenceStepUpdate

router = APIRouter()


@router.get("/campaigns/{campaign_id}/steps", response_model=list[SequenceStepOut])
def get_steps(campaign_id: str, db: Session = Depends(get_db)):
    return (
        db.query(SequenceStep)
        .filter(SequenceStep.campaign_id == campaign_id)
        .order_by(SequenceStep.step_order)
        .all()
    )


@router.post("/campaigns/{campaign_id}/steps", response_model=SequenceStepOut, status_code=201)
def add_step(campaign_id: str, body: SequenceStepCreate, db: Session = Depends(get_db)):
    step = SequenceStep(campaign_id=campaign_id, **body.model_dump())
    db.add(step)
    db.commit()
    db.refresh(step)
    return step


@router.patch("/{step_id}", response_model=SequenceStepOut)
def update_step(step_id: str, body: SequenceStepUpdate, db: Session = Depends(get_db)):
    step = db.query(SequenceStep).filter(SequenceStep.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(step, field, value)
    db.commit()
    db.refresh(step)
    return step


@router.delete("/{step_id}", status_code=204)
def delete_step(step_id: str, db: Session = Depends(get_db)):
    step = db.query(SequenceStep).filter(SequenceStep.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    db.delete(step)
    db.commit()
