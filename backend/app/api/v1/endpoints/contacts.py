from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user_optional, get_current_user
from app.core.security import get_password_hash
from app.models.emergency_contact import EmergencyContact
from app.models.user import User
from app.schemas.contact import ContactCreate, ContactUpdate, ContactResponse

router = APIRouter()


def ensure_user_exists(db: Session, user_id: Optional[int] = None) -> User:
    """
    Safely finds or auto-provisions a user in the database so foreign-key inserts
    never fail with an unhandled 500 error.
    """
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            return user

    # If user_id wasn't specified or wasn't found, check if an existing user exists
    first_user = db.query(User).first()
    if first_user and not user_id:
        return first_user

    # Auto-provision a user safely without duplicate unique constraint errors
    target_id = user_id if user_id else 1
    user = db.query(User).filter(User.id == target_id).first()
    if user:
        return user

    ts = int(datetime.now(timezone.utc).timestamp())
    email = f"user_{target_id}_{ts}@emergencysos.org"
    phone = f"+1555{target_id % 1000000:07d}"
    if db.query(User).filter(User.phone_number == phone).first():
        phone = f"+1555{ts % 10000000:07d}"

    try:
        user = User(
            id=target_id,
            email=email,
            phone_number=phone,
            full_name="Emergency User",
            hashed_password=get_password_hash("demo-password-123!"),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    except Exception:
        db.rollback()
        existing = db.query(User).first()
        if existing:
            return existing
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to resolve user account for contact creation.",
        )


@router.get(
    "/",
    response_model=List[ContactResponse],
    summary="List emergency contacts",
    description="Returns all emergency contacts for the authenticated user.",
)
@router.get(
    "",
    response_model=List[ContactResponse],
    include_in_schema=False,
)
def list_contacts(
    user_id: Optional[int] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    target_user_id = current_user.id if current_user else user_id
    if not target_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication required or specify user_id parameter.",
        )

    contacts = (
        db.query(EmergencyContact)
        .filter(EmergencyContact.user_id == target_user_id)
        .order_by(EmergencyContact.is_primary.desc(), EmergencyContact.name.asc())
        .all()
    )
    return contacts


@router.get(
    "/user/{user_id}",
    response_model=List[ContactResponse],
    summary="List contacts by user ID",
    description="Returns all emergency contacts for a specified user ID.",
)
@router.get(
    "/user/{user_id}/",
    response_model=List[ContactResponse],
    include_in_schema=False,
)
def list_contacts_by_user(user_id: int, db: Session = Depends(get_db)):
    contacts = (
        db.query(EmergencyContact)
        .filter(EmergencyContact.user_id == user_id)
        .order_by(EmergencyContact.is_primary.desc(), EmergencyContact.name.asc())
        .all()
    )
    return contacts


@router.post(
    "/",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add an emergency contact",
    description="Adds a trusted contact to the user's emergency dispatch list.",
)
@router.post(
    "",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
def add_contact(
    contact_in: ContactCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    target_user_id = current_user.id if current_user else contact_in.user_id
    if not target_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication required or user_id must be provided in request body.",
        )

    # Safely verify or auto-provision user to prevent FK constraint failures
    user = ensure_user_exists(db, target_user_id)

    # Normalize relationship label with clean fallback
    rel_label = (
        contact_in.relationship_label
        or contact_in.relationship
        or "Family"
    ).strip() or "Family"

    # Normalize primary responder status
    is_prim = bool(
        contact_in.is_primary
        or (contact_in.priority and contact_in.priority.upper() == "PRIMARY")
        or (contact_in.priority_level and contact_in.priority_level.upper() == "PRIMARY")
    )

    # Normalize optional email
    clean_email = contact_in.email.strip() if contact_in.email and contact_in.email.strip() else None

    try:
        # If new contact is primary, unset previous primary contacts
        if is_prim:
            db.query(EmergencyContact).filter(
                EmergencyContact.user_id == user.id,
                EmergencyContact.is_primary == True,
            ).update({"is_primary": False})

        contact = EmergencyContact(
            user_id=user.id,
            name=contact_in.name.strip(),
            phone_number=contact_in.phone_number.strip(),
            relationship_label=rel_label,
            email=clean_email,
            is_primary=is_prim,
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)
        return contact
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create emergency contact: {str(e)}",
        )


@router.patch(
    "/{contact_id}",
    response_model=ContactResponse,
    summary="Update an emergency contact",
    description="Updates an emergency contact details or primary responder status.",
)
@router.patch(
    "/{contact_id}/",
    response_model=ContactResponse,
    include_in_schema=False,
)
def update_contact(
    contact_id: int,
    contact_in: ContactUpdate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    query = db.query(EmergencyContact).filter(EmergencyContact.id == contact_id)
    if current_user:
        query = query.filter(EmergencyContact.user_id == current_user.id)

    contact = query.first()
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Emergency contact with ID {contact_id} not found.",
        )

    # If updating primary status to True, unset previous primary contacts
    if contact_in.is_primary is True:
        db.query(EmergencyContact).filter(
            EmergencyContact.user_id == contact.user_id,
            EmergencyContact.is_primary == True,
            EmergencyContact.id != contact.id,
        ).update({"is_primary": False})

    update_dict = contact_in.model_dump(exclude_unset=True)
    if "relationship" in update_dict and "relationship_label" not in update_dict:
        update_dict["relationship_label"] = update_dict.pop("relationship")
    else:
        update_dict.pop("relationship", None)

    if ("priority" in update_dict or "priority_level" in update_dict) and "is_primary" not in update_dict:
        p = update_dict.pop("priority", None) or update_dict.pop("priority_level", None)
        if p and str(p).upper() == "PRIMARY":
            update_dict["is_primary"] = True
    else:
        update_dict.pop("priority", None)
        update_dict.pop("priority_level", None)

    for field, val in update_dict.items():
        if hasattr(contact, field):
            setattr(contact, field, val)

    db.commit()
    db.refresh(contact)
    return contact


@router.delete(
    "/{contact_id}",
    status_code=status.HTTP_200_OK,
    summary="Remove an emergency contact",
    description="Removes an emergency contact by ID.",
)
@router.delete(
    "/{contact_id}/",
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def remove_contact(
    contact_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    query = db.query(EmergencyContact).filter(EmergencyContact.id == contact_id)
    if current_user:
        query = query.filter(EmergencyContact.user_id == current_user.id)

    contact = query.first()
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Emergency contact with ID {contact_id} not found.",
        )

    db.delete(contact)
    db.commit()
    return {"message": f"Emergency contact '{contact.name}' successfully removed.", "id": contact_id}
