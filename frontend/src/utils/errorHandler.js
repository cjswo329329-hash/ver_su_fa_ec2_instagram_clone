/**
 * API 에러 응답 파싱 및 정규화 공통 유틸리티 (DRY 원칙 적용)
 */

/**
 * Axios 또는 일반 Error 객체로부터 사용자에게 표시할 메시지를 추출합니다.
 * FastAPI의 Pydantic Validation Error([ { msg, loc, ... } ]) 및 일반 detail 문자열을 모두 지원합니다.
 * 
 * @param {any} error
 * @param {string} defaultMessage
 * @returns {string}
 */
export function extractErrorMessage(error, defaultMessage = '요청 처리 중 오류가 발생했습니다.') {
  if (!error) return defaultMessage;

  // 1. Axios response data 검사
  const resData = error.response?.data;
  if (resData) {
    const detail = resData.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim();
    }
    // FastAPI Pydantic 유효성 검사 에러 배열 처리
    if (Array.isArray(detail) && detail.length > 0) {
      const firstErr = detail[0];
      if (typeof firstErr === 'string') return firstErr;
      if (firstErr?.msg) return firstErr.msg;
    }

    if (typeof resData.message === 'string' && resData.message.trim()) {
      return resData.message.trim();
    }
  }

  // 2. 표준 Error 객체의 message 속성 검사
  if (typeof error.message === 'string' && error.message.trim()) {
    if (error.message.includes('Network Error')) {
      return '서버와 연결할 수 없습니다. 네트워크 상태를 확인해주세요.';
    }
    if (error.message.includes('timeout')) {
      return '서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
    }
    return error.message;
  }

  return defaultMessage;
}
