---
name: security-code-review
description: >-
  Performs comprehensive security audits, vulnerability assessments, and OWASP Top 10 reviews on source code, pull requests, or configuration files.
  Use this skill whenever the user asks for a security review, vulnerability check, code safety audit, secret leak detection,
  injection/XSS check, auth/authz bypass analysis, or compliance check.
  Do not use for general code styling, formatting, or general unit testing.
---

# 보안 코드 리뷰 (Security Code Review) 스킬

이 스킬은 소스 코드와 구성 파일의 보안 취약점을 심층 분석하고, OWASP Top 10 및 CWE 표준에 기반한 진단과 구체적인 보안 패치(Diff)를 제공하는 오케스트레이션 가이드입니다.

---

## 1. 워크플로우 5단계

### 1단계: 분석 대상 및 컨텍스트 파악
1. 사용자가 지정한 대상 확인:
   - 특정 파일/디렉토리 검사
   - 최근 Git 커밋/PR 변경 사항 검사 (`git diff`, `git status`)
   - 프로젝트 전체 점검
2. 프로젝트의 기술 스택(Node.js, Python, Go, Java 등), 데이터베이스, 인증 체계 파악.

### 2단계: 민감 정보 및 시크릿 유출 진단
1. 하드코딩된 API Key, DB 비밀번호, 개인키, JWT 토큰 등을 탐색합니다.
2. 헬퍼 스크립트를 우선 실행하여 시크릿 패턴을 고속 탐지합니다:
   ```bash
   python .agents/skills/security-code-review/scripts/scan_secrets.py <검사경로>
   ```
3. 탐지된 결과와 `.env`, `config`, 코드 내 하드코딩 여부를 교차 검증합니다.

### 3단계: OWASP Top 10 및 비즈니스 로직 취약점 전수 점검
[references/checklist.md](./references/checklist.md)의 세부 체크리스트를 기준으로 다음 핵심 영역을 순차 점검합니다:

1. **인젝션 (Injection)**:
   - SQL / NoSQL / Command Injection: 파라미터화 쿼리(Prepared Statement) 미사용 및 문자열 조합(String Concatenation) 여부.
2. **인증 및 인가 결함 (Broken Authentication & Broken Access Control)**:
   - IDOR(Insecure Direct Object Reference): 사용자 세션과 자원 소유권 일치 검증 누락.
   - 권한 검사 우회: 라우트/API 엔드포인트의 인증 미들웨어 누락 여부.
   - 취약한 비밀번호 해싱 및 세션/토큰 수명 관리.
3. **데이터 유출 및 암호화 실패 (Cryptographic Failures)**:
   - 민감 개인정보(PII) 로그 출력, 평문 전송, 취약한 암호화 알고리즘(MD5, SHA1 등) 사용.
4. **CORS 및 보안 헤더 설정 오류 (Security Misconfiguration)**:
   - `Access-Control-Allow-Origin: *`와 `credentials: true` 혼용.
   - 과도한 디버그 모드 활성화, 안전하지 않은 기본값.
5. **SSRF 및 신뢰할 수 없는 역직렬화 (SSRF & Insecure Deserialization)**:
   - 사용자 입력 URL로의 내부 네트워크 요청 허용.

### 4단계: 심각도 분류 및 해결 방안(Remediation) 도출
발견된 취약점을 CVSS 3.1 기준을 차용하여 4단계로 분류합니다:
* **Critical (치명적)**: 즉각적인 원격 코드 실행(RCE), 인증 우회, 관리자 권한 탈취 가능.
* **High (높음)**: 중요 데이터 노출(SQLi), 계정 탈취, IDOR 데이터 탈취 가능.
* **Medium (보통)**: XSS, CSRF, 취약한 접근 제어, DoS 가능성.
* **Low (낮음)**: 정보 노출(버전 노출), 안전하지 않은 헤더 설정, 보안 베스트 프랙티스 미준수.

각 취약점마다 **즉시 적용 가능한 Before / After 수정 코드(Diff)**를 작성합니다.

### 5단계: 최종 감사 보고서 작성
[references/report-template.md](./references/report-template.md)의 양식에 맞춰 구조화된 최종 보고서를 생성하고 사용자에게 보고합니다.

---

## 2. 자가 검증 (Self-Verification Checklist)

보고서를 작성하기 전에 아래 사항을 반드시 검토합니다:
- [ ] 오탐(False Positive) 여부: 해당 프레임워크나 ORM이 내부적으로 자동 이스케이프/파라미터화를 처리하는지 확인했는가?
- [ ] 제안한 해결 코드가 기존 비즈니스 로직과 호환되는가?
- [ ] 하드코딩된 키의 경우 환경 변수(`process.env`, `os.environ`) 전환 방안을 제시했는가?
