const UNKNOWN_ERROR_MESSAGE = '알 수 없는 오류가 발생했습니다. 확장 프로그램을 다시 시도해 주세요.';

export function toKoreanErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return UNKNOWN_ERROR_MESSAGE;
}
