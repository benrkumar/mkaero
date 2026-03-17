import csv
import io

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api.v1.deps import get_db
from app.models.contact import Contact
from app.schemas.contact import ContactCreate, ContactList, ContactOut, ContactUpdate

router = APIRouter()


@router.get("/tags", response_model=List[str])
def get_all_tags(db: Session = Depends(get_db)):
    """Return all unique tags across all contacts."""
    contacts = db.query(Contact.tags).all()
    all_tags: set = set()
    for (tags,) in contacts:
        if tags and isinstance(tags, list):
            all_tags.update(tags)
    return sorted(all_tags)


@router.get("", response_model=ContactList)
def list_contacts(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    search: Optional[str] = None,
    tag: Optional[str] = None,
    has_linkedin: Optional[bool] = None,
    has_email: Optional[bool] = None,
    industry: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Contact)
    if status:
        q = q.filter(Contact.status == status)
    if search:
        term = f"%{search}%"
        q = q.filter(
            Contact.email.ilike(term)
            | Contact.first_name.ilike(term)
            | Contact.last_name.ilike(term)
            | Contact.company.ilike(term)
        )
    if tag:
        # SQLite stores JSON as text; tag name is JSON-encoded in the array
        import json
        q = q.filter(Contact.tags.like(f'%{json.dumps(tag)}%'))
    if has_linkedin is True:
        q = q.filter(Contact.linkedin_url != "", Contact.linkedin_url.isnot(None))
    if has_linkedin is False:
        q = q.filter((Contact.linkedin_url == "") | Contact.linkedin_url.is_(None))
    if has_email is True:
        q = q.filter(Contact.email != "", Contact.email.isnot(None))
    if industry:
        q = q.filter(Contact.industry.ilike(f"%{industry}%"))
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return ContactList(items=items, total=total, page=page, page_size=page_size)


@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(contact_id: str, db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.post("", response_model=ContactOut, status_code=201)
def create_contact(body: ContactCreate, db: Session = Depends(get_db)):
    existing = db.query(Contact).filter(Contact.email == body.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Contact with this email already exists")
    contact = Contact(**body.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(contact_id: str, body: ContactUpdate, db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact


@router.post("/{contact_id}/tags", response_model=ContactOut)
def add_tags(contact_id: str, body: dict, db: Session = Depends(get_db)):
    """Add tags to a contact. Body: {"tags": ["tag1", "tag2"]}"""
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    new_tags = body.get("tags", [])
    existing = list(contact.tags or [])
    combined = list(set(existing + new_tags))
    contact.tags = combined
    db.commit()
    db.refresh(contact)
    return contact


@router.post("/bulk/tag")
def bulk_tag_contacts(body: dict, db: Session = Depends(get_db)):
    """Bulk add a tag to multiple contacts. Body: {"contact_ids": [...], "tag": "tagname"}"""
    contact_ids = body.get("contact_ids", [])
    tag = body.get("tag", "")
    if not tag:
        raise HTTPException(status_code=400, detail="Tag is required")
    updated = 0
    for cid in contact_ids:
        contact = db.query(Contact).filter(Contact.id == cid).first()
        if contact:
            existing = list(contact.tags or [])
            if tag not in existing:
                existing.append(tag)
                contact.tags = existing
                updated += 1
    db.commit()
    return {"updated": updated}


@router.post("/upload/preview")
async def upload_csv_preview(file: UploadFile = File(...)):
    """Preview first 5 rows of a CSV upload and return headers."""
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    rows = []
    for i, row in enumerate(reader):
        if i >= 5:
            break
        rows.append(dict(row))
    return {"headers": headers, "preview_rows": rows}


@router.post("/upload/csv")
async def upload_csv(
    file: UploadFile = File(...),
    column_mapping: str = Form("{}"),
    import_tag: str = Form(""),
    db: Session = Depends(get_db),
):
    """Upload CSV with column mapping. column_mapping is JSON: {"csv_col": "contact_field", ...}"""
    import json as json_mod

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    try:
        mapping = json_mod.loads(column_mapping)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid column_mapping JSON")

    valid_fields = {"first_name", "last_name", "email", "company", "title", "industry", "linkedin_url", "city", "country"}
    imported = 0
    skipped = 0
    errors = []

    for row_num, row in enumerate(reader, start=2):
        mapped: dict = {}
        for csv_col, contact_field in mapping.items():
            if contact_field in valid_fields and csv_col in row:
                mapped[contact_field] = (row[csv_col] or "").strip()

        email = mapped.get("email", "").strip()
        if not email:
            skipped += 1
            continue

        existing = db.query(Contact).filter(Contact.email == email).first()
        if existing:
            skipped += 1
            continue

        try:
            tags = [import_tag] if import_tag else []
            contact = Contact(
                first_name=mapped.get("first_name", ""),
                last_name=mapped.get("last_name", ""),
                email=email,
                company=mapped.get("company", ""),
                title=mapped.get("title", ""),
                industry=mapped.get("industry", ""),
                linkedin_url=mapped.get("linkedin_url", ""),
                city=mapped.get("city", ""),
                country=mapped.get("country", ""),
                tags=tags,
            )
            db.add(contact)
            imported += 1
        except Exception as exc:
            errors.append(f"Row {row_num}: {str(exc)}")

    db.commit()
    return {"imported": imported, "skipped": skipped, "errors": errors}


@router.delete("/{contact_id}", status_code=204)
def delete_contact(contact_id: str, db: Session = Depends(get_db)):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
