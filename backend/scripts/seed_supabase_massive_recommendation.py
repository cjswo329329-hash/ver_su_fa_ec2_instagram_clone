"""
seed_supabase_massive_recommendation.py
=============================================================================
추천 시스템 학습을 위한 16대 카테고리 100인 페르소나 및 체류시간(ms) 대규모 시딩 스크립트

- 타겟 유저 제임스(홍기영: cjswo329329@gmail.com) 맞춤 취향:
  운동(fitness), 자기계발(knowledge_daily), IT개발(tech), 재테크(finance)
- 16대 카테고리 (기존 8종 + 코미디, 재테크, 연예인, 일상지식 + 게임, 뷰티, 음악, 인테리어)
- 체류시간(duration_ms: 연속형 밀리초) & 완주율(watch_ratio) & 루프 시청 & 조기 이탈 반영
- 북마크(고가치 긍정 시그널), 좋아요, 맞춤 팔로우 네트워크, 실제 댓글 생성
- 파워 크리에이터도 활발한 소비자로 행동
=============================================================================
"""

import os
import sys
import random
import uuid
from datetime import datetime, timedelta

# UTF-8 stdout encoding for Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.database import SessionLocal, engine, Base
from app.models import (
    User, Follow, Post, PostMedia, Reel, Comment,
    Like, Bookmark, Story, StoryView, Conversation,
    Message, Notification, ContentView
)
from app.core.security import get_password_hash

# ---------------------------------------------------------------------------
# 1. 16대 카테고리 정의
# ---------------------------------------------------------------------------
CATEGORIES = [
    "cafe",             # 1. 카페/디저트
    "travel",           # 2. 여행/풍경
    "fashion",          # 3. 패션/OOTD
    "food",             # 4. 맛집/요리
    "fitness",          # 5. 운동/헬스 (제임스 선호 ⭐)
    "pets",             # 6. 반려동물
    "tech",             # 7. IT개발/테크 (제임스 선호 ⭐)
    "art",              # 8. 예술/디자인
    "comedy",           # 9. 코미디/유머/밈
    "finance",          # 10. 재테크/투자/주식 (제임스 선호 ⭐)
    "celebrity",        # 11. 연예인/엔터
    "knowledge_daily",  # 12. 일상지식/자기계발 (제임스 선호 ⭐)
    "gaming",           # 13. 게임/e스포츠
    "beauty",           # 14. 뷰티/스킨케어
    "music",            # 15. 음악/공연
    "interior"          # 16. 인테리어/홈스타일링
]

# ---------------------------------------------------------------------------
# 2. 16대 카테고리별 고화질 이미지 뱅크 (Unsplash 엄선)
# ---------------------------------------------------------------------------
IMAGE_BANKS = {
    "cafe": [
        "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=1080&auto=format&fit=crop&q=80"
    ],
    "travel": [
        "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1080&auto=format&fit=crop&q=80"
    ],
    "fashion": [
        "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1080&auto=format&fit=crop&q=80"
    ],
    "food": [
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=1080&auto=format&fit=crop&q=80"
    ],
    "fitness": [
        "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1483721074573-5a022416b677?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=1080&auto=format&fit=crop&q=80"
    ],
    "pets": [
        "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=1080&auto=format&fit=crop&q=80"
    ],
    "tech": [
        "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1080&auto=format&fit=crop&q=80"
    ],
    "art": [
        "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1549887534-1541e9326642?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1080&auto=format&fit=crop&q=80"
    ],
    "comedy": [
        "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1531747056595-07f6cbbe10ad?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1080&auto=format&fit=crop&q=80"
    ],
    "finance": [
        "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=1080&auto=format&fit=crop&q=80"
    ],
    "celebrity": [
        "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1080&auto=format&fit=crop&q=80"
    ],
    "knowledge_daily": [
        "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1080&auto=format&fit=crop&q=80"
    ],
    "gaming": [
        "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1080&auto=format&fit=crop&q=80"
    ],
    "beauty": [
        "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=1080&auto=format&fit=crop&q=80"
    ],
    "music": [
        "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1080&auto=format&fit=crop&q=80"
    ],
    "interior": [
        "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1080&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1080&auto=format&fit=crop&q=80"
    ]
}

