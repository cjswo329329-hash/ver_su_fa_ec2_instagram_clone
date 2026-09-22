# 보안 감사 보고서 양식 (Security Audit Report)

## 1. 개요 (Executive Summary)

- **점검 일시**: YYYY-MM-DD
- **점검 대상**: [디렉토리 또는 파일 목록 / PR 브랜치]
- **주요 프레임워크/스택**: [예: Node.js Express / PostgreSQL]
- **종합 보안 등급**: [안전 / 주의 / 위험 / 심각]

### 취약점 현황 요약
| 심각도 (Severity) | 건수 | 즉시 조치 필요 여부 |
| :--- | :--- | :--- |
| **Critical** | 0건 | 즉시 수정 배포 필수 |
| **High** | 0건 | 배포 전 조치 요망 |
| **Medium** | 0건 | 단기 스프린트 내 수정 |
| **Low / Info** | 0건 | 권장 개선 사항 |

---

## 2. 세부 발견 사항 (Detailed Findings)

### [SEC-01] [취약점 제목 (예: SQL Injection in User Search API)]
* **심각도**: `Critical` / `High` / `Medium` / `Low`
* **취약점 분류**: CWE-89 (SQL Injection) / OWASP A03:2021-Injection
* **영향을 받는 파일**: `[file.ts](file:///path/to/file.ts#L45-L52)`

#### 취약점 설명 및 잠재적 영향
[취약점이 발생하는 원인과 공격자가 이를 악용했을 때 미칠 영향(데이터 유출, 권한 탈취 등)을 구체적으로 서술]

#### 취약한 코드 (Current)
```typescript
// 취약한 현재 코드 스니펫
```

#### 권장 수정 코드 (Remediation)
```diff
- const query = `SELECT * FROM users WHERE name = '${req.body.name}'`;
+ const query = 'SELECT * FROM users WHERE name = $1';
+ const result = await db.query(query, [req.body.name]);
```

---

## 3. 총평 및 추가 권장사항
- [시크릿 관리 도구 도입 권장 (예: Doppler, Vault, AWS Secrets Manager)]
- [CI/CD 보안 파이프라인(SAST/DAST) 연동 제안]
