from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, require_admin
from app.models.prompt import Prompt
from app.models.user import User
from app.schemas.prompt import PromptCreate, PromptOut, PromptUpdate

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.get("", response_model=list[PromptOut])
def list_prompts(
    category: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Prompt).filter(Prompt.is_active == True)
    if category:
        query = query.filter(Prompt.category == category)
    return query.order_by(Prompt.sort_order, Prompt.id).all()


@router.get("/categories")
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.query(Prompt.category).filter(
        Prompt.is_active == True, Prompt.category != None
    ).distinct().all()
    return [r[0] for r in rows if r[0]]


@router.post("", response_model=PromptOut, status_code=status.HTTP_201_CREATED)
def create_prompt(
    body: PromptCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    prompt = Prompt(**body.model_dump(), created_by=admin.id)
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return prompt


@router.put("/{prompt_id}", response_model=PromptOut)
def update_prompt(
    prompt_id: int,
    body: PromptUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt 不存在")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(prompt, k, v)
    db.commit()
    db.refresh(prompt)
    return prompt


@router.delete("/{prompt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prompt(
    prompt_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt 不存在")
    db.delete(prompt)
    db.commit()
