# 🚀 인스타그램 클론 배포 가이드 (Vercel + Supabase + AWS EC2 FastAPI)

이 가이드는 터미널에서 AI 할당량을 전혀 낭비하지 않고, **단 몇 줄의 명령어로 가장 안정적이고 빠르게 전체 서비스를 런칭**할 수 있도록 작성되었습니다.

---

## 🏗️ 3단 아키텍처 개요

* **프론트엔드 (화면)**: **Vercel** (GitHub 연동, 1클릭 무료 자동 배포)
* **백엔드 (API & 추천)**: **AWS EC2 (FastAPI)** (로그인, 피드, 릴스, 스토리, 추후 추천 알고리즘)
* **데이터베이스 & 스토리지 (데이터)**: **Supabase** (무료 PostgreSQL 클라우드 DB)

---

## 1단계: Supabase 데이터베이스 연결 (1분)

사용자님의 Supabase 프로젝트 정보가 이미 설정 파일에 반영되어 있습니다:
* **Project URL**: `https://npnclxvzpeedvyogpmqw.supabase.co`
* **Publishable Key**: `sb_publishable_XhB0631PgMX09QyjS2axJQ_MRgp8e0j`

### 데이터베이스 비밀번호 적용 방법:
1. Supabase 가입 시 설정하셨던 **데이터베이스 비밀번호**를 준비합니다.
   * 혹시 잊으셨다면 [Supabase 대시보드](https://supabase.com/dashboard/project/npnclxvzpeedvyogpmqw/settings/database) > **Database Password** > **Reset Password**에서 언제든 재설정할 수 있습니다.
2. [backend/.env](file:///d:/바이브코딩/Instagram_Vercel_Supabase_FastAPI/backend/.env) 파일의 `DATABASE_URL` 주석을 해제하고 비밀번호를 입력합니다:
   ```env
   DATABASE_URL="postgresql://postgres:내비밀번호@db.npnclxvzpeedvyogpmqw.supabase.co:5432/postgres"
   ```
   *(비밀번호에 특수문자 `@`, `#` 등이 있다면 URL 인코딩 필요. 예: `@` -> `%40')*

---

## 2단계: 프론트엔드 Vercel 배포 (2분)

### Nginx 설치 없이 클릭 몇 번으로 끝납니다!
1. 현재 프로젝트를 **GitHub 리포지토리**에 커밋 & 푸시합니다:
   ```bash
   git add .
   git commit -m "feat: migrate to Vercel + Supabase + EC2 architecture"
   git push origin main
   ```
2. [Vercel 공식 사이트](https://vercel.com)에 로그인 후 **[Add New...]** > **[Project]** 클릭
3. 방금 푸시한 깃허브 저장소를 선택하고 **[Import]** 클릭
4. **Environment Variables (환경 변수)**에 다음 항목 1개만 입력:
   * Key: `VITE_API_BASE_URL`
   * Value: `http://<내-EC2-공인IP>:8000/api` (EC2 퍼블릭 IPv4 주소)
5. **[Deploy]** 버튼 클릭! (약 1분 뒤 전세계 어디서든 열리는 Vercel 도메인 완성)

---

## 3단계: AWS EC2에서 FastAPI 백엔드 띄우기 (3분)

> [!TIP]
> 이제 EC2에서 Node.js, React 빌드, Nginx 설정이 **전혀 필요 없습니다!**
> 터미너스(Termius)로 EC2에 접속하여 아래 명령어 4줄만 복사/붙여넣기 하시면 끝납니다.

### EC2 터미널 실행 명령어:
```bash
# 1. 패키지 목록 업데이트 및 파이썬 패키지 관리자 설치
sudo apt update && sudo apt install -y python3-pip python3-venv git

# 2. 프로젝트 다운로드 (깃허브 주소 입력)
git clone <내-깃허브-저장소-주소>.git
cd <저장소-폴더>/backend

# 3. 파이썬 가상환경 생성 및 의존성 초고속 설치
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. 백엔드 상시 실행 (백그라운드 nohup 또는 systemd)
# 테스트 실행:
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 또는 백그라운드 24시간 무중단 실행:
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
```

### ⚠️ AWS EC2 보안 그룹(Security Group) 인바운드 규칙 점검:
* **포트 8000 (사용자 지정 TCP)**: `0.0.0.0/0` 허용 (Vercel 및 브라우저에서 FastAPI 접근용)
* **포트 22 (SSH)**: 터미너스 접속용

---

## 4단계: 향후 추천 알고리즘 확장 방법

추천 알고리즘 개발 시 별도 서버를 구축할 필요 없이, EC2의 `backend` 폴더에서 바로 작업하실 수 있습니다:
1. `backend/requirements.txt`에 추천/머신러닝 라이브러리(`scikit-learn`, `numpy` 등) 추가
2. `backend/app/routers/reels.py` 또는 신규 라우터에 `@router.get("/recommendations")` 작성
3. Supabase DB에서 시청/좋아요 데이터를 읽어와서 파이썬으로 가공 후 반환