# ---------------------------------------------------------------------------
# 3. 20종 릴스 비디오 메타데이터 및 실제 길이 (ms)
# ---------------------------------------------------------------------------
REEL_VIDEO_METAS = [
    {"video": "/videos/reel1.mp4",  "duration_ms": 15000, "audio": "NewJeans - How Sweet", "cat": "celebrity"},
    {"video": "/videos/reel2.mp4",  "duration_ms": 12000, "audio": "DJ Wave - Weekend Night", "cat": "music"},
    {"video": "/videos/reel3.mp4",  "duration_ms": 18000, "audio": "Acoustic Cafe - Morning Latte", "cat": "cafe"},
    {"video": "/videos/reel4.mp4",  "duration_ms": 10000, "audio": "Meme Sound - Oh No", "cat": "comedy"},
    {"video": "/videos/reel5.mp4",  "duration_ms": 22000, "audio": "Iron Beats - Gym Motivation", "cat": "fitness"},
    {"video": "/videos/reel6.mp4",  "duration_ms": 14000, "audio": "Code Vibes - Lo-Fi Chill", "cat": "tech"},
    {"video": "/videos/reel7.mp4",  "duration_ms": 16000, "audio": "Wealth Daily - Stock Market Insight", "cat": "finance"},
    {"video": "/videos/reel8.mp4",  "duration_ms": 20000, "audio": "Mindset - 1% Everyday", "cat": "knowledge_daily"},
    {"video": "/videos/reel9.mp4",  "duration_ms": 13000, "audio": "Traveler - Paris Sunset", "cat": "travel"},
    {"video": "/videos/reel10.mp4", "duration_ms": 25000, "audio": "Street Style - OOTD Beat", "cat": "fashion"},
    {"video": "/videos/reel11.mp4", "duration_ms": 17000, "audio": "Chef Master - Sizzle Steak", "cat": "food"},
    {"video": "/videos/reel12.mp4", "duration_ms": 15000, "audio": "Cute Puppy - Happy Tail", "cat": "pets"},
    {"video": "/videos/reel13.mp4", "duration_ms": 19000, "audio": "Modern Art - Gallery Walk", "cat": "art"},
    {"video": "/videos/reel14.mp4", "duration_ms": 11000, "audio": "Pro Gamer - Clutch Moment", "cat": "gaming"},
    {"video": "/videos/reel15.mp4", "duration_ms": 24000, "audio": "Glow Beauty - Glass Skin", "cat": "beauty"},
    {"video": "/videos/reel16.mp4", "duration_ms": 14000, "audio": "Room Tour - Cozy Interior", "cat": "interior"},
    {"video": "/videos/reel17.mp4", "duration_ms": 21000, "audio": "HIIT Training - 30s Sprint", "cat": "fitness"},
    {"video": "/videos/reel18.mp4", "duration_ms": 16000, "audio": "Python Tips - Clean Architecture", "cat": "tech"},
    {"video": "/videos/reel19.mp4", "duration_ms": 18000, "audio": "ETF Investment - Compound Interest", "cat": "finance"},
    {"video": "/videos/reel20.mp4", "duration_ms": 23000, "audio": "Morning Routine - 5AM Club", "cat": "knowledge_daily"},
]

# ---------------------------------------------------------------------------
# 4. 아바타 URL 풀
# ---------------------------------------------------------------------------
AVATAR_URLS = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1514315384763-ba401779410f?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1480429370139-e0132c086e2a?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1463453091185-61582044d556?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=300&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=300&auto=format&fit=crop&q=80"
]

