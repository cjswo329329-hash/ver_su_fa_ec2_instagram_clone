"""
sync_categories_and_simulate.py
=============================================================================
1. 릴스 및 게시글 카테고리 100% 실사 매핑 동기화
2. 4대 페르소나 사용자 생성 및 취향 조작 시뮬레이션
   - fit_tester: 피트니스 마니아
   - cafe_tester: 커피/카페 애호가
   - tech_tester: IT 테크 덕후
   - travel_tester: 여행/풍경 여행자
3. 추천 알고리즘 랭킹 및 릴스 셔플 결과 자동 검증
=============================================================================
"""

import os
import sys
import random
from datetime import datetime, timezone, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.database import SessionLocal
from app.models import User, Reel, Post, Like, Bookmark, ContentView, Follow
from app.core.security import get_password_hash
from app.services.recommendation_service import (
    get_user_taste_profile,
    invalidate_taste_profile,
    recommend_posts_for_user,
    get_personalized_category_multipliers
)
from app.routers.reels import get_reels

from scripts.seed_160_unique_reels import CATEGORY_CAPTIONS, CATEGORY_POSTERS, CATEGORY_AUDIOS

SUPABASE_STORAGE_REELS_URL = "https://npnclxvzpeedvyogpmqw.supabase.co/storage/v1/object/public/instagram-media/reels"

CATEGORIES_16 = [
    "fitness", "tech", "finance", "knowledge_daily",
    "travel", "cafe", "food", "fashion",
    "beauty", "interior", "pets", "art",
    "music", "celebrity", "gaming", "comedy"
]

