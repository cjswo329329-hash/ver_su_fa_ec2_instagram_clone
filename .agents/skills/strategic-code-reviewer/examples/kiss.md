# KISS (Keep It Simple, Stupid) 원칙 예시

## ❌ Bad: 4단계 중첩 조건문으로 인한 복잡도 증가
- **문제**: 불필요한 깊은 들여쓰기와 중첩 if문
- **영향**: 코드 실행 경로 파악이 어렵고 인지 부하 증가

```typescript
function calculateScore(baseScore: number, level: number, hasCombo: boolean, itemCount: number): number {
  if (baseScore > 0) {
    if (level > 1) {
      if (hasCombo) {
        if (itemCount > 0) {
          return baseScore + (level * 10) + 50 + (itemCount * 5);
        } else {
          return baseScore + (level * 10) + 50;
        }
      } else {
        return baseScore + (level * 10);
      }
    }
  }
  return 0;
}
```

## ✅ Good: Early Return (Guard Clause) 패턴 적용
- **개선**: 유효하지 않은 조건을 먼저 반환(Guard Clause)하여 코드 깊이를 1단계로 유지
- **효과**: 읽기 쉽고 각 보너스 조건의 계산식이 명확하게 분리됨

```typescript
function calculateScore(baseScore: number, level: number, hasCombo: boolean, itemCount: number): number {
  if (baseScore <= 0 || level <= 1) return 0;

  let score = baseScore + (level * 10);
  if (hasCombo) score += 50;
  if (itemCount > 0) score += itemCount * 5;

  return score;
}
```
