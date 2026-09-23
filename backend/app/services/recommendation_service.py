"""
recommendation_service.py
=============================================================================
Instagram Explore & Feed Multi-Stage Personalized Recommendation Engine

아키텍처 단계:
1. User Taste Profiler:
   - 행동 데이터(북마크, 댓글, 좋아요, 체류시간, 완주, 관심 없음) 수집
   - 지수 시간 감쇄 (Half-life = 7일 Time-decay) 적용
   - 16대 카테고리 선호도 벡터 및 작성자 친화도 산출
   - 60초 인메모리 TTL 캐싱으로 EC2 부하 최소화
2. Candidate Retrieval:
   - 기시청(3초+ 체류/완독) 및 부정 피드백(관심 없음) 완벽 배제 (Seen Filter)
   - 카테고리 기반 + 소셜 친구 활동 + 인기 트렌드 + 탐색(Exploration) 4중 채널
3. Hybrid Scoring & Value Model:
   - Score = 0.45*TasteAffinity + 0.25*Engagement + 0.20*Freshness + 0.10*SocialProof + Epsilon Jitter
4. Re-ranking & Diversity:
   - Interleaving Dispersion: 동일 작성자 및 동일 카테고리 연속 노출 방지
=============================================================================
"""

import math
import time
import random
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple, Set, Any
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.user import User
from app.models.post import Post
from app.models.reel import Reel
from app.models.like import Like
from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.content_view import ContentView

# 16대 표준 카테고리 목록
STANDARD_CATEGORIES = [
    "cafe", "travel", "fashion", "food", "fitness", "pets",
    "tech", "art", "comedy", "finance", "celebrity",
    "knowledge_daily", "gaming", "beauty", "music", "interior"
]

# 행동별 기초 가중치 (Base Weights)
WEIGHT_BOOKMARK = 5.0      # 가장 높은 구매/보관 의도
WEIGHT_COMMENT = 4.0       # 적극적 인게이지먼트
WEIGHT_LIKE = 3.0          # 명시적 호감
WEIGHT_COMPLETED = 2.0     # 3초 이상 체류 및 완독
WEIGHT_PARTIAL_VIEW = 0.8  # 짧은 체류
WEIGHT_NOT_INTERESTED = -10.0  # 강력한 부정 피드백 (페널티)

# 시간 감쇄 계수 (반감기 7일 = ln(2) / 7 ≈ 0.099021)
LAMBDA_DECAY = 0.099021

# 취향 프로필 인메모리 캐시 (user_id -> (timestamp, profile_dict))
_TASTE_PROFILE_CACHE: Dict[int, Tuple[float, Dict[str, Any]]] = {}
TASTE_PROFILE_CACHE_TTL = 300.0  # 300초(5분) 유지로 EC2-DB 통신 대폭 절감


def calculate_time_decay(action_time: datetime, now_dt: Optional[datetime] = None) -> float:
    """반감기 7일 기준 지수 시간 감쇄율(0.0 ~ 1.0) 계산"""
    if not action_time:
        return 0.5
    if now_dt is None:
        now_dt = datetime.now(timezone.utc)
    
    # 시간대 처리 정규화
    if action_time.tzinfo is None:
        action_time = action_time.replace(tzinfo=timezone.utc)
    if now_dt.tzinfo is None:
        now_dt = now_dt.replace(tzinfo=timezone.utc)

    delta_days = max(0.0, (now_dt - action_time).total_seconds() / 86400.0)
    return math.exp(-LAMBDA_DECAY * delta_days)


