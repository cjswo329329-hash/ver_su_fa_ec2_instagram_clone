# 보안 점검 세부 체크리스트 (Security Audit Checklist)

본 문서는 `security-code-review` 스킬 수행 시 정밀 분석을 위해 참조하는 취약점 패턴 가이드입니다.

---

## 1. 인젝션 (Injection) & 입력값 검증

### SQL / NoSQL Injection (CWE-89, CWE-943)
- [ ] SQL 쿼리 작성 시 문자열 결합(`+`, `f"..."`, template literals)을 사용하는가?
  - **Bad**: `query = f"SELECT * FROM users WHERE id = '{user_id}'"`
  - **Good**: `query = "SELECT * FROM users WHERE id = %s", (user_id,)`
- [ ] ORM을 사용하더라도 `raw()`, `extra()`, `where()` 메서드에 비신뢰 입력값을 직접 전달하는가?
- [ ] NoSQL(MongoDB 등) 쿼리 객체 주입 가능성(`$ne`, `$gt`를 통한 인증 우회)이 존재하는가?

### Command Injection (CWE-78)
- [ ] `exec()`, `spawn(..., { shell: true })`, `os.system()`, `subprocess.Popen(..., shell=True)` 등에 사용자 입력값이 포함되는가?
- [ ] 파일 경로 조작(Path Traversal, CWE-22): `path.join(__dirname, userInput)` 사용 시 `../` 상위 디렉터리 접근 필터링(`path.resolve` 및 경로 검증) 여부.

---

## 2. 인증 및 세션 관리 (Broken Authentication)

### 패스워드 및 자격증명
- [ ] 패스워드가 평문 또는 MD5/SHA1 등 취약한 단방향 해시로 저장되는가? (Argon2id, bcrypt, PBKDF2 권장)
- [ ] 로그인 실패 시 계정 존재 여부를 유추할 수 있는 에러 메시지(예: "존재하지 않는 아이디입니다" vs "아이디 또는 비밀번호가 잘못되었습니다")가 출력되는가?

### JWT 및 토큰 보안
- [ ] `alg: none` 공격 방지 및 서명 알고리즘(RS256, HS256) 명시적 강제 여부.
- [ ] 토큰 만료 시간(`exp`)이 설정되어 있고 적절히 짧은가?
- [ ] 민감한 개인정보나 비밀번호가 JWT Payload에 평문으로 포함되어 있지 않은가?

---

## 3. 권한 부여 및 접근 제어 (Broken Access Control)

### IDOR (Insecure Direct Object Reference, CWE-639)
- [ ] 자원 조회/수정/삭제 요청 시 단순히 URL 파라미터(`id`)만 조회하고 요청자의 소유권/소속 테넌트(`tenant_id`, `user_id`)를 대조하는 조건이 누락되었는가?
  - **Bad**: `SELECT * FROM invoices WHERE id = :id`
  - **Good**: `SELECT * FROM invoices WHERE id = :id AND user_id = :current_user_id`

### 권한 검사 우회
- [ ] 관리자 전용 엔드포인트(`admin/*`)에 역할 기반 접근 제어(RBAC/ABAC) 미들웨어가 누락되었는가?
- [ ] 클라이언트 사이드(UI 숨김 처리)에만 의존하고 백엔드 API에서 권한 검사를 건너뛰는가?

---

## 4. 시크릿 및 데이터 보호 (Sensitive Data Exposure)

### 시크릿 누출 (CWE-798)
- [ ] 코드베이스, 주석, Git 커밋에 하드코딩된 API Key, Private Key, DB 연결 문자열이 존재하는가?
- [ ] `.env`나 민감 구성 파일이 `.gitignore`에 등록되어 있는가?

### 로깅 및 모니터링 (CWE-532)
- [ ] 로그 파일이나 콘솔 출력 시 비밀번호, 주민번호, 신용카드 번호, API 토큰이 마스킹 없이 기록되는가?

---

## 5. 웹 프론트엔드 보안

### XSS (Cross-Site Scripting, CWE-79)
- [ ] React의 `dangerouslySetInnerHTML`, Vue의 `v-html`, 바닐라 JS의 `innerHTML`에 사용자 입력값이 sanitize 없이 바인딩되는가?
- [ ] `javascript:` 의사 프로토콜을 이용한 URL 링크 삽입 취약점 여부.

### CSRF (Cross-Site Request Forgery, CWE-352)
- [ ] 상태를 변경하는 요청(POST/PUT/DELETE)에 CSRF 토큰 또는 `SameSite=Strict/Lax` 쿠키 정책이 적용되어 있는가?
