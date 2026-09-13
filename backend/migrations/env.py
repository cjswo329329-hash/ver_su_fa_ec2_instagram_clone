import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# backend 디렉토리를 sys.path에 추가하여 app 모듈 접근 가능하게 설정
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.config import settings
from app.database import Base
import app.models  # autogenerate를 위해 모든 모델 메타데이터 로드

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ORM 메타데이터 바인딩
target_metadata = Base.metadata


def get_url() -> str:
    """
    환경 변수 또는 settings.DATABASE_URL에서 동적으로 DB URL 취득.
    - CLI 옵션 지원:
      - alembic -x db=sqlite ...   (로컬 instagram.db 강제)
      - alembic -x url=<any_url>   (임의 DB URL 직접 지정)
    - 환경 변수: DATABASE_URL 환경 변수가 설정된 경우 최우선 적용
    - 기본: backend/.env 에 설정된 settings.DATABASE_URL 적용
    - Supabase / PostgreSQL: postgres:// 형식을 postgresql:// 로 자동 정규화
    """
    x_args = context.get_x_argument(as_dictionary=True)
    if "url" in x_args:
        return x_args["url"]
    if "db" in x_args:
        db_choice = x_args["db"].lower()
        if db_choice == "sqlite":
            sqlite_path = os.path.join(BACKEND_DIR, "instagram.db").replace("\\", "/")
            return f"sqlite:///{sqlite_path}"

    url = os.getenv("DATABASE_URL") or settings.DATABASE_URL
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    is_sqlite = url.startswith("sqlite")
    target_name = "Local SQLite" if is_sqlite else "Supabase PostgreSQL"
    print(f"[Alembic Offline] Target DB: {target_name}")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=is_sqlite,
        compare_type=not is_sqlite,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    url = get_url()
    is_sqlite = url.startswith("sqlite")
    target_name = "Local SQLite" if is_sqlite else "Supabase PostgreSQL"
    print(f"[Alembic Online] Target DB: {target_name}")

    configuration = config.get_section(config.config_ini_section, {}) or {}
    configuration["sqlalchemy.url"] = url

    connect_args = {}
    if is_sqlite:
        connect_args["check_same_thread"] = False

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=is_sqlite,
            compare_type=not is_sqlite,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
