import os
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base, SessionLocal
import app.models  # load all models for metadata
from app.models.user import User
from app.core.security import get_password_hash
from app.routers import (
    auth_router,
    users_router,
    posts_router,
    comments_router,
    reels_router,
    explore_router,
    direct_router,
    stories_router,
    bookmarks_router,
    follows_router,
    notifications_router,
    uploads_router,
    admin_router,
    views_router,
    reports_router,
    recommendations_router,
)

# 데이터베이스 테이블 자동 생성
Base.metadata.create_all(bind=engine)

def init_db_and_admin():
    """
    데이터베이스 스키마 마이그레이션 및 기본 관리자 계정 초기화 (SQLite / PostgreSQL 공통 호환)
    아이디: admin / 비밀번호: pass123
    """
    with engine.connect() as conn:
        from sqlalchemy import text, inspect
        try:
            inspector = inspect(conn)
            table_names = inspector.get_table_names()
            if "users" in table_names:
                columns = [col["name"] for col in inspector.get_columns("users")]
                if "is_admin" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE"))
                    conn.commit()
                if "is_suspended" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_suspended BOOLEAN NOT NULL DEFAULT FALSE"))
                    conn.commit()
                if "suspension_reason" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN suspension_reason VARCHAR(255)"))
                    conn.commit()

            if "posts" in table_names:
                p_columns = [col["name"] for col in inspector.get_columns("posts")]
                if "category" not in p_columns:
                    conn.execute(text("ALTER TABLE posts ADD COLUMN category VARCHAR(50)"))
                    conn.commit()

            if "reels" in table_names:
                r_columns = [col["name"] for col in inspector.get_columns("reels")]
                if "category" not in r_columns:
                    conn.execute(text("ALTER TABLE reels ADD COLUMN category VARCHAR(50)"))
                    conn.commit()
                if "duration_ms" not in r_columns:
                    conn.execute(text("ALTER TABLE reels ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 15000"))
                    conn.commit()
        except Exception as e:
            print(f"[WARN] 테이블 스키마 검사 중 예외: {e}")

    # SECRET_KEY 기본값 점검
    if settings.SECRET_KEY == "supersecret_jwt_key_change_me_in_production":
        print("[SECURITY WARNING] 기본 SECRET_KEY가 사용 중입니다. .env 파일에서 강력한 비밀키로 교체하십시오.")

    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.username == "admin").first()
        initial_admin_pass = getattr(settings, "INITIAL_ADMIN_PASSWORD", "pass123")
        if initial_admin_pass == "pass123":
            print("[SECURITY WARNING] 기본 관리자 비밀번호('pass123')가 설정되어 있습니다. 반드시 환경변수를 통해 변경하십시오.")

        if not admin_user:
            admin_user = User(
                username="admin",
                email="admin@instagram.local",
                hashed_password=get_password_hash(initial_admin_pass),
                full_name="시스템 관리자",
                bio="Instagram 시스템 최고 관리자 계정",
                profile_image_url="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
                is_private=False,
                is_verified=True,
                is_admin=True,
            )
            db.add(admin_user)
            db.commit()
            print("[INFO] 관리자 계정(admin)이 새로 생성되었습니다.")
        else:
            # 기존 관리자 계정은 권한만 보장하고, 비밀번호는 절대 덮어쓰지 않음 (보안 패치)
            if not admin_user.is_admin:
                admin_user.is_admin = True
                db.commit()
                print("[INFO] 관리자 계정(admin) 관리자 권한이 갱신되었습니다.")

        # 활성 데모 스토리 자동 유지 (만료되지 않은 24시간 스토리 보장)
        from datetime import datetime, timedelta
        from app.models.story import Story
        now = datetime.utcnow()
        active_story_count = db.query(Story).filter(Story.expires_at > now).count()
        if active_story_count < 5:
            # 주요 크리에이터 유저(김민준, 이서준, 박도윤, 최예준, 강하준, 윤지호 등)에게 24시간 스토리 보충
            sample_stories = [
                (3, "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=900", "image"),
                (4, "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900", "image"),
                (5, "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900", "image"),
                (6, "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=900", "image"),
                (8, "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=900", "image"),
                (10, "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=900", "image"),
            ]
            expires = now + timedelta(hours=24)
            for uid, url, mtype in sample_stories:
                u_exists = db.query(User).filter(User.id == uid).first()
                if u_exists:
                    has_active = db.query(Story).filter(Story.user_id == uid, Story.expires_at > now).first()
                    if not has_active:
                        st = Story(user_id=uid, media_url=url, media_type=mtype, expires_at=expires)
                        db.add(st)
            db.commit()
            print("[INFO] 팔로잉 크리에이터들의 24시간 활성 스토리가 성공적으로 시딩되었습니다.")
    except Exception as e:
        print(f"[WARN] 관리자 계정 초기화 중 예외: {e}")
        db.rollback()
    finally:
        db.close()

init_db_and_admin()

# 미디어 업로드 폴더 생성
for category in ["posts", "reels", "profiles", "stories", "direct"]:
    os.makedirs(os.path.join(settings.UPLOAD_DIR, category), exist_ok=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Instagram Clone Backend REST API with FastAPI, Supabase, and EC2",
    version="1.0.0",
)

# CORS 설정 (로컬 개발 환경 및 Vercel 배포 도메인만 엄격 허용 - 와일드카드 credentials 차단)
cors_origins = list(settings.BACKEND_CORS_ORIGINS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https:\/\/([a-zA-Z0-9_\-]+\.)*vercel\.app$",  # Vercel 프리뷰 및 프로덕션 도메인만 허용
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# 정적 업로드 파일 서빙
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# 정적 비디오 파일 서빙 (릴스 비디오 로컬 호스팅 지원)
videos_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "videos"))
if os.path.exists(videos_dir):
    app.mount("/videos", StaticFiles(directory=videos_dir), name="videos")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    from fastapi.encoders import jsonable_encoder
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "status_code": 422,
            "error": "UNPROCESSABLE_ENTITY",
            "message": "요청 데이터의 유효성 검사에 실패했습니다.",
            "detail": jsonable_encoder(exc.errors()),
        },
    )

# API 라우터 등록 (전체 12개 라우터)
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(posts_router, prefix="/api")
app.include_router(comments_router, prefix="/api")
app.include_router(reels_router, prefix="/api")
app.include_router(explore_router, prefix="/api")
app.include_router(direct_router, prefix="/api")
app.include_router(stories_router, prefix="/api")
app.include_router(bookmarks_router, prefix="/api")
app.include_router(follows_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(uploads_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(views_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(recommendations_router, prefix="/api")

@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "version": "1.0.0"
    }

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
