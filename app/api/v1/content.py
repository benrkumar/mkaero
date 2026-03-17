from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.models.contact import Contact
from app.models.sequence_step import SequenceStep
from app.schemas.content import ContentPreviewRequest, EmailContentOut, LinkedInContentOut, RegenerateRequest
from app.services.content_service import ContentService

router = APIRouter()


class RenderPreviewRequest(BaseModel):
    subject_template: str = ""
    body_template: str = ""

class RenderPreviewOut(BaseModel):
    subject: str
    body_text: str
    body_html: str

@router.post("/render-preview", response_model=RenderPreviewOut)
def render_preview(body: RenderPreviewRequest):
    from app.services.email_service import render_html_body

    sample = {
        "first_name": "Alex", "last_name": "Chen", "company": "Acme Corp",
        "title": "Head of Operations", "city": "Mumbai", "industry": "Manufacturing"
    }

    def render(template: str) -> str:
        result = template or ""
        for k, v in sample.items():
            result = result.replace("{{" + k + "}}", v)
        return result

    subject = render(body.subject_template)
    body_text = render(body.body_template)
    html_body = render_html_body(body_text)

    return RenderPreviewOut(subject=subject, body_text=body_text, body_html=html_body)


@router.post("/preview/email", response_model=EmailContentOut)
def preview_email(body: ContentPreviewRequest, db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == body.contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    try:
        content_service = ContentService(db)
        result = content_service.generate_email(contact, body.step_number, body.campaign_goal)
        return EmailContentOut(**result)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Content generation failed: {exc}")


@router.post("/preview/linkedin", response_model=LinkedInContentOut)
def preview_linkedin(body: ContentPreviewRequest, db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == body.contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    try:
        content_service = ContentService(db)
        msg = content_service.generate_linkedin_message(
            contact,
            "connection_request" if body.step_number == 1 else "follow_up",
        )
        return LinkedInContentOut(message=msg)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Content generation failed: {exc}")


@router.post("/regenerate")
def regenerate_step(body: RegenerateRequest, db: Session = Depends(get_db)):
    step = db.query(SequenceStep).filter(SequenceStep.id == body.step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    contact = db.query(Contact).filter(Contact.id == body.contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    try:
        content_service = ContentService(db)
        if step.channel == "email":
            result = content_service.generate_email(contact, step.step_order)
            step.subject_template = result["subject"]
            step.body_template = result["body"]
            db.commit()
            return {"subject": step.subject_template, "body": step.body_template}
        else:
            msg = content_service.generate_linkedin_message(
                contact,
                "connection_request" if step.step_order == 1 else "follow_up",
            )
            step.linkedin_message_template = msg
            db.commit()
            return {"message": msg}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Regeneration failed: {exc}")