# ---------------------------------------------------------------------------
# 5. 카테고리별 전문 캡션 템플릿 (해시태그 및 가치 정보 포함)
# ---------------------------------------------------------------------------
CAPTION_TEMPLATES = {
    "fitness": [
        "오늘의 하체 루틴: 스쿼트 5세트 + 레그프레스 + 런지 마무리! 꾸준함이 답이다 💪 #오운완 #헬스타그램 #하체루틴 #동기부여",
        "3대 500을 향한 등 운동 데이! 데드리프트 자세 점검 및 광배 타겟 팁 공유 🏋️‍♂️ #데드리프트 #헬스 #피트니스",
        "아침 공복 러닝 5km 완주 🏃‍♂️ 새벽 공기 마시며 뛰는 이 기분, 하루 에너지가 달라집니다. #러닝크루 #모닝러닝 #오운완",
        "홈트로 가능한 복근 8분 루틴! 플랭크부터 레그레이즈까지 하루 8분만 투자해보세요. #홈트 #복근운동 #다이어트",
        "식단도 운동의 일부! 닭가슴살 볶음밥과 아보카도 샐러드로 채우는 단백질 식단 🥗 #식단관리 #단백질 #헬스식단"
    ],
    "tech": [
        "FastAPI와 Supabase로 구현하는 실시간 추천 시스템 아키텍처 정리 💻 성능 튜닝 팁을 공유합니다. #개발자 #파이썬 #백엔드 #AI",
        "개발자 데스크 셋업 완성! M3 맥북 프로 + 듀얼 모니터 세팅으로 개발 생산성 200% UP 🚀 #데스크셋업 #맥북 #개발자일상",
        "요즘 가장 핫한 LLM 프롬프트 엔지니어링 패턴 5가지 정리. 코드 리뷰 효율이 극대화됩니다! #인공지능 #프롬프트 #개발공부",
        "Docker 컨테이너 최적화 가이드: 멀티스테이지 빌드로 이미지 용량 80% 줄이기 🐳 #도커 #데브옵스 #인프라",
        "신입 백엔드 개발자가 자주 실수하는 SQL 인덱스 설계 주의점 5가지 📊 #데이터베이스 #SQL #백엔드개발"
    ],
    "finance": [
        "사회초년생을 위한 월급 관리 5단계 법칙: 통장 쪼개기부터 미국 배당 ETF까지 📈 #재테크 #사회초년생 #투자 #월급관리",
        "복리의 마법! 20대에 매월 30만원씩 S&P500 지수 추종 ETF에 투자했을 때의 20년 뒤 예상 자산 💵 #미국주식 #ETF #연금저축",
        "내 집 마련을 위한 청약 통장 핵심 가이드: 가점제 vs 추첨제 전략 총정리 🏢 #부동산 #청약 #재테크기초",
        "연말정산 13월의 월급 만들기: IRP와 세액공제 한도 900만원 채우는 실전 노하우 💡 #절세 #연말정산 #금융지식",
        "주식 차트보다 먼저 봐야 할 기업 재무제표 3대 지표 (PER, PBR, ROE) 쉽게 읽기 📑 #주식공부 #재테크 #가치투자"
    ],
    "knowledge_daily": [
        "원하는 목표를 100% 달성하는 '아침 5시 루틴' 3주차 실천 후기. 뇌의 집중력이 다릅니다 📖 #미라클모닝 #자기계발 #성장",
        "직장인 집중력 도둑 퇴치법: 뽀모도로 25분 몰입 기법으로 퇴근 시간 1시간 앞당기기 ⏱️ #생산성 #시간관리 #직장인팁",
        "성공한 사람들이 매일 아침 쓰는 3줄 감사일기 효과: 멘탈 관리와 회복탄력성 키우기 ✨ #멘탈관리 #동기부여 #독서",
        "자취생 생활비 절약 꿀팁: 식비 50% 아끼는 밀키트 소분 보관법 및 냉장고 파먹기 노하우 🍳 #생활꿀팁 #자취꿀팁 #일상",
        "말투 하나로 호감도를 10배 올리는 대화의 심리학: 경청과 질문의 기술 🗣️ #인간관계 #대화법 #자기계발"
    ],
    "cafe": [
        "성수동 골목에 숨겨진 신상 드립커피 전문점 ☕️ 에티오피아 원두의 산미가 예술입니다. #성수카페 #핸드드립 #카페투어",
        "비 오는 날 연남동 창가 자리에서 즐기는 따뜻한 플랫화이트와 바닐라 까눌레 🌧️ #연남카페 #디저트맛집 #감성카페",
        "종로 한옥 카페의 고즈넉한 정취 🍃 고요한 정원 바라보며 마시는 차 한 잔의 힐링 #한옥카페 #종로카페 #주말나들이"
    ],
    "travel": [
        "에메랄드빛 제주 협재 바다 🌊 노을 질 때의 핑크빛 하늘은 정말 평생 잊지 못할 풍경입니다. #제주여행 #협재해변 #국내여행",
        "도쿄 골목골목 필름카메라 출사 📸 시부야의 밤거리와 고즈넉한 골목의 대비 #일본여행 #도쿄 #필름사진 #여행기록",
        "스위스 인터라켄 융프라우요흐 만년설 기차 여행 🏔️ 숨이 멎을 듯한 알프스의 웅장함 #스위스 #유럽여행 #버킷리스트"
    ],
    "fashion": [
        "간절기 클래식 트렌치코트 코디 🧥 옥스포드 셔츠와 와이드 슬랙스로 완성한 데일리룩 #OOTD #데일리룩 #출근룩",
        "요즘 가장 인기 있는 레트로 스니커즈 추천 TOP 5 👟 어디에나 잘 어울리는 기본템 #스니커즈 #신발추천 #스트릿패션",
        "미니멀한 블랙 앤 화이트 셋업 코디. 심플하지만 확실한 실루엣의 멋 🖤 #미니멀룩 #모던룩 #패션스타그램"
    ],
    "food": [
        "숙성 한우 오마카세 다이닝 🥩 입안에서 사르르 녹아내리는 육즙의 향연 #한우오마카세 #미식가 #맛집투어",
        "집에서 15분 만에 만드는 정통 이탈리안 까르보나라 🍝 계란 노른자와 판체타의 진한 풍미 #홈쿠킹 #요리스타그램 #파스타",
        "을지로 노포 감성 골목 야장 투어 🍻 연탄불에 구워먹는 매콤한 꼼장어와 시원한 맥주 #을지로맛집 #노포맛집 #술스타그램"
    ],
    "pets": [
        "산책 나가자고 꼬리 살랑살랑 흔드는 우리 집 골든리트리버 🐶 주말엔 한강 잔디밭으로! #댕댕이 #골든리트리버 #멍스타그램",
        "햇살 드는 거실 바닥에서 낮잠 자는 치즈냥이 🐱 꾹꾹이 소리가 집안 가득 힐링 #냥스타그램 #고양이 #집사일상",
        "강아지 수제 간식 만들기: 단호박 닭가슴살 큐브 레시피 🍠 우리 댕댕이 최애 간식 등극! #강아지수제간식 #펫스타그램"
    ],
    "art": [
        "국립현대미술관 특별 기획전 관람 🎨 빛과 조형물이 만들어내는 초현실적인 공간 #전시회추천 #현대미술 #미술관데이트",
        "주말 취미로 시작한 오일파스텔 드로잉 🖍️ 노을 진 바다 풍경 완성 #오일파스텔 #취미미술 #그림스타그램",
        "빈티지 필름 카메라로 담아낸 도시의 건축미 🏛️ 아날로그 감성이 주는 따스한 빛 #건축사진 #필름카메라 #감성사진"
    ],
    "comedy": [
        "월요일 출근길 지하철에서 내 영혼 상태... 현실 고증 100% ㅋㅋㅋ 🤣 #직장인밈 #월요병 #공감영상 #웃긴짤",
        "다이어트 3일차에 야식 배달 앱 켰을 때 벌어지는 내적 갈등 🍗 눈물 나는 공감대 #다이어트실패 #유머 #쇼츠",
        "헬스장 처음 간 친구 자세 봐줄 때 특 ㅋㅋㅋ 숨넘어가는 줄 알았네 #헬스유머 #친구케미 #웃긴영상"
    ],
    "celebrity": [
        "이번 신곡 챌린지 안무 칼군무 실화인가요?! 동선이랑 비트 쪼개기 레전드 댄스 🔥 #KPOP #아이돌챌린지 #댄스커버",
        "레드카펫 룩 올타임 레전드 경신 ✨ 턱시도와 드레스 핏의 정석을 보여주는 비주얼 #연예인패션 #시상식 #화보",
        "콘서트 라이브 현장 직캠 🎤 떼창 소름 돋았던 앵콜 무대 클립 #콘서트직캠 #라이브무대 #팬스타그램"
    ],
    "gaming": [
        "마지막 1vs4 클러치 역전승 순간!! 심장 터지는 줄 알았습니다 🎮 손에 땀을 쥐는 매치 #게임하이라이트 #FPS #클러치",
        "스팀 가성비 인디 갓겜 추천! 주말 동안 시간 순삭 보장하는 명작 🕹️ #스팀게임 #인디게임 #게임추천",
        "드디어 완성한 트리플 모니터 게이밍 룸 셋업 👾 네온 조명 세팅 완벽하네요 #게이밍룸 #데스크셋업 #게이머"
    ],
    "beauty": [
        "환절기 속건조 완벽 해결한 올리브영 세럼 추천템 💧 피부결이 보들보들해져요 #스킨케어 #올영세일 #피부관리",
        "5분 만에 끝내는 꾸안꾸 내추럴 데일리 메이크업 💄 자연스러운 혈색 살리기 #데일리메이크업 #뷰티팁 #꾸안꾸",
        "올가을 트렌드 립 컬러 발색 비교! 웜톤/쿨톤 맞춤 가이드 💋 #립발색 #가을메이크업 #뷰티스타그램"
    ],
    "music": [
        "밤에 드라이브할 때 들으면 감성 터지는 인디 팝 플레이리스트 🎶 #인디음악 #플레이리스트 #드라이브송",
        "비 오는 날 카페에서 듣는 어쿠스틱 기타 라이브 🎸 편안한 선율에 마음이 몽글몽글 #어쿠스틱 #기타연주 #라이브음악",
        "LP 레코드판으로 감상하는 80년대 시티팝 감성 📻 턴테이블 바늘 떨어지는 소리 최고 #바이닐 #시티팝 #LP감성"
    ],
    "interior": [
        "6평 원룸 자취방 감성 인테리어 룸투어 🛋️ 공간 분리와 조명만으로 분위기 180도 변신! #룸투어 #원룸인테리어 #자취방꾸미기",
        "식물로 채우는 플랜테리어 🌿 몬스테라와 올리브나무로 싱그러워진 거실 공간 #플랜테리어 #홈스타일링 #식집사",
        "주말 미니멀 홈카페 코너 꾸미기 ☕️ 선반 정리와 원목 소품으로 아늑하게 #홈카페인테리어 #셀프인테리어 #집꾸미기"
    ]
}

