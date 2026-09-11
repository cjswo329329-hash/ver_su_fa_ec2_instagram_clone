"""
generate_160_reel_videos.py
=============================================================================
16대 카테고리 x 10종 = 총 160개의 고유한 세로형(9:16) MP4 릴스 비디오를
초경량 고화질 H.264 포맷으로 물리적 생성하는 초고속 병렬 렌더러.
=============================================================================
"""

import os
import sys
import math
import time
from concurrent.futures import ProcessPoolExecutor
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio.v3 as iio

# 16대 카테고리 정의 및 카테고리별 테마 비주얼 설정
CATEGORIES = [
    "fitness", "tech", "finance", "knowledge_daily",
    "cafe", "travel", "fashion", "food",
    "pets", "art", "comedy", "celebrity",
    "gaming", "beauty", "music", "interior"
]

CATEGORY_THEMES = {
    "fitness": {
        "badge": "FITNESS & HEALTH",
        "colors": [(255, 69, 0), (178, 34, 34), (20, 20, 25)],
        "accent": (255, 140, 0),
        "titles": [
            "하체 3대 500 스쿼트 루틴", "광배근 폭발 데드리프트", "새벽 공복 5km 러닝",
            "홈트 8분 복근 파괴 루틴", "고단백 닭가슴살 식단", "어깨 깡패 사이드 레터럴",
            "벤치프레스 100kg 도전기", "전신 버피 100개 챌린지", "운동 후 필수 스트레칭", "헬스 3년 차 변화 기록"
        ]
    },
    "tech": {
        "badge": "TECH & DEV",
        "colors": [(0, 191, 255), (25, 25, 112), (10, 15, 30)],
        "accent": (0, 255, 200),
        "titles": [
            "FastAPI 추천 엔진 구축기", "M3 맥북 개발 데스크 셋업", "LLM 프롬프트 엔지니어링",
            "도커 컨테이너 용량 최적화", "SQL 인덱스 성능 튜닝", "파이썬 클린 아키텍처",
            "Next.js 14 풀스택 팁", "백엔드 개발자 하루 루틴", "쿠버네티스 무중단 배포", "알고리즘 문제 해결 패턴"
        ]
    },
    "finance": {
        "badge": "FINANCE & WEALTH",
        "colors": [(218, 165, 32), (0, 100, 0), (15, 25, 20)],
        "accent": (255, 215, 0),
        "titles": [
            "사회초년생 월급 쪼개기", "S&P500 복리의 마법", "청약 가점 100% 당첨 전략",
            "연말정산 13월의 월급 팁", "재무제표 3대 핵심 지표", "미국 배당주 포트폴리오",
            "부동산 입지 분석 기초", "절세 계좌 ISA 활용법", "소비 절약 1000만원 모으기", "2030 파이어족 로드맵"
        ]
    },
    "knowledge_daily": {
        "badge": "DAILY INSIGHT",
        "colors": [(205, 133, 63), (70, 50, 40), (25, 20, 20)],
        "accent": (255, 222, 173),
        "titles": [
            "아침 5시 기상 21일 루틴", "뽀모도로 25분 초집중법", "자존감 높이는 3줄 감사일기",
            "자취생 냉장고 파먹기 팁", "호감도 10배 대화 심리학", "뇌를 깨우는 독서 메모법",
            "정리정돈 미니멀 라이프", "스트레스 완화 호흡 명상", "효율적인 하루 시간 관리", "감정 조절 멘탈 관리법"
        ]
    },
    "cafe": {
        "badge": "CAFE & COFFEE",
        "colors": [(160, 82, 45), (101, 67, 33), (30, 20, 15)],
        "accent": (245, 222, 179),
        "titles": [
            "성수동 드립커피 맛집", "연남동 비오는 날 플랫화이트", "종로 고즈넉한 한옥 카페",
            "홈카페 에스프레소 추출", "바닐라 까눌레 베이킹", "을지로 레트로 감성 다방",
            "제주 오션뷰 베이커리 카페", "원두 로스팅 테이스팅 노트", "아인슈페너 크림 만들기", "강남 조용한 북카페 투어"
        ]
    },
    "travel": {
        "badge": "TRAVEL & EXPLORE",
        "colors": [(0, 139, 139), (30, 144, 255), (10, 25, 40)],
        "accent": (127, 255, 212),
        "titles": [
            "제주 협재 노을 바다", "도쿄 밤거리 필름 사진", "스위스 인터라켄 만년설",
            "발리 우붓 정글 풀빌라", "파리 에펠탑 야경 스팟", "다낭 호이안 야시장 투어",
            "강릉 안목해변 일출 드라이브", "아이슬란드 오로라 로드트립", "방콕 카오산로드 길거리 음식", "뉴욕 타임스퀘어 브이로그"
        ]
    },
    "fashion": {
        "badge": "FASHION & OOTD",
        "colors": [(112, 128, 144), (47, 79, 79), (20, 20, 20)],
        "accent": (240, 248, 255),
        "titles": [
            "클래식 트렌치코트 룩", "레트로 스니커즈 베스트 5", "블랙앤화이트 미니멀 셋업",
            "가을 데일리 출근룩 코디", "와이드 슬랙스 체형별 연출", "성수동 빈티지샵 하울",
            "체크 셔츠 레이어드 꿀팁", "실패 없는 니트 코디 공식", "스트릿 웨어 캡모자 스타일", "간절기 레더 자켓 추천"
        ]
    },
    "food": {
        "badge": "FOOD & RECIPE",
        "colors": [(220, 20, 60), (139, 0, 0), (25, 10, 10)],
        "accent": (255, 165, 0),
        "titles": [
            "두툼한 육즙 토마호크 스테이크", "트러플 크림 파스타 레시피", "문래동 숨은 노포 삼겹살",
            "바삭바삭 수제 일식 돈카츠", "매콤달콤 떡볶이 황금 레시피", "신선한 연어 사시미 플레이팅",
            "치즈 폭탄 시카고 피자", "진한 사골 라멘 한 그릇", "수제 소고기 수제버거", "달콤한 디저트 수플레 팬케이크"
        ]
    },
    "pets": {
        "badge": "PETS & ANIMALS",
        "colors": [(255, 182, 193), (219, 112, 147), (30, 20, 25)],
        "accent": (255, 240, 245),
        "titles": [
            "골든리트리버 꼬리콥터", "아기고양이 꾹꾹이 모음", "강아지 첫 눈밭 산책",
            "간식 보고 흥분한 포메라니안", "고양이 식빵 굽는 순간", "푸들의 똑똑한 개인기",
            "댕댕이 목욕 후 우다다", "길냥이 츄르 먹방 브이로그", "비숑프리제 헬멧 미용 후기", "집사 심쿵 젤리 발바닥"
        ]
    },
    "art": {
        "badge": "ART & CREATIVE",
        "colors": [(138, 43, 226), (75, 0, 130), (20, 10, 30)],
        "accent": (238, 130, 238),
        "titles": [
            "현대 미술 전시회 관람", "아크릴 나이프 페인팅", "디지털 일러스트 드로잉",
            "도자기 물레 성형 체험", "수채화 풍경 일러스트", "감성 캘리그라피 손글씨",
            "미디어아트 몰입형 미디어", "레진 아트 티코스터 제작", "유화 텍스처 질감 연구", "조각상과 빛의 그림자"
        ]
    },
    "comedy": {
        "badge": "COMEDY & MEMES",
        "colors": [(255, 215, 0), (255, 140, 0), (30, 25, 10)],
        "accent": (255, 255, 0),
        "titles": [
            "직장인 월요병 현실 공감", "다이어트 작심 3분 짤", "MBTI 극 I의 회식 자리",
            "혼자 놀기 끝판왕 챌린지", "친구 약속 5분 전 공감", "반려견 엉뚱한 실수 모음",
            "시험 기간 도서관의 기적", "헬스장 헬린이 실수 모음", "웃음 참기 레전드 밈", "배달음식 도착했을 때 리액션"
        ]
    },
    "celebrity": {
        "badge": "ENTERTAINMENT",
        "colors": [(255, 20, 147), (199, 21, 133), (25, 10, 25)],
        "accent": (255, 105, 180),
        "titles": [
            "신곡 댄스 챌린지 하이라이트", "음악방송 무대 직캠 킬링파트", "콘서트 라이브 떼창 현장",
            "공항 패션 레드카펫 포토월", "아이돌 연습실 안무 연습", "팬사인회 심쿵 팬서비스",
            "시상식 축하 무대 오프닝", "백스테이지 비하인드 직캠", "감성 보컬 커버 라이브", "뮤직비디오 티저 촬영 현장"
        ]
    },
    "gaming": {
        "badge": "GAMING & ESPORTS",
        "colors": [(50, 205, 50), (0, 128, 0), (10, 30, 15)],
        "accent": (0, 255, 127),
        "titles": [
            "롤 랭크전 1v5 역전 슈퍼플레이", "배그 마지막 치킨 클러치 순간", "발로란트 에이스 올킬 클립",
            "최신 콘솔 오픈월드 그래픽", "게이밍 룸 RGB 조명 세팅", "스팀 신작 인디게임 플레이",
            "프로게이머 대회 명장면", "소울라이크 보스전 노히트 클리어", "레이싱 휠 몰입 시뮬레이터", "스위치 파티게임 하이라이트"
        ]
    },
    "beauty": {
        "badge": "BEAUTY & MAKEUP",
        "colors": [(255, 105, 180), (218, 112, 214), (30, 15, 25)],
        "accent": (255, 192, 203),
        "titles": [
            "유리알 글래스 스킨케어", "출근 10분 퀵 메이크업", "가을 웜톤 립스틱 추천 5종",
            "피부결 정돈 나이트 루틴", "음영 아이메이크업 튜토리얼", "올리브영 꿀템 하울",
            "베이스 안 뜨는 밀착 피부", "촉촉한 물광 피부 비결", "퍼스널 컬러 진단 후기", "자극 없는 클렌징 루틴"
        ]
    },
    "music": {
        "badge": "MUSIC & BEATS",
        "colors": [(65, 105, 225), (75, 0, 130), (15, 10, 30)],
        "accent": (135, 206, 250),
        "titles": [
            "비 오는 날 감성 Lo-Fi 비트", "어쿠스틱 기타 솔로 라이브", "새벽 감성 재즈 플레이리스트",
            "클럽 DJ 페스티벌 드랍", "피아노 즉흥 연주 힐링", "신디사이저 80s 시티팝",
            "버스킹 현장 라이브 앙코르", "드럼 비트 그루브 연주", "베이스 슬랩 테크닉", "감미로운 R&B 보컬 멜로디"
        ]
    },
    "interior": {
        "badge": "INTERIOR & HOME",
        "colors": [(107, 142, 35), (85, 107, 47), (20, 25, 15)],
        "accent": (240, 230, 140),
        "titles": [
            "아늑한 7평 원룸 인테리어", "플랜테리어 초록 식물 스타일링", "감성 조명으로 방 분위기 변신",
            "화이트 우드 미니멀 거실", "모던 미드센추리 가구 배치", "홈오피스 서재 인테리어",
            "아늑한 침실 무드등 연출", "수납장 정리정돈 꿀팁", "주방 다이닝 테이블 세팅", "욕실 호텔식 리모델링"
        ]
    }
}

