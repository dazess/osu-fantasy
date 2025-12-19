from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
import httpx
import os
from urllib.parse import urlencode
from dotenv import load_dotenv
import secrets

load_dotenv()

app = FastAPI()

# 配置 CORS，允许 React 前端访问
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],  # Vite 默认端口
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CLIENT_ID = os.getenv("OSU_CLIENT_ID")
CLIENT_SECRET = os.getenv("OSU_CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI")
AUTH_URL = "https://osu.ppy.sh/oauth/authorize"
TOKEN_URL = "https://osu.ppy.sh/oauth/token"
SCOPES = "public identify"

# cookie behavior: in development (localhost) we may need secure=False
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
ACCESS_TOKEN_MAX_AGE = int(os.getenv("ACCESS_TOKEN_MAX_AGE", 3600))  # default 1 hour
REFRESH_TOKEN_MAX_AGE = int(os.getenv("REFRESH_TOKEN_MAX_AGE", 14 * 24 * 3600))  # default 14 days

@app.get("/auth/login")
async def login():
    """生成 osu! 授权链接并重定向用户"""
    params = {
        "response_type": "code",
        "client_id": CLIENT_ID,
    }
    auth_url = f"{AUTH_URL}?{urlencode(params)}"
    return RedirectResponse(auth_url)

@app.get("/auth/callback")
async def auth_callback(code: str, state: str = None):
    """处理 osu! 的回调，用授权码换取访问令牌，并将令牌写入 HttpOnly cookies"""
    print(f"Received code: {code}, state: {state}")
    if not code:
        raise HTTPException(status_code=400, detail="缺少授权码")
    
    # 准备请求数据
    token_data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
    }
    
    # 向 osu! 请求访问令牌
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                TOKEN_URL,
                data=token_data,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                token_info = response.json()
                access_token = token_info.get("access_token")
                refresh_token = token_info.get("refresh_token")
                expires_in = int(token_info.get("expires_in") or ACCESS_TOKEN_MAX_AGE)

                # CSRF token (double submit cookie pattern)
                csrf_token = secrets.token_urlsafe(16)

                resp = JSONResponse({"success": True})
                # Set HttpOnly cookies for tokens
                resp.set_cookie(
                    key="access_token",
                    value=access_token,
                    httponly=True,
                    secure=COOKIE_SECURE,
                    samesite="lax",
                    max_age=expires_in,
                    path="/",
                )
                resp.set_cookie(
                    key="refresh_token",
                    value=refresh_token,
                    httponly=True,
                    secure=COOKIE_SECURE,
                    samesite="lax",
                    max_age=REFRESH_TOKEN_MAX_AGE,
                    path="/",
                )
                # Set CSRF cookie (readable by JS)
                resp.set_cookie(
                    key="csrf_token",
                    value=csrf_token,
                    httponly=False,
                    secure=COOKIE_SECURE,
                    samesite="lax",
                    max_age=REFRESH_TOKEN_MAX_AGE,
                    path="/",
                )

                return resp
            else:
                error_detail = response.json().get("error_description", "未知错误")
                raise HTTPException(status_code=400, detail=f"令牌请求失败: {error_detail}")
                
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"网络请求错误: {str(e)}")
    

@app.post("/auth/refresh")
async def refresh_token(request: Request):
    """使用 HttpOnly 刷新令牌 cookie 获取新的访问令牌，并更新 access_token cookie。需要校验 CSRF 令牌。"""
    refresh_token = request.cookies.get("refresh_token")
    csrf_cookie = request.cookies.get("csrf_token")
    csrf_header = request.headers.get("x-csrf-token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="缺少刷新令牌")
    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        raise HTTPException(status_code=403, detail="CSRF token mismatch")

    refresh_data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "scope": SCOPES
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            TOKEN_URL,
            data=refresh_data,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded"
            }
        )
        
        if response.status_code == 200:
            token_info = response.json()
            access_token = token_info.get("access_token")
            expires_in = int(token_info.get("expires_in") or ACCESS_TOKEN_MAX_AGE)
            resp = JSONResponse({"success": True})
            resp.set_cookie(
                key="access_token",
                value=access_token,
                httponly=True,
                secure=COOKIE_SECURE,
                samesite="lax",
                max_age=expires_in,
                path="/",
            )
            return resp
        else:
            raise HTTPException(status_code=400, detail="令牌刷新失败")

@app.get("/api/user")
async def get_current_user(request: Request):
    """使用存储在 HttpOnly cookie 中的访问令牌获取当前用户信息（示例API调用）"""
    # 优先检查 Authorization header（Bearer），否则使用 cookie
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    else:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="缺少访问令牌")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://osu.ppy.sh/api/v2/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch user info")

@app.post("/auth/logout")
async def logout():
    resp = JSONResponse({"success": True})
    # Clear cookies
    resp.delete_cookie("access_token", path="/")
    resp.delete_cookie("refresh_token", path="/")
    resp.delete_cookie("csrf_token", path="/")
    return resp
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)