# ---------------------------------------------------------------------------
# 6. 100인 페르소나 정의 (16대 카테고리 균형 분포)
# ---------------------------------------------------------------------------
KOREAN_FIRST_NAMES = [
    "민준", "서준", "도윤", "예준", "시우", "하준", "주원", "지호", "지후", "준서",
    "서연", "서윤", "지우", "서현", "하은", "하윤", "민서", "지아", "윤서", "채원",
    "수아", "다은", "예린", "소율", "지유", "채은", "가은", "유진", "시은", "예나",
    "현우", "건우", "우진", "선우", "서진", "유찬", "시원", "진우", "은우", "태윤"
]
KOREAN_LAST_NAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍"]

def generate_100_personas():
    personas = []
    # 16개 카테고리별로 각 6명 내외 (16 * 6 = 96명 + 4명 = 100명)
    all_cats = list(CATEGORIES)
    
    for i in range(100):
        primary_cat = all_cats[i % len(all_cats)]
        # 서브 카테고리 2~3개 (친화도 있는 카테고리 조합)
        candidates = [c for c in all_cats if c != primary_cat]
        secondary_cats = random.sample(candidates, 3)

        first_name = KOREAN_FIRST_NAMES[i % len(KOREAN_FIRST_NAMES)]
        last_name = KOREAN_LAST_NAMES[i % len(KOREAN_LAST_NAMES)]
        full_name = f"{last_name}{first_name}"
        
        # 유저네임
        username = f"{primary_cat}_{first_name.lower()}_{i+1}"
        
        # 활동 유형 (파워 크리에이터 15%, 액티브 35%, 일반 소비자 50%)
        if i < 15:
            user_tier = "power_creator"
        elif i < 50:
            user_tier = "active"
        else:
            user_tier = "consumer"

        bio_map = {
            "fitness": f"💪 매일 오운완 실천 중인 {full_name} | 식단&운동 루틴 공유",
            "tech": f"💻 풀스택 & AI에 진심인 개발자 {full_name} | Tech & Code Tips",
            "finance": f"📈 30대 10억 모으기 프로젝트 | {full_name}의 실전 재테크 가이드",
            "knowledge_daily": f"📚 매일 1%씩 성장하는 삶 | {full_name}의 생산성 & 독서 습관",
            "cafe": f"☕️ 주말마다 카페투어 다니는 {full_name} | 성수/연남 감성 스팟",
            "travel": f"✈️ 세상의 아름다운 풍경을 담는 여행자 {full_name} 🌏",
            "fashion": f"🧥 미니멀 & 데일리룩 아카이브 | {full_name}'s OOTD",
            "food": f"🍽️ 맛있는 건 다 먹어봐야 직성 풀리는 미식가 {full_name}",
            "pets": f"🐾 반려견 보리와 함께하는 우당탕탕 힐링 일상 🐶",
            "art": f"🎨 미술관과 전시회를 사랑하는 디자이너 {full_name}",
            "comedy": f"🤣 하루 한 번 웃고 가세요! 세상에서 가장 웃긴 릴스 모음",
            "celebrity": f"✨ K-POP & 아이돌 무대 챌린지 아카이브 덕질 계정",
            "gaming": f"🎮 FPS & 스팀 갓겜 매니아 | 하이라이트 클립 저장소",
            "beauty": f"💄 피부 속광 뷰티 루틴 & 웜톤 메이크업 꿀팁 공유",
            "music": f"🎧 비 오는 날 듣기 좋은 감성 인디음악 & LP 바이닐",
            "interior": f"🛋️ 자취방 룸투어 & 감성 공간 스타일링 기록 🌿"
        }
        
        bio = bio_map.get(primary_cat, f"{full_name}의 인스타그램 일상 아카이브 ✨")
        avatar = AVATAR_URLS[i % len(AVATAR_URLS)]

        personas.append({
            "username": username,
            "email": f"{username}@instagram.local",
            "full_name": full_name,
            "bio": bio,
            "profile_image_url": avatar,
            "primary_cat": primary_cat,
            "secondary_cats": secondary_cats,
            "tier": user_tier
        })

    return personas

