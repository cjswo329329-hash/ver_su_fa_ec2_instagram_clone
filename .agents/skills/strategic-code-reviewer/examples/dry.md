# DRY (Don't Repeat Yourself) 원칙 예시

## ❌ Bad: 동일한 로직의 중복 반복
- **문제**: fetch 호출, 에러 핸들링, JSON 파싱이 함수마다 중복됨
- **영향**: 엔드포인트 규칙이나 에러 처리 방식 변경 시 모든 함수를 일일이 수정해야 함

```typescript
async function getUser(id: string) {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new Error(`에러 발생: ${response.status}`);
  return await response.json();
}

async function getPost(id: string) {
  const response = await fetch(`/api/posts/${id}`);
  if (!response.ok) throw new Error(`에러 발생: ${response.status}`);
  return await response.json();
}
```

## ✅ Good: 공통 유틸 함수 추출
- **개선**: 제네릭 `apiCall` 유틸리티 함수로 공통 로직 일원화
- **효과**: 네트워크 헤더, 인증 토큰, 에러 처리 로직을 한 곳에서 중앙 집중 관리 가능

```typescript
async function apiCall<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`에러 발생: ${response.status}`);
  return await response.json();
}

async function getUser(id: string) {
  return apiCall<User>(`/api/users/${id}`);
}

async function getPost(id: string) {
  return apiCall<Post>(`/api/posts/${id}`);
}
```
