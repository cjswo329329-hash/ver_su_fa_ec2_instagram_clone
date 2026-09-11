"""
scrape_160_shorts_to_supabase.py
=============================================================================
16대 카테고리 x 10개 = 총 160개의 실제 고화질 숏폼 실사 비디오를
유튜브 쇼츠에서 정밀 검색 및 다운로드하여 Supabase Storage에 일괄 업로드하고,
Supabase DB reels 테이블의 캡션 및 메타데이터를 실제 실사 정보로 완벽 동기화합니다.
=============================================================================
"""

import os
import sys
import time
import re
import imageio_ffmpeg
import yt_dlp

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.config import settings
from app.database import SessionLocal
from app.models import Reel
from supabase import create_client

# 16대 카테고리 및 정밀 검색 쿼리
CATEGORIES_SEARCH = [
    ("fitness", "workout gym fitness motivation #shorts"),
    ("tech", "coding programming software developer #shorts"),
    ("finance", "investing stock market money tips #shorts"),
    ("knowledge_daily", "life hacks daily productivity routine #shorts"),
    ("cafe", "latte art coffee cafe barista #shorts"),
    ("travel", "travel vlog beautiful scenery landscape #shorts"),
    ("fashion", "streetwear outfit ootd aesthetic #shorts"),
    ("food", "delicious cooking recipe food steak #shorts"),
    ("pets", "funny cute kitten puppy pet animal #shorts"),
    ("art", "satisfying drawing painting art timelapse #shorts"),
    ("comedy", "funny comedy sketch meme relatable #shorts"),
    ("celebrity", "kpop dance practice concert live #shorts"),
    ("gaming", "gaming moments clutch epic gameplay #shorts"),
    ("beauty", "skincare routine glow makeup tutorial #shorts"),
    ("music", "acoustic guitar solo piano cover #shorts"),
    ("interior", "cozy room makeover aesthetic bedroom #shorts"),
]

def clean_caption(title, category):
    # 특수문자 및 불필요한 태그 정리
    title = re.sub(r'#\S+', '', title).strip()
    title = title[:60].strip()
    return f"{title} #{category} #reels #viral"

def main():
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    out_dir = os.path.join(BACKEND_DIR, "scratch", "shorts_scrape_tmp")
    os.makedirs(out_dir, exist_ok=True)

    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    db = SessionLocal()

    print("==================================================")
    print("Starting 160 Real Shorts Scraping & Supabase Ingestion")
    print("==================================================")

    reel_idx = 1
    total_uploaded = 0
    total_bytes = 0

    ydl_opts_search = {'quiet': True, 'extract_flat': True}

    for cat, query in CATEGORIES_SEARCH:
        print(f"\n[{cat.upper()}] Searching candidate shorts for: '{query}'...")
        candidates = []
        try:
            with yt_dlp.YoutubeDL(ydl_opts_search) as ydl:
                res = ydl.extract_info(f"ytsearch25:{query}", download=False)
                candidates = res.get('entries', [])
        except Exception as e:
            print(f"Search failed for {cat}: {e}")
            continue

        cat_count = 0
        for cand in candidates:
            if cat_count >= 10:
                break
            
            cand_id = cand.get('id')
            if not cand_id:
                continue

            video_url = f"https://www.youtube.com/watch?v={cand_id}"
            temp_file = os.path.join(out_dir, f"reel{reel_idx}.mp4")

            # 1. 메타데이터 사전 검증 (10초 <= duration <= 60초)
            try:
                with yt_dlp.YoutubeDL({'quiet': True, 'ffmpeg_location': ffmpeg_exe}) as ydl_info:
                    inf = ydl_info.extract_info(video_url, download=False)
                    dur = inf.get('duration', 0)
                    if not dur or dur < 8 or dur > 65:
                        continue
                    video_title = inf.get('title', f'{cat} reel')
            except Exception:
                continue

            # 2. 다운로드 (480p ~ 720p 세로 모바일 최적화)
            ydl_opts_dl = {
                'ffmpeg_location': ffmpeg_exe,
                'format': 'bestvideo*[height<=720]+bestaudio/best[height<=720]/best',
                'merge_output_format': 'mp4',
                'outtmpl': temp_file,
                'quiet': True,
            }
            try:
                with yt_dlp.YoutubeDL(ydl_opts_dl) as ydl:
                    ydl.download([video_url])
            except Exception as e:
                print(f"Download error for {cand_id}: {e}")
                continue

            actual_file = temp_file if os.path.exists(temp_file) else temp_file.replace(".mp4", "") + ".mp4"
            if not os.path.exists(actual_file):
                files = [os.path.join(out_dir, f) for f in os.listdir(out_dir) if f.endswith(".mp4")]
                if files:
                    actual_file = files[0]
                else:
                    continue

            file_size = os.path.getsize(actual_file)
            size_mb = file_size / (1024 * 1024)

            # 3. Supabase Storage 업로드
            storage_path = f"reels/reel{reel_idx}.mp4"
            try:
                with open(actual_file, "rb") as f:
                    v_bytes = f.read()

                supabase.storage.from_("instagram-media").upload(
                    storage_path, v_bytes, {"content-type": "video/mp4", "upsert": "true"}
                )
                public_url = supabase.storage.from_("instagram-media").get_public_url(storage_path)
            except Exception as e:
                print(f"Supabase upload error for reel{reel_idx}: {e}")
                if os.path.exists(actual_file): os.remove(actual_file)
                continue

            # 4. 로컬 임시 파일 즉시 삭제
            if os.path.exists(actual_file):
                os.remove(actual_file)

            # 5. DB 레코드 업데이트
            reel_record = db.query(Reel).filter(Reel.id == reel_idx).first()
            if reel_record:
                reel_record.category = cat
                reel_record.video_url = public_url
                reel_record.caption = clean_caption(video_title, cat)
                reel_record.duration_ms = int(dur * 1000)
                db.commit()

            cat_count += 1
            total_uploaded += 1
            total_bytes += file_size

            print(f"  [Reel #{reel_idx:03d}] ({cat_count}/10) {video_title[:35]}... ({dur}s, {size_mb:.2f}MB) -> Uploaded!")
            reel_idx += 1

            # 유튜브 요청 간격 완충
            time.sleep(1)

    db.close()
    print("\n==================================================")
    print(f"Scraping & Ingestion Complete!")
    print(f"Total uploaded: {total_uploaded} real shorts videos")
    print(f"Total size in Supabase Storage: {total_bytes / (1024 * 1024):.2f} MB")
    print("==================================================")

if __name__ == "__main__":
    main()