def step1_sync_categories(db):
    print("\n==================================================")
    print("🚀 [Step 1] 160개 릴스 및 240개 게시글 16대 카테고리 100% 동기화")
    print("==================================================")

    reels = db.query(Reel).order_by(Reel.id.asc()).all()
    print(f"📊 DB 총 릴스 수: {len(reels)}개")

    cat_counts = {}
    for idx, r in enumerate(reels):
        cat_idx = (idx // 10) % len(CATEGORIES_16)
        cat = CATEGORIES_16[cat_idx]
        item_idx = idx % 10

        seed_cat = "dance" if cat == "celebrity" else cat
        captions = CATEGORY_CAPTIONS.get(seed_cat, [])
        posters = CATEGORY_POSTERS.get(seed_cat, [])
        audios = CATEGORY_AUDIOS.get(seed_cat, [])

        caption = captions[item_idx % len(captions)]
        poster = posters[item_idx % len(posters)]
        audio = audios[item_idx % len(audios)]
        video_num = ((r.id - 1) % 49) + 1
        video_url = f"{SUPABASE_STORAGE_REELS_URL}/reel{video_num}.mp4"

        r.category = cat
        r.caption = caption
        r.poster_url = poster
        r.audio_title = audio
        r.video_url = video_url
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    db.commit()
    print(f"✅ 160개 릴스를 16대 카테고리(카테고리당 10개씩)로 완벽 갱신 완료!")
    for cat in CATEGORIES_16:
        print(f"  - {cat:16s}: {cat_counts.get(cat, 0)}개")

    none_posts = db.query(Post).filter(Post.category.is_(None)).all()
    for p in none_posts:
        p.category = "cafe"
    if none_posts:
        db.commit()
        print(f"✅ 카테고리 누락 게시글 {len(none_posts)}건 'cafe'로 정정 완료!")


def get_or_create_user(db, username, email, full_name, bio):
    u = db.query(User).filter((User.username == username) | (User.email == email)).first()
    if not u:
        u = User(
            username=username,
            email=email,
            hashed_password=get_password_hash("password123"),
            full_name=full_name,
            bio=bio,
            profile_image_url="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80"
        )
        db.add(u)
        db.commit()
        db.refresh(u)
    else:
        # 비밀번호를 'password123'으로 확실히 동기화
        u.hashed_password = get_password_hash("password123")
        db.commit()
    return u


def step2_create_personas_and_inject_tastes(db):
    print("\n==================================================")
    print("🚀 [Step 2] 4대 취향 페르소나 생성 및 활동 데이터 주입")
    print("==================================================")

    personas = [
        {
            "username": "fit_tester",
            "email": "fit_tester@test.com",
            "name": "강태양(피트니스 마니아)",
            "bio": "매일 새벽 5시 오운완 헬스/크로스핏 러버 💪",
            "target_cat": "fitness",
            "avoid_cat": "gaming"
        },
        {
            "username": "cafe_tester",
            "email": "cafe_tester@test.com",
            "name": "이민서(스페셜티 카페러버)",
            "bio": "전국 카페투어 및 홈카페 핸드드립 바리스타 ☕",
            "target_cat": "cafe",
            "avoid_cat": "tech"
        },
        {
            "username": "gaming_tester",
            "email": "gaming_tester@test.com",
            "name": "박도현(e스포츠 게이머)",
            "bio": "롤/발로란트/배그 클러치 장인 🎮",
            "target_cat": "gaming",
            "avoid_cat": "beauty"
        },
        {
            "username": "travel_tester",
            "email": "travel_tester@test.com",
            "name": "김하늘(세계여행 배낭러)",
            "bio": "에메랄드빛 바다와 오로라를 찾아 떠나는 여행자 ✈️",
            "target_cat": "travel",
            "avoid_cat": "finance"
        }
    ]

    results = []
    now = datetime.now(timezone.utc)

    for p in personas:
        user = get_or_create_user(db, p["username"], p["email"], p["name"], p["bio"])
        target_cat = p["target_cat"]
        avoid_cat = p["avoid_cat"]

        # 기존 해당 유저의 상호작용 기록 초기화 (깨끗한 벤치마크 환경)
        db.query(Like).filter(Like.user_id == user.id).delete()
        db.query(Bookmark).filter(Bookmark.user_id == user.id).delete()
        db.query(ContentView).filter(ContentView.user_id == user.id).delete()
        db.commit()

        target_reels = db.query(Reel).filter(Reel.category == target_cat).all()
        target_posts = db.query(Post).filter(Post.category == target_cat).all()
        avoid_reels = db.query(Reel).filter(Reel.category == avoid_cat).all()

        # 릴스는 10개 중 2개만 좋아요/북마크하여 취향을 학습시키고,
        # 나머지 8개는 ContentView를 남기지 않아 Seen Filter에 걸리지 않고 피드에 풍성히 노출되도록 함
        db.add(Bookmark(user_id=user.id, reel_id=target_reels[0].id, created_at=now - timedelta(hours=2)))
        db.add(Like(user_id=user.id, reel_id=target_reels[0].id, created_at=now - timedelta(hours=2)))
        db.add(Like(user_id=user.id, reel_id=target_reels[1].id, created_at=now - timedelta(hours=1)))

        # 게시글 인터랙션 주입 (북마크 + 좋아요 + 완독 체류)
        db.add(Bookmark(user_id=user.id, post_id=target_posts[0].id, created_at=now - timedelta(hours=3)))
        db.add(Like(user_id=user.id, post_id=target_posts[0].id, created_at=now - timedelta(hours=3)))
        db.add(Like(user_id=user.id, post_id=target_posts[1].id, created_at=now - timedelta(hours=2)))
        db.add(ContentView(user_id=user.id, post_id=target_posts[1].id, duration_ms=3500, completed=True, not_interested=False, source="feed", created_at=now - timedelta(hours=2)))
        db.add(Like(user_id=user.id, post_id=target_posts[2].id, created_at=now - timedelta(hours=1)))

        # 비선호 카테고리 부정 시그널 주입 ('관심 없음' -10.0점 x 2건)
        for ar in avoid_reels[:2]:
            db.add(ContentView(user_id=user.id, reel_id=ar.id, duration_ms=800, completed=False, not_interested=True, source="reels", created_at=now - timedelta(hours=1)))

        db.commit()

        invalidate_taste_profile(user.id)
        results.append((user, target_cat, avoid_cat, p["name"]))
        print(f"✅ 페르소나 [{user.username}] ({p['name']}) -> 타겟 [{target_cat}] 강력 호감 & 기피 [{avoid_cat}] 관심없음 주입 완료!")

    return results


def step3_verify_recommendation_results(db, persona_data):
    print("\n==================================================")
    print("🚀 [Step 3] 페르소나별 추천 알고리즘 심층 검증")
    print("==================================================")

    import app.routers.reels as reels_mod
    reels_mod._raw_meta_cache = None

    for user, target_cat, avoid_cat, full_name in persona_data:
        print(f"\n" + "-" * 55)
        print(f"👤 검증 페르소나: {user.username} ({full_name})")
        print(f"   - 목표 선호: ⭐ {target_cat.upper()} ⭐")
        print(f"   - 비선호/기피: ❌ {avoid_cat.upper()} ❌")
        print("-" * 55)

        # 1. 취향 프로필 분석 결과 확인
        profile = get_user_taste_profile(user.id, db, force_refresh=True)
        top1 = profile["top_categories"][0]
        disliked = profile.get("disliked_categories", [])

        print(f"[1. 취향 프로필 분석 (Taste Profiler)]")
        print(f"  - 1위 카테고리: {top1['category']} (선호도 비중: {top1['score'] * 100:.1f}%)")
        print(f"  - 상위 카테고리: {[c['category'] for c in profile['top_categories'][:3]]}")
        print(f"  - 관심 없음(Disliked) 카테고리: {disliked}")

        assert top1["category"] == target_cat, f"취향 1위 불일치! 기대: {target_cat}, 실제: {top1['category']}"
        assert top1["score"] >= 0.70, f"타겟 카테고리 점수가 70% 이상이어야 합니다! 실제: {top1['score']}"
        assert avoid_cat in disliked, f"기피 카테고리가 disliked_categories에 포함되어야 합니다!"
        print(f"  👉 [{target_cat}]이 {top1['score'] * 100:.1f}%로 압도적 1위 판정! (기피 [{avoid_cat}] 억제 등록)")

        # 2. 릴스 추천 스트림 검증 (10개 조회)
        reels = get_reels(limit=10, offset=0, seed=42, db=db, current_user=user)
        served_cats = [r.category for r in reels]
        target_reels_count = served_cats.count(target_cat)
        avoid_reels_count = served_cats.count(avoid_cat)

        print(f"\n[2. 릴스 추천 스트림 결과 (상위 10개)]")
        for idx, r in enumerate(reels, 1):
            if r.category == target_cat:
                tag = "⭐ [타겟]"
            elif r.category == avoid_cat:
                tag = "❌ [기피]"
            else:
                tag = "   [다양성]"
            print(f"  {idx:2d}. {tag} [{r.category:12s}] ID:{r.id:3d} | {r.caption[:30]}")

        # 중복 방지 규칙 검증
        for i in range(len(reels) - 1):
            assert reels[i].video_url != reels[i + 1].video_url, f"연속 동일 영상 감지! {reels[i].id} & {reels[i+1].id}"
            assert reels[i].author.id != reels[i + 1].author.id, f"연속 동일 작성자 감지! {reels[i].id} & {reels[i+1].id}"

        print(f"  👉 릴스 10개 중 타겟 [{target_cat}] 노출 수: {target_reels_count}/10개")
        print(f"  👉 기피 카테고리 [{avoid_cat}] 노출 수: {avoid_reels_count}/10개 (0개 완벽 차단)")
        print(f"  👉 연속 동일 영상(prev_vid) 및 연속 동일 작성자(prev_user) 100% 무중복 통과!")

        assert target_reels_count >= 5, f"릴스에서 타겟 카테고리가 5개 이상이어야 합니다! 실제: {target_reels_count}"
        assert avoid_reels_count == 0, f"릴스에서 기피 카테고리는 0개여야 합니다! 실제: {avoid_reels_count}"

        # 3. 홈 피드 개인화 추천 랭커 검증 (상위 5개)
        posts, _, _ = recommend_posts_for_user(db=db, user_id=user.id, limit=5)
        post_cats = [p.category for p in posts]
        target_posts_count = post_cats.count(target_cat)
        avoid_posts_count = post_cats.count(avoid_cat)

        print(f"\n[3. 홈 피드 3순위 개인화 추천 결과 (상위 5개)]")
        for idx, p in enumerate(posts, 1):
            if p.category == target_cat:
                tag = "⭐ [타겟]"
            elif p.category == avoid_cat:
                tag = "❌ [기피]"
            else:
                tag = "   [다양성]"
            print(f"  {idx:2d}. {tag} [{p.category:12s}] ID:{p.id:3d} | {p.caption[:30]}")

        print(f"  👉 피드 5개 중 타겟 [{target_cat}] 노출 수: {target_posts_count}/5개")
        print(f"  👉 피드 중 기피 [{avoid_cat}] 노출 수: {avoid_posts_count}/5개 (0개 완벽 차단)")

        assert target_posts_count >= 3, f"피드에서 타겟 카테고리가 3개 이상이어야 합니다! 실제: {target_posts_count}"
        assert avoid_posts_count == 0, f"피드에서 기피 카테고리는 0개여야 합니다! 실제: {avoid_posts_count}"

        print(f"  🎉 [{user.username}] 검증 100% PASS!")


def main():
    db = SessionLocal()
    try:
        step1_sync_categories(db)
        persona_data = step2_create_personas_and_inject_tastes(db)
        step3_verify_recommendation_results(db, persona_data)

        print("\n" + "=" * 65)
        print("🏆 16대 카테고리 동기화 및 4대 페르소나 추천 알고리즘 검증 완료!")
        print("=" * 65)
        print("\n🔑 사용자 테스트용 로그인 계정 목록 (비밀번호 공통: password123):")
        print("  1. 아이디: fit_tester     | 취향: 피트니스 (운동/헬스 집중 추천)")
        print("  2. 아이디: cafe_tester    | 취향: 카페/커피 (홈카페/스페셜티 집중 추천)")
        print("  3. 아이디: gaming_tester  | 취향: 게임 (롤/배그/발로란트 집중 추천)")
        print("  4. 아이디: travel_tester  | 취향: 여행 (해외여행/휴양지 집중 추천)")
        print("=" * 65)
    finally:
        db.close()


if __name__ == "__main__":
    main()
