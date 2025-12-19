from pydantic import BaseModel
from typing import Optional


class UserCreate(BaseModel):
    username: str
    email: Optional[str] = None
    password: str


class UserRead(BaseModel):
    id: int
    username: str
    email: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class Login(BaseModel):
    username: str
    password: str