def render_single_reel(args):
    """단일 릴스 비디오 생성 함수 (멀티프로세싱 호환)"""
    idx, category, title, out_path = args
    theme = CATEGORY_THEMES[category]
    badge = theme["badge"]
    c1, c2, c3 = theme["colors"]
    accent = theme["accent"]

    width, height = 540, 960
    fps = 20
    duration_sec = 3
    total_frames = int(duration_sec * fps)

    frames = []

    for f_idx in range(total_frames):
        t = f_idx / total_frames
        
        # 1. 시네마틱 모션 그라디언트 캔버스 생성
        img = Image.new("RGB", (width, height), c3)
        draw = ImageDraw.Draw(img)

        # 동적 웨이브 파동 및 광원 효과
        step = 6
        for y in range(0, height, step):
            norm_y = y / height
            # 파동 효과: 시간에 따른 sin/cos 위상 변화
            wave = math.sin(t * 2 * math.pi + norm_y * 4 + idx * 0.5)
            r = int(c3[0] + (c1[0] - c3[0]) * (norm_y + 0.3 * wave))
            g = int(c3[1] + (c1[1] - c3[1]) * (norm_y + 0.3 * wave))
            b = int(c3[2] + (c2[2] - c3[2]) * (norm_y + 0.3 * wave))
            r = max(0, min(255, r))
            g = max(0, min(255, g))
            b = max(0, min(255, b))
            draw.line([(0, y), (width, y)], fill=(r, g, b), width=step)

        # 2. 다이내믹 중앙 링 / 펄스 효과
        pulse_r = int(120 + 30 * math.sin(t * 2 * math.pi + idx))
        center_y = int(height * 0.45)
        center_x = width // 2
        draw.ellipse(
            [(center_x - pulse_r, center_y - pulse_r), (center_x + pulse_r, center_y + pulse_r)],
            outline=accent, width=2
        )
        small_pulse = int(pulse_r * 0.7)
        draw.ellipse(
            [(center_x - small_pulse, center_y - small_pulse), (center_x + small_pulse, center_y + small_pulse)],
            outline=(255, 255, 255, 120), width=1
        )

        # 3. 릴스 번호 인디케이터 (상단)
        draw.rectangle([(center_x - 70, 80), (center_x + 70, 115)], fill=(0, 0, 0, 180), outline=accent, width=1)
        draw.text((center_x, 97), f"REEL #{idx:03d}", fill=accent, anchor="mm")

        # 4. 카테고리 뱃지 박스 (중앙 상단)
        draw.rectangle([(60, center_y - 120), (width - 60, center_y - 70)], fill=(0, 0, 0, 200), outline=(255, 255, 255, 180), width=1)
        draw.text((center_x, center_y - 95), badge, fill=(255, 255, 255), anchor="mm")

        # 5. 메인 타이틀 박스 (중앙)
        draw.rectangle([(40, center_y - 50), (width - 40, center_y + 60)], fill=(10, 10, 15, 230), outline=accent, width=2)
        draw.text((center_x, center_y + 5), title, fill=(255, 255, 255), anchor="mm")

        # 6. 인스타그램 릴스 감성 태그 (중앙 하단)
        draw.text((center_x, center_y + 90), f"#{category} #reel{idx} #explore", fill=(200, 200, 210), anchor="mm")

        # 7. 하단 프로그레스 바
        prog_w = int(width * t)
        draw.rectangle([(0, height - 8), (prog_w, height)], fill=(225, 48, 108))

        frames.append(np.array(img))

    iio.imwrite(out_path, frames, fps=fps, codec='libx264')
    return idx, out_path, os.path.getsize(out_path)

