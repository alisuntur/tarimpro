from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from db.repositories import get_user_by_session_token_hash, touch_user_session
from security import hash_session_token

security = HTTPBearer(auto_error=False)


def get_optional_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None

    token_hash = hash_session_token(credentials.credentials)
    user = get_user_by_session_token_hash(token_hash)
    if not user:
        return None

    touch_user_session(token_hash)
    return user


def require_current_user(user=Depends(get_optional_current_user)):
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Oturum gerekli. Lütfen tekrar giriş yapın.",
        )
    return user
