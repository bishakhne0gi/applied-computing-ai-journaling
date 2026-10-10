from pydantic import BaseModel


class LanguageOut(BaseModel):
    code: str
    name: str
