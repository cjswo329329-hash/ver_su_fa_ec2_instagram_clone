#!/bin/bash

echo "📦 [1/3] 가상환경 활성화 및 의존성 확인..."
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install --no-cache-dir -r requirements.txt

echo "🔄 [2/3] 기존 8000번 포트 서버 안전 종료 및 uvicorn 백그라운드 실행..."
# 8000 포트를 점유하고 있는 프로세스 종료 (fuser 사용, 없을 경우 pkill로 보조)
fuser -k 8000/tcp 2>/dev/null || true
pkill -9 -f "uvicorn.*app.main:app" 2>/dev/null || true
sleep 2

# 백그라운드 무중단 실행 (표준 입출력 분리로 SSH 세션 블로킹 방지)
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 < /dev/null &

echo "✅ [3/3] 서버 구동 상태 점검 (3초 대기)..."
sleep 3

# 8000 포트가 열렸거나 프로세스가 살아있는지 검증
if pgrep -f "uvicorn.*app.main:app" > /dev/null; then
  echo "🎉 배포 성공! FastAPI 서버가 정상적으로 실행되었습니다."
else
  echo "⚠️ 서버 실행 실패! backend.log 확인:"
  tail -n 25 backend.log
  exit 1
fi