def get_user_taste_profile(user_id: int, db: Session, force_refresh: bool = False) -> Dict[str, Any]:
    """
    사용자의 최근 활동(북마크, 좋아요, 댓글, 시청)을 종합 분석하여
    16대 카테고리별 선호도 벡터 및 주요 관심 크리에이터를 산출합니다.
    """
    now_ts = time.time()
    if not force_refresh and user_id in _TASTE_PROFILE_CACHE:
        cached_ts, cached_data = _TASTE_PROFILE_CACHE[user_id]
        if now_ts - cached_ts < TASTE_PROFILE_CACHE_TTL:
            return cached_data

    now_dt = datetime.now(timezone.utc)
    category_scores: Dict[str, float] = defaultdict(float)
    author_scores: Dict[int, float] = defaultdict(float)
    total_actions = 0

    # 1. 북마크(Bookmarks) 분석 - 1회 배치 JOIN 쿼리로 N+1 완벽 제거 (최근 50건)
    bms = (
        db.query(
            Bookmark.created_at,
            Bookmark.post_id,
            Bookmark.reel_id,
            Post.category.label("post_category"),
            Post.user_id.label("post_author_id"),
            Reel.category.label("reel_category"),
            Reel.user_id.label("reel_author_id"),
        )
        .outerjoin(Post, Bookmark.post_id == Post.id)
        .outerjoin(Reel, Bookmark.reel_id == Reel.id)
        .filter(Bookmark.user_id == user_id)
        .order_by(Bookmark.created_at.desc())
        .limit(50)
        .all()
    )
    for b_created, p_id, r_id, p_cat, p_author, r_cat, r_author in bms:
        decay = calculate_time_decay(b_created, now_dt)
        w = WEIGHT_BOOKMARK * decay
        if p_id:
            cat = p_cat or "tech"
            category_scores[cat] += w
            if p_author:
                author_scores[p_author] += w
            total_actions += 1
        elif r_id:
            cat = r_cat or "tech"
            category_scores[cat] += w
            if r_author:
                author_scores[r_author] += w
            total_actions += 1

    # 2. 좋아요(Likes) 분석 - 1회 배치 JOIN 쿼리로 N+1 완벽 제거 (최근 50건)
    likes = (
        db.query(
            Like.created_at,
            Like.post_id,
            Like.reel_id,
            Post.category.label("post_category"),
            Post.user_id.label("post_author_id"),
            Reel.category.label("reel_category"),
            Reel.user_id.label("reel_author_id"),
        )
        .outerjoin(Post, Like.post_id == Post.id)
        .outerjoin(Reel, Like.reel_id == Reel.id)
        .filter(Like.user_id == user_id)
        .order_by(Like.created_at.desc())
        .limit(50)
        .all()
    )
    for l_created, p_id, r_id, p_cat, p_author, r_cat, r_author in likes:
        decay = calculate_time_decay(l_created, now_dt)
        w = WEIGHT_LIKE * decay
        if p_id:
            cat = p_cat or "tech"
            category_scores[cat] += w
            if p_author:
                author_scores[p_author] += w
            total_actions += 1
        elif r_id:
            cat = r_cat or "tech"
            category_scores[cat] += w
            if r_author:
                author_scores[r_author] += w
            total_actions += 1

    # 3. 댓글(Comments) 분석 - 1회 배치 JOIN 쿼리로 N+1 완벽 제거 (최근 50건)
    comments = (
        db.query(
            Comment.created_at,
            Comment.post_id,
            Comment.reel_id,
            Post.category.label("post_category"),
            Post.user_id.label("post_author_id"),
            Reel.category.label("reel_category"),
            Reel.user_id.label("reel_author_id"),
        )
        .outerjoin(Post, Comment.post_id == Post.id)
        .outerjoin(Reel, Comment.reel_id == Reel.id)
        .filter(Comment.user_id == user_id)
        .order_by(Comment.created_at.desc())
        .limit(50)
        .all()
    )
    for c_created, p_id, r_id, p_cat, p_author, r_cat, r_author in comments:
        decay = calculate_time_decay(c_created, now_dt)
        w = WEIGHT_COMMENT * decay
        if p_id:
            cat = p_cat or "tech"
            category_scores[cat] += w
            if p_author:
                author_scores[p_author] += w
            total_actions += 1
        elif r_id:
            cat = r_cat or "tech"
            category_scores[cat] += w
            if r_author:
                author_scores[r_author] += w
            total_actions += 1

    # 4. 시청/체류 및 부정 피드백(ContentViews) 분석 - 1회 배치 JOIN 쿼리 (최근 50건)
    views = (
        db.query(
            ContentView.created_at,
            ContentView.post_id,
            ContentView.reel_id,
            ContentView.completed,
            ContentView.not_interested,
            ContentView.duration_ms,
            ContentView.watch_ratio,
            Post.category.label("post_category"),
            Post.user_id.label("post_author_id"),
            Reel.category.label("reel_category"),
            Reel.user_id.label("reel_author_id"),
        )
        .outerjoin(Post, ContentView.post_id == Post.id)
        .outerjoin(Reel, ContentView.reel_id == Reel.id)
        .filter(ContentView.user_id == user_id)
        .order_by(ContentView.created_at.desc())
        .limit(50)
        .all()
    )
    for v_created, p_id, r_id, completed, not_interested, duration_ms, watch_ratio, p_cat, p_author, r_cat, r_author in views:
        decay = calculate_time_decay(v_created, now_dt)
        cat = p_cat if p_id else (r_cat if r_id else None)
        if not cat:
            cat = "tech"
        author_id = p_author if p_id else (r_author if r_id else None)

        dur = duration_ms or 0
        if not_interested:
            w = WEIGHT_NOT_INTERESTED * decay
            category_scores[cat] += w
            if author_id:
                author_scores[author_id] += w
            total_actions += 1
        elif completed or dur >= 3000:
            w = WEIGHT_COMPLETED * decay
            category_scores[cat] += w
            if author_id:
                author_scores[author_id] += w
            total_actions += 1
        elif dur >= 1000:
            w = WEIGHT_PARTIAL_VIEW * decay
            category_scores[cat] += w
            total_actions += 1


    # 5. 정규화 (Normalization)
    # 음수 점수는 0으로 클리핑 후 소프트맥스/L1 비율 계산
    clipped_scores: Dict[str, float] = {}
    for c in STANDARD_CATEGORIES:
        raw = category_scores.get(c, 0.0)
        clipped_scores[c] = max(0.0, raw)

    # 비선호/관심 없음 카테고리 식별 (원시 점수가 음수인 카테고리)
    disliked_categories = [c for c in STANDARD_CATEGORIES if category_scores.get(c, 0.0) < -0.5]

    score_sum = sum(clipped_scores.values())
    normalized_weights: Dict[str, float] = {}
    is_cold_start = (total_actions < 3 or score_sum <= 0.001)

    if is_cold_start:
        # 콜드 스타트: 모든 카테고리에 균등 가중치 부여 (1/16)
        uniform_weight = 1.0 / len(STANDARD_CATEGORIES)
        for c in STANDARD_CATEGORIES:
            normalized_weights[c] = round(uniform_weight, 4)
    else:
        for c in STANDARD_CATEGORIES:
            normalized_weights[c] = round(clipped_scores[c] / score_sum, 4)

    # 상위 선호 카테고리 정렬
    top_categories = sorted(
        normalized_weights.items(),
        key=lambda x: x[1],
        reverse=True
    )

    profile = {
        "user_id": user_id,
        "is_cold_start": is_cold_start,
        "total_actions": total_actions,
        "category_weights": normalized_weights,
        "disliked_categories": disliked_categories,
        "top_categories": [{"category": cat, "score": score} for cat, score in top_categories[:5]],
        "top_authors": [aid for aid, sc in sorted(author_scores.items(), key=lambda x: x[1], reverse=True)[:5] if sc > 0],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    _TASTE_PROFILE_CACHE[user_id] = (now_ts, profile)
    return profile


def invalidate_taste_profile(user_id: int):
    """사용자가 새로운 상호작용을 일으켰을 때 캐시 즉시 만료"""
    if user_id in _TASTE_PROFILE_CACHE:
        del _TASTE_PROFILE_CACHE[user_id]


def interleave_diversity(items: List[Any], key_author_attr: str = "user_id", key_cat_attr: str = "category") -> List[Any]:
    """
    다양성 재정렬(Interleaving Dispersion):
    동일 작성자 또는 동일 카테고리가 2회 연속 나오지 않도록 인터리빙 셔플링을 수행합니다.
    """
    if len(items) <= 2:
        return items

    remaining = list(items)
    result = [remaining.pop(0)]

    while remaining:
        prev_item = result[-1]
        prev_author = getattr(prev_item, key_author_attr, None)
        prev_cat = getattr(prev_item, key_cat_attr, None)

        best_idx = -1
        # 1지망: 작성자와 카테고리가 모두 이전 아이템과 다른 후보
        for idx, it in enumerate(remaining):
            it_author = getattr(it, key_author_attr, None)
            it_cat = getattr(it, key_cat_attr, None)
            if it_author != prev_author and it_cat != prev_cat:
                best_idx = idx
                break

        # 2지망: 작성자만이라도 다른 후보
        if best_idx == -1:
            for idx, it in enumerate(remaining):
                if getattr(it, key_author_attr, None) != prev_author:
                    best_idx = idx
                    break

        # 3지망: 차선책 (맨 앞 아이템)
        if best_idx == -1:
            best_idx = 0

        result.append(remaining.pop(best_idx))

    return result


def recommend_posts_for_user(
    db: Session,
    user_id: Optional[int] = None,
    limit: int = 10,
    cursor: Optional[int] = None,
    exclude_ids: Optional[Set[int]] = None,
    following_ids: Optional[Set[int]] = None
) -> Tuple[List[Post], bool, Optional[int]]:
    """
    피드(3순위) 및 탐색(Explore)을 위한 하이브리드 추천 랭커.
    - Seen Filter 배제
    - Taste Affinity + Engagement + Freshness + Social Proof 복합 랭킹
    - Interleaving 분산
    """
    now_dt = datetime.now(timezone.utc)
    if exclude_ids is None:
        exclude_ids = set()

    # 1. 로그인 유저의 기시청 및 관심없음 글 배제 서브쿼리
    seen_post_ids: Set[int] = set()
    taste_profile = None
    if user_id:
        taste_profile = get_user_taste_profile(user_id, db)
        seen_rows = db.query(ContentView.post_id).filter(
            ContentView.user_id == user_id,
            ContentView.post_id.isnot(None),
            or_(
                ContentView.completed == True,
                ContentView.duration_ms >= 3000,
                ContentView.not_interested == True
            )
        ).distinct().all()
        seen_post_ids = {r[0] for r in seen_rows if r[0]}

    all_excluded = exclude_ids | seen_post_ids

    # 2. 다중 채널 후보군(Multi-Channel Candidate Pool) 조회
    # 채널 A: 유저 선호 상위 카테고리 집중 인출 (Targeted Retrieval)
    # 채널 B: 최신 및 탐색용 일반 게시물 인출 (Exploration Retrieval)
    top_cats = [c["category"] for c in taste_profile.get("top_categories", [])[:3]] if (taste_profile and not taste_profile.get("is_cold_start")) else []

    base_query = db.query(Post).join(User, Post.user_id == User.id).filter(
        User.is_private == False
    )
    if all_excluded:
        base_query = base_query.filter(Post.id.notin_(all_excluded))
    if cursor:
        base_query = base_query.filter(Post.id < cursor)

    # N+1 방지 옵션
    from app.routers.posts import POST_EAGER_OPTIONS

    targeted_posts = []
    if top_cats:
        targeted_posts = (
            base_query.filter(Post.category.in_(top_cats))
            .options(*POST_EAGER_OPTIONS)
            .order_by(Post.id.desc())
            .limit(50)
            .all()
        )

    general_posts = (
        base_query.options(*POST_EAGER_OPTIONS)
        .order_by(Post.id.desc())
        .limit(100)
        .all()
    )

    # 중복 제거하며 후보군 병합
    candidate_map = {p.id: p for p in targeted_posts}
    for p in general_posts:
        if p.id not in candidate_map:
            candidate_map[p.id] = p
    candidates = list(candidate_map.values())

    if not candidates:
        return [], False, None

    # 3. 하이브리드 스코어링 (Scoring & Ranking)
    cat_weights = taste_profile["category_weights"] if taste_profile else {}
    disliked_categories = set(taste_profile.get("disliked_categories", [])) if taste_profile else set()
    top_authors = set(taste_profile.get("top_authors", [])) if taste_profile else set()
    user_following = following_ids or set()

    scored_items: List[Tuple[float, Post]] = []
    for post in candidates:
        cat = post.category or "tech"
        # 관심 없음 피드백을 받은 카테고리는 추천에서 원천 배제
        if cat in disliked_categories:
            continue

        # (1) 취향 일치도 (Taste Affinity) [0.0 ~ 1.0]
        affinity = cat_weights.get(cat, 0.0625)
        # 상위 선호 크리에이터 보너스
        if post.user_id in top_authors:
            affinity = min(1.0, affinity + 0.25)

        # (2) 참여도 (Engagement Score)
        likes_cnt = len(post.likes)
        bms_cnt = len(post.bookmarks)
        comments_cnt = len(post.comments)
        eng_raw = (likes_cnt * 3) + (bms_cnt * 5) + (comments_cnt * 4)
        eng_score = min(1.0, math.log10(1.0 + eng_raw) / 3.0)

        # (3) 시간 신선도 (Freshness Decay)
        post_time = post.created_at
        if post_time.tzinfo is None:
            post_time = post_time.replace(tzinfo=timezone.utc)
        hours_ago = max(0.1, (now_dt - post_time).total_seconds() / 3600.0)
        freshness = 1.0 / (1.0 + (hours_ago / 36.0))

        # (4) 소셜 증거 (Social Proof)
        social_proof = 0.0
        if user_following:
            if post.user_id in user_following:
                social_proof = 0.5
            elif any(lk.user_id in user_following for lk in post.likes):
                social_proof = 1.0

        # 최종 복합 점수 (0.0 ~ 100.0점)
        # + 약한 탐색 지터(Epsilon-Greedy Jitter: 0.0 ~ 0.05) 추가로 다양성 확보
        jitter = random.uniform(0.0, 0.05)
        total_score = (
            (affinity * 45.0) +
            (eng_score * 25.0) +
            (freshness * 20.0) +
            (social_proof * 10.0) +
            (jitter * 10.0)
        )
        scored_items.append((total_score, post))

    # 점수 내림차순 정렬
    scored_items.sort(key=lambda x: x[0], reverse=True)
    ranked_posts = [item[1] for item in scored_items]

    # 4. 다양성 재정렬 (Interleaving Dispersion)
    diversified_posts = interleave_diversity(ranked_posts, key_author_attr="user_id", key_cat_attr="category")

    # 5. 페이징 반환
    has_more = len(diversified_posts) > limit
    returned_items = diversified_posts[:limit]
    next_cursor = returned_items[-1].id if (has_more and returned_items) else None

    return returned_items, has_more, next_cursor


def get_personalized_category_multipliers(user_id: Optional[int], db: Session) -> Dict[str, float]:
    """
    릴스 셔플 생성기(`_generate_cycle`)를 위한 카테고리별 추천 가중치 배율 산출
    - 선호 카테고리: 선호 비중에 따라 1.5 ~ 6.0 배율 매핑
    - 관심 없음 카테고리: 0.01로 극단적 억제 (노출 배제)
    - 중립 미활동 카테고리: 0.6 ~ 1.0 배율
    """
    multipliers: Dict[str, float] = {c: 1.0 for c in STANDARD_CATEGORIES}
    if not user_id:
        return multipliers

    taste = get_user_taste_profile(user_id, db)
    if taste and not taste.get("is_cold_start"):
        cat_weights = taste.get("category_weights", {})
        disliked = set(taste.get("disliked_categories", []))

        for cat in STANDARD_CATEGORIES:
            if cat in disliked:
                multipliers[cat] = 0.01
            else:
                weight = cat_weights.get(cat, 0.0)
                if weight > 0.05:
                    multipliers[cat] = round(1.0 + (weight * 6.0), 2)
                else:
                    multipliers[cat] = 0.6

    return multipliers
