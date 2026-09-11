import os
import uuid
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, status
from app.config import settings
from app.models.user import User
from app.core.deps import get_current_user

router = APIRouter(prefix="/uploads", tags=["Uploads"])

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB

IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".jfif", ".png", ".webp", ".gif",
    ".avif", ".bmp", ".heic", ".heif", ".svg"
}
VIDEO_EXTENSIONS = {
    ".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"
}
ALLOWED_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS

CONTENT_TYPE_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/pjpeg": ".jpg",
    "image/jfif": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
    "image/bmp": ".bmp",
    "image/svg+xml": ".svg",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "video/x-msvideo": ".avi",
    "video/x-matroska": ".mkv",
}

@router.post("/media")
async def upload_media(
    file: UploadFile = File(...),
    category: str = Form("posts"),  # 'posts', 'reels', 'profiles', 'stories', 'direct'
    current_user: User = Depends(get_current_user)
):
    valid_categories = ["posts", "reels", "profiles", "stories", "direct", "post", "reel", "profile", "story"]
    if category not in valid_categories:
        category = "posts"
    
    # 복수형 통일
    cat_dir = category if category.endswith("s") else f"{category}s"
    if cat_dir == "storys":
        cat_dir = "stories"
    if cat_dir in ["directs", "direct"]:
        cat_dir = "direct"


    # 확장자 검증
    orig_name = file.filename or ""
    ext = os.path.splitext(orig_name)[1].lower()

    # 파일 확장자가 없는 경우 content_type을 기반으로 확장자 유추
    if not ext and file.content_type:
        ext = CONTENT_TYPE_TO_EXT.get(file.content_type.lower(), "")

    if ext not in ALLOWED_EXTENSIONS:
        supported_str = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"허용되지 않는 파일 형식입니다. (현재 확장자: {ext or '없음'}, 지원 형식: {supported_str})"
        )

    # 내용 및 크기 검증
    content = await file.read()
    if not content or len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="0바이트 빈 파일은 업로드할 수 없습니다."
        )
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="파일 크기는 최대 25MB까지 허용됩니다."
        )

    target_dir = os.path.join(settings.UPLOAD_DIR, cat_dir)
    os.makedirs(target_dir, exist_ok=True)

    # jfif, jpeg 등은 브라우저 호환성을 위해 .jpg로 표준화하여 저장
    save_ext = ".jpg" if ext in {".jfif", ".jpeg"} else ext
    unique_filename = f"{uuid.uuid4().hex}{save_ext}"
    file_path = os.path.join(target_dir, unique_filename)

    with open(file_path, "wb") as buffer:
        buffer.write(content)

    media_url = (
        f"{settings.PUBLIC_BASE_URL.rstrip('/')}/uploads/{cat_dir}/{unique_filename}"
        if settings.PUBLIC_BASE_URL
        else f"/uploads/{cat_dir}/{unique_filename}"
    )
    media_type = "video" if ext in VIDEO_EXTENSIONS else "image"
    return {
        "url": media_url,
        "filename": unique_filename,
        "media_type": media_type
    }
