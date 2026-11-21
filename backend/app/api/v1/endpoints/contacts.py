from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user_optional, get_current_user
from app.models.emergency_contact import EmergencyContact
from app.models.user import User
from app.schemas.contact import ContactCreate, ContactUpdate, ContactResponse

router = APIRouter()


@router.get(
    "/",
    response_model=List[ContactResponse],
    summary="List emergency contacts",
    description="Returns all emergency contacts for the authenticated user.",
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

    # Verify user exists
    user = db.query(User).filter(User.id == target_user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {target_user_id} does not exist.",
        )

    # If new contact is primary, unset previous primary contacts
    if contact_in.is_primary:
        db.query(EmergencyContact).filter(
            EmergencyContact.user_id == target_user_id,
            EmergencyContact.is_primary == True,
        ).update({"is_primary": False})

    contact = EmergencyContact(
        user_id=target_user_id,
        name=contact_in.name,
        phone_number=contact_in.phone_number,
        relationship_label=contact_in.relationship_label,
        email=contact_in.email,
        is_primary=contact_in.is_primary,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.delete(
    "/{contact_id}",
    status_code=status.HTTP_200_OK,
    summary="Remove an emergency contact",
    description="Removes an emergency contact by ID.",
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
