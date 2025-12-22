from datetime import datetime
from sqlmodel import SQLModel, Field
from typing import Optional


class User(SQLModel, table=True):
    __tablename__ = "users"
    
    osu_id: int = Field(primary_key=True)
    username: str = Field(index=True)
    avatar_url: Optional[str] = None
    score: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
