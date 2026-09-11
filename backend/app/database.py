from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.engine import Engine
from app.config import settings

class Base(DeclarativeBase):
    pass

# Supabase 또는 원격 PostgreSQL 주소가 postgres:// 로 시작할 경우 postgresql:// 로 정규화
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

is_sqlite = db_url.startswith("sqlite")

if is_sqlite:
    engine = create_engine(
        db_url,
        connect_args={
            "check_same_thread": False,  # 멀티스레드 FastAPI 지원
            "timeout": 15
        },
    )

    @event.listens_for(Engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        if is_sqlite:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.execute("PRAGMA cache_size=-64000")
            cursor.close()
else:
    # Supabase / PostgreSQL 클라우드 DB 연결 최적화
    engine = create_engine(
        db_url,
        pool_pre_ping=True,  # 원격 DB 유휴 연결 자동 복구
        pool_size=10,
        max_overflow=20,
        pool_recycle=300,    # 5분 주기 커넥션 갱신
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