# ---------------------------------------------------------------------------
# 7. 메인 시딩 파이프라인
# ---------------------------------------------------------------------------
def seed_database():
    print("==================================================================")
    print("🚀 [Supabase] 16대 카테고리 100인 페르소나 및 체류시간 데이터 시딩 시작")
    print("==================================================================")

    db = SessionLocal()
    default_pw_hash = get_password_hash("pass123")

    try:
        # 1. 대상 유저 제임스(홍기영) 확인 및 생성/업데이트
        print("\n--- 1. 제임스(홍기영) 계정 구성 ---")
        james_email = "cjswo329329@gmail.com"
        james = db.query(User).filter(User.email == james_email).first()
        if not james:
            james = User(
                username="hong_james",
                email=james_email,
                hashed_password=default_pw_hash,
                full_name="홍기영",
                bio="🏋️‍♂️ 운동 & 오운완 | 💻 풀스택 개발자 & AI | 📈 재테크 & 경제적 자유 | 📚 매일 1% 성장",
                profile_image_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
                is_private=False,
                is_verified=True,
                is_admin=False
            )
            db.add(james)
            db.commit()
            db.refresh(james)
            print(f"✅ 제임스(홍기영) 계정 신규 생성 완료 (id={james.id})")
        else:
            james.bio = "🏋️‍♂️ 운동 & 오운완 | 💻 풀스택 개발자 & AI | 📈 재테크 & 경제적 자유 | 📚 매일 1% 성장"
            james.is_verified = True
            db.commit()
            print(f"ℹ️ 기존 제임스(홍기영) 계정 유지 및 프로필 업데이트 (id={james.id})")

        # 제임스의 선호 취향 정의
        JAMES_PREFERENCES = ["fitness", "knowledge_daily", "tech", "finance"]

        # 2. 100인 페르소나 유저 생성
        print("\n--- 2. 100인 페르소나 유저 데이터베이스 적재 ---")
        personas_data = generate_100_personas()
        created_users = []
        user_meta_map = {} # user_id -> persona meta

        # 제임스 메타 등록
        user_meta_map[james.id] = {
            "primary_cat": "tech",
            "secondary_cats": ["fitness", "knowledge_daily", "finance"],
            "tier": "active",
            "is_james": True
        }

        existing_users_by_username = {u.username: u for u in db.query(User).all()}

        for p in personas_data:
            existing_user = existing_users_by_username.get(p["username"])
            if not existing_user:
                new_u = User(
                    username=p["username"],
                    email=p["email"],
                    hashed_password=default_pw_hash,
                    full_name=p["full_name"],
                    bio=p["bio"],
                    profile_image_url=p["profile_image_url"],
                    is_private=False,
                    is_verified=(p["tier"] == "power_creator"),
                    is_admin=False
                )
                db.add(new_u)
                db.flush()
                user_obj = new_u
                existing_users_by_username[p["username"]] = new_u
            else:
                user_obj = existing_user

            created_users.append(user_obj)
            user_meta_map[user_obj.id] = {
                "primary_cat": p["primary_cat"],
                "secondary_cats": p["secondary_cats"],
                "tier": p["tier"],
                "is_james": False
            }

        db.commit()
        all_active_users = [james] + created_users
        print(f"✅ 총 {len(all_active_users)}명 유저 준비 완료 (제임스 포함)")

        # 3. 16대 카테고리 피드 게시물 생성 (카테고리당 15개 = 240개)
        print("\n--- 3. 16대 카테고리 피드 게시물 240개 생성 ---")
        # 부분 생성된 게시물 및 미디어 정리 후 240개 일괄 생성
        db.query(PostMedia).delete()
        db.query(Post).delete()
        db.commit()

        posts_to_create = []
        for cat in CATEGORIES:
            images = IMAGE_BANKS.get(cat, IMAGE_BANKS["cafe"])
            captions = CAPTION_TEMPLATES.get(cat, [f"{cat} 카테고리의 유용한 일상 팁 공유! #{cat}"])
            
            # 해당 카테고리를 좋아하는 유저 중에서 작성자 선별
            cat_authors = [u for u in all_active_users if user_meta_map[u.id]["primary_cat"] == cat or u.id == james.id]
            if not cat_authors:
                cat_authors = all_active_users

            for k in range(15): # 카테고리당 15개
                author = cat_authors[k % len(cat_authors)]
                img_url = images[k % len(images)]
                caption = captions[k % len(captions)]
                created_time = datetime.utcnow() - timedelta(days=random.randint(1, 30), hours=random.randint(1, 23))

                p = Post(
                    user_id=author.id,
                    caption=caption,
                    location="Seoul, Korea" if random.random() > 0.3 else None,
                    category=cat,
                    created_at=created_time,
                    updated_at=created_time,
                    media=[PostMedia(media_url=img_url, media_type="image", order_index=0, created_at=created_time)]
                )
                db.add(p)
                posts_to_create.append(p)
        db.commit()
        print(f"✅ 신규 피드 게시물 {len(posts_to_create)}개 일괄 생성 완료")

        # 4. 16대 카테고리 릴스 생성 (20종 비디오 고르게 분배, 총 160개)
        print("\n--- 4. 16대 카테고리 릴스 160개 생성 ---")
        # 기존 릴스 정리 후 160개 일괄 생성
        db.query(Reel).delete()
        db.commit()

        reels_to_create = []
        for idx in range(160):
            cat = CATEGORIES[idx % len(CATEGORIES)]
            meta = REEL_VIDEO_METAS[idx % len(REEL_VIDEO_METAS)]
            
            # 작성자 선별
            cat_authors = [u for u in all_active_users if user_meta_map[u.id]["primary_cat"] == cat or u.id == james.id]
            if not cat_authors:
                cat_authors = all_active_users
            author = cat_authors[idx % len(cat_authors)]

            captions = CAPTION_TEMPLATES.get(cat, [f"{cat} 숏폼 릴스 영상! #{cat}"])
            caption = captions[idx % len(captions)]
            created_time = datetime.utcnow() - timedelta(days=random.randint(1, 20), hours=random.randint(1, 23))

            reel = Reel(
                user_id=author.id,
                video_url=meta["video"],
                poster_url=None,
                caption=caption,
                category=cat,
                duration_ms=meta["duration_ms"],
                tagged_user=None,
                audio_title=meta["audio"],
                audio_cover_url=None,
                audio_is_explicit=False,
                shares_count=random.randint(5, 80),
                reposts_count=random.randint(1, 30),
                created_at=created_time
            )
            db.add(reel)
            reels_to_create.append(reel)

        db.commit()
        print(f"✅ 신규 릴스 {len(reels_to_create)}개 일괄 생성 완료 (20종 비디오 순환 분배)")

        # 5. 팔로우 네트워크 생성 (취향 클러스터 중심 연결)
        print("\n--- 5. 소셜 팔로우 그래프 형성 ---")
        existing_follows = db.query(Follow).count()
        if existing_follows < 500:
            follow_objs = []
            seen_follows = set()

            for u in all_active_users:
                u_meta = user_meta_map[u.id]
                # 제임스는 운동, 지식, 테크, 재테크 크리에이터 위주 팔로우
                if u.id == james.id:
                    target_candidates = [
                        t for t in all_active_users 
                        if t.id != james.id and user_meta_map[t.id]["primary_cat"] in JAMES_PREFERENCES
                    ]
                    follow_targets = random.sample(target_candidates, min(30, len(target_candidates)))
                else:
                    # 일반 유저는 같은 관심사 유저 위주로 10~25명 팔로우
                    same_interest = [
                        t for t in all_active_users 
                        if t.id != u.id and (user_meta_map[t.id]["primary_cat"] == u_meta["primary_cat"] or user_meta_map[t.id]["primary_cat"] in u_meta["secondary_cats"])
                    ]
                    other_interest = [t for t in all_active_users if t.id != u.id and t not in same_interest]
                    
                    target_count = 20 if u_meta["tier"] == "power_creator" else random.randint(8, 16)
                    picked_same = random.sample(same_interest, min(int(target_count * 0.75), len(same_interest)))
                    picked_other = random.sample(other_interest, min(target_count - len(picked_same), len(other_interest)))
                    follow_targets = picked_same + picked_other

                for target in follow_targets:
                    pair = (u.id, target.id)
                    if pair not in seen_follows:
                        seen_follows.add(pair)
                        follow_objs.append(Follow(
                            follower_id=u.id,
                            following_id=target.id,
                            status="accepted",
                            created_at=datetime.utcnow() - timedelta(days=random.randint(5, 40))
                        ))

            db.bulk_save_objects(follow_objs)
            db.commit()
            print(f"✅ 팔로우 관계 {len(follow_objs)}건 생성 완료")

        # 6. 체류시간(Content Views) & 좋아요 & 북마크 대규모 시딩
        print("\n--- 6. 체류시간(ms) 및 상호작용(좋아요/북마크) 시딩 ---")
        all_posts = db.query(Post).all()
        all_reels = db.query(Reel).all()

        views_to_insert = []
        likes_to_insert = []
        bookmarks_to_insert = []
        comments_to_insert = []

        seen_likes = set()
        seen_bookmarks = set()

        REALISTIC_COMMENTS = [
            "진짜 유용한 정보네요! 저장해두고 봅니다 👍",
            "완전 공감되네요 ㅎㅎ 좋은 피드 감사합니다!",
            "이번 루틴에 바로 적용해봐야겠어요 🔥",
            "오늘도 좋은 꿀팁 잘 배우고 갑니다 ✨",
            "이건 진짜 꿀팁이다... 대박",
            "사진 분위기 너무 좋네요!! 힐링하고 가요 🍃",
            "자세한 설명 감사합니다! 질문 하나 드려도 될까요?",
            "와 레전드네요 ㅋㅋㅋ 친구한테 바로 공유함",
            "깔끔한 정리 감사합니다! 팔로우하고 가요 🙌"
        ]

        # 모든 유저가 활발한 소비자로 시청 기록 생성
        for u in all_active_users:
            u_meta = user_meta_map[u.id]
            is_james_user = (u.id == james.id)

            # 소비량 결정 (파워 크리에이터도 소비자이므로 최소 70개 이상 소비)
            if is_james_user:
                items_to_sample = 160
            elif u_meta["tier"] == "power_creator":
                items_to_sample = random.randint(90, 130)
            elif u_meta["tier"] == "active":
                items_to_sample = random.randint(60, 90)
            else:
                items_to_sample = random.randint(40, 65)

            # 피드 & 릴스 섞어서 샘플링
            sampled_posts = random.sample(all_posts, min(items_to_sample // 2, len(all_posts)))
            sampled_reels = random.sample(all_reels, min(items_to_sample // 2, len(all_reels)))

            # (A) 릴스 시청 시뮬레이션
            for r in sampled_reels:
                if is_james_user:
                    is_interested = (r.category in JAMES_PREFERENCES)
                else:
                    is_interested = (r.category == u_meta["primary_cat"] or r.category in u_meta["secondary_cats"])

                reel_dur = r.duration_ms if r.duration_ms else 15000

                if is_interested:
                    # 완주 또는 루프 반복 시청
                    watch_ratio = round(random.uniform(1.0, 2.4), 3) # 100% ~ 240% (반복 재생)
                    duration_ms = int(reel_dur * watch_ratio)
                    completed = True
                    not_interested = False

                    # 높은 좋아요 확률 (70%)
                    if random.random() < 0.70:
                        like_key = (u.id, "reel", r.id)
                        if like_key not in seen_likes:
                            seen_likes.add(like_key)
                            likes_to_insert.append(Like(user_id=u.id, reel_id=r.id))

                    # 북마크 확률 (정보성/선호 카테고리는 30~45% 저장)
                    bookmark_prob = 0.40 if r.category in ["finance", "tech", "fitness", "knowledge_daily"] else 0.20
                    if random.random() < bookmark_prob:
                        bm_key = (u.id, "reel", r.id)
                        if bm_key not in seen_bookmarks:
                            seen_bookmarks.add(bm_key)
                            bookmarks_to_insert.append(Bookmark(user_id=u.id, reel_id=r.id))

                    # 댓글 확률 (8%)
                    if random.random() < 0.08:
                        comments_to_insert.append(Comment(
                            post_id=None,
                            reel_id=r.id,
                            user_id=u.id,
                            content=random.choice(REALISTIC_COMMENTS)
                        ))

                else:
                    # 비관심 영역: 0.5초 ~ 1.5초만에 조기 스킵
                    duration_ms = random.randint(400, 1400)
                    watch_ratio = round(duration_ms / reel_dur, 3)
                    completed = False
                    # 자극적 연예인 가십 등에 명시적 부정 피드백 (2%)
                    not_interested = (r.category == "celebrity" and random.random() < 0.04)

                views_to_insert.append(ContentView(
                    user_id=u.id,
                    post_id=None,
                    reel_id=r.id,
                    duration_ms=duration_ms,
                    watch_ratio=watch_ratio,
                    completed=completed,
                    not_interested=not_interested,
                    source=random.choice(["reels", "explore", "feed"])
                ))

            # (B) 피드 게시물 시청 시뮬레이션
            for p in sampled_posts:
                if is_james_user:
                    is_interested = (p.category in JAMES_PREFERENCES)
                else:
                    is_interested = (p.category == u_meta["primary_cat"] or p.category in u_meta["secondary_cats"])

                if is_interested:
                    # 정독 (4초 ~ 18초 체류)
                    duration_ms = random.randint(4500, 18000)
                    watch_ratio = round(min(1.0, duration_ms / 5000.0), 2)
                    completed = True
                    not_interested = False

                    # 좋아요 (65%)
                    if random.random() < 0.65:
                        like_key = (u.id, "post", p.id)
                        if like_key not in seen_likes:
                            seen_likes.add(like_key)
                            likes_to_insert.append(Like(user_id=u.id, post_id=p.id))

                    # 북마크 (35%)
                    if random.random() < 0.35:
                        bm_key = (u.id, "post", p.id)
                        if bm_key not in seen_bookmarks:
                            seen_bookmarks.add(bm_key)
                            bookmarks_to_insert.append(Bookmark(user_id=u.id, post_id=p.id))

                    # 댓글 (6%)
                    if random.random() < 0.06:
                        comments_to_insert.append(Comment(
                            post_id=p.id,
                            reel_id=None,
                            user_id=u.id,
                            content=random.choice(REALISTIC_COMMENTS)
                        ))
                else:
                    # 스크롤 휙 넘김 (400ms ~ 1200ms)
                    duration_ms = random.randint(350, 1200)
                    watch_ratio = 0.1
                    completed = False
                    not_interested = False

                views_to_insert.append(ContentView(
                    user_id=u.id,
                    post_id=p.id,
                    reel_id=None,
                    duration_ms=duration_ms,
                    watch_ratio=watch_ratio,
                    completed=completed,
                    not_interested=not_interested,
                    source=random.choice(["feed", "explore"])
                ))

        # 배치 삽입 (성능 최적화)
        print(f"  총 체류시간 기록(views) {len(views_to_insert)}건 삽입 중...")
        BATCH_SIZE = 1000
        for i in range(0, len(views_to_insert), BATCH_SIZE):
            db.bulk_save_objects(views_to_insert[i:i+BATCH_SIZE])
            db.commit()

        print(f"  총 좋아요(likes) {len(likes_to_insert)}건 삽입 중...")
        for i in range(0, len(likes_to_insert), BATCH_SIZE):
            db.bulk_save_objects(likes_to_insert[i:i+BATCH_SIZE])
            db.commit()

        print(f"  총 북마크(bookmarks) {len(bookmarks_to_insert)}건 삽입 중...")
        for i in range(0, len(bookmarks_to_insert), BATCH_SIZE):
            db.bulk_save_objects(bookmarks_to_insert[i:i+BATCH_SIZE])
            db.commit()

        print(f"  총 댓글(comments) {len(comments_to_insert)}건 삽입 중...")
        for i in range(0, len(comments_to_insert), BATCH_SIZE):
            db.bulk_save_objects(comments_to_insert[i:i+BATCH_SIZE])
            db.commit()

        print("\n==================================================================")
        print("🎉 [Supabase] 대규모 추천 데이터 시딩 최종 결과")
        print("==================================================================")
        print(f"  - 총 유저 수: {db.query(User).count()}명 (제임스 포함)")
        print(f"  - 총 피드 게시물: {db.query(Post).count()}개 (16대 카테고리 균등 분배)")
        print(f"  - 총 릴스 수: {db.query(Reel).count()}개 (20종 비디오 분배)")
        print(f"  - 총 체류시간 기록: {db.query(ContentView).count()}건 (연속형 ms & 완주율)")
        print(f"  - 총 좋아요 수: {db.query(Like).count()}건")
        print(f"  - 총 북마크 수: {db.query(Bookmark).count()}건")
        print(f"  - 총 댓글 수: {db.query(Comment).count()}건")
        print(f"  - 총 팔로우 수: {db.query(Follow).count()}건")
        
        # 제임스 활동 요약 확인
        james_views = db.query(ContentView).filter(ContentView.user_id == james.id).count()
        james_likes = db.query(Like).filter(Like.user_id == james.id).count()
        james_bookmarks = db.query(Bookmark).filter(Bookmark.user_id == james.id).count()
        print(f"\n👤 [제임스(홍기영) 활동 요약]")
        print(f"  - 시청 기록: {james_views}건 (운동/지식/테크/재테크 고체류시간 집중)")
        print(f"  - 누른 좋아요: {james_likes}건")
        print(f"  - 북마크 저장: {james_bookmarks}건")
        print("==================================================================")

    except Exception as e:
        db.rollback()
        print(f"❌ 시딩 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