def main():
    start_time = time.time()
    dest_dir = "d:/바이브코딩/Instagram_Vercel_Supabase_FastAPI/frontend/public/videos"
    os.makedirs(dest_dir, exist_ok=True)

    tasks = []
    idx = 1
    for cat in CATEGORIES:
        theme = CATEGORY_THEMES[cat]
        titles = theme["titles"]
        for sub_idx in range(10):
            title = titles[sub_idx]
            out_file = os.path.join(dest_dir, f"reel{idx}.mp4")
            tasks.append((idx, cat, title, out_file))
            idx += 1

    print(f"Total reels to render: {len(tasks)} videos...")
    max_workers = min(os.cpu_count() or 4, 8)
    print(f"Using {max_workers} worker processes...")

    completed = 0
    total_size = 0
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        for reel_idx, path, size in executor.map(render_single_reel, tasks):
            completed += 1
            total_size += size
            if completed % 20 == 0 or completed == len(tasks):
                elapsed = time.time() - start_time
                print(f"[{completed}/{len(tasks)}] Done reel{reel_idx}.mp4 ({size//1024} KB) - Elapsed: {elapsed:.1f}s")

    elapsed = time.time() - start_time
    print(f"\n==================================================")
    print(f"All {len(tasks)} videos successfully generated!")
    print(f"Total size: {total_size / (1024 * 1024):.2f} MB")
    print(f"Total time: {elapsed:.1f} seconds")
    print(f"==================================================")

if __name__ == "__main__":
    main()
