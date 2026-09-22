---
trigger: always_on
description: "Instagram 클론 서비스 기능 기획서(SERVICE_SPECIFICATION.md) 준수 규칙"
---

# SERVICE_SPECIFICATION 준수 규칙

AI 에이전트는 백엔드 라우터, DB 쿼리, 프론트엔드 컴포넌트를 수정할 때마다 반드시 다음 기획 원칙을 준수해야 합니다:

1. **홈 피드 3단계 우선순위 노출**:
   - 1순위: 내 최신글 1회 노출 (확인 후 숨김)
   - 2순위: 내가 아직 안 본 친구의 미시청 글
   - 3순위: 무작위 추천 사용자의 미시청 글 (무한 스트림으로 피드 끊김 방지)
   - **절대 원칙**: 이미 시청한 글(`content_views`)은 피드에 절대 재노출 금지

2. **24시간 스토리 만료 및 시청 링(선셋 vs 회색) 시각화**
3. **릴스 연속 노출 방지(Deduplication) 및 스냅 스크롤**
4. **1:1 DM 단일 대화방 및 읽음 처리**

상세 명세는 [SERVICE_SPECIFICATION.md](../../SERVICE_SPECIFICATION.md)를 참조하십시오.
