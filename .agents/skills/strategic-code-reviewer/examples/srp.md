# SRP (Single Responsibility Principle) 원칙 예시

## ❌ Bad: 하나의 함수가 너무 많은 책임을 담당
- **문제**: 가격 계산 + 화면 출력 + DB 저장 + 이메일 전송이 단일 함수에 혼재
- **영향**: 가격 계산 공식만 수정하려 해도 전체 결제 시스템 파일이 영향받음

```typescript
function handleOrder(order: Order) {
  // 1. 가격 계산
  let price = order.basePrice;
  if (order.size === 'large') price *= 1.5;
  if (order.hasMilk) price += 500;

  // 2. 영수증 출력
  console.log(`=== 영수증: ${order.item} (${price}원) ===`);

  // 3. DB 저장
  database.save({ orderId: order.id, price, timestamp: Date.now() });

  // 4. 이메일 발송
  sendEmail(order.email, `주문 완료 금액: ${price}원`);

  return { order, price };
}
```

## ✅ Good: 관심사 분리 (책임별 함수 및 모듈화)
- **개선**: 계산(`calculatePrice`), 데이터 영속화(`orderRepository.save`), 알림(`notificationService.send`) 분리
- **효과**: 가격 계산식만 단독으로 단위 테스트(Unit Test) 가능, 다른 서비스 재사용 용이

```typescript
// 1. 순수 가격 계산 함수 (테스트하기 매우 쉬움)
function calculatePrice(order: Order): number {
  let price = order.basePrice;
  if (order.size === 'large') price *= 1.5;
  if (order.hasMilk) price += 500;
  return price;
}

// 2. 오케스트레이션 함수 (각 모듈 위임)
async function processOrder(order: Order, services: OrderServices) {
  const price = calculatePrice(order);
  
  await services.repository.saveOrder({ orderId: order.id, price });
  await services.notifier.sendReceipt(order.email, price);

  return { order, price };
}
```
