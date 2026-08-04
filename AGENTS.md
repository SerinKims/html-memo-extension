# AGENTS.md

이 저장소는 Chrome Manifest V3 기반 웹 메모 확장 프로그램을 위한 문서 우선 프로젝트입니다. 현재 단계에서는 코드를 구현하지 않고, 이후 구현자가 문서만 읽고 구조와 제약을 이해할 수 있도록 개발 문서를 유지합니다.

## 프로젝트 원칙

- 서버, 공유 웹사이트, 클라우드 저장소를 전제로 설계하지 않습니다.
- 메모 작성, 스크린샷 생성, HTML 내보내기는 모두 브라우저 로컬 환경에서 수행합니다.
- 기본 내보내기 형식은 단일 `.html` 파일입니다.
- 내보낸 HTML은 외부 CDN, 외부 JavaScript, 외부 CSS 없이 `file://`에서 동작해야 합니다.
- 웹페이지 전체 스크린샷은 Base64 이미지로 HTML 내부에 포함합니다.
- 메모 데이터는 JSON으로 HTML 내부에 포함합니다.
- 영구 저장은 `chrome.storage.local`을 기본으로 사용합니다.
- `chrome.storage.local`에는 장기 보존이 필요한 작은 데이터만 저장하고, 스크린샷 Base64와 생성된 HTML은 저장하지 않습니다.

## 기술 스택

- WXT
- React
- TypeScript
- Tailwind CSS
- Chrome Manifest V3
- pnpm
- `chrome.storage.local`

## 문서 지도

- [README.md](README.md): 프로젝트 개요, 문서 목록, 빠른 시작
- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md): 목표, 비목표, 사용자 흐름, 기능 요구사항
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): 확장 프로그램 구조, 컴포넌트 역할, 데이터 흐름
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md): 메모, 페이지, 캡처, 내보내기 데이터 구조
- [docs/SECURITY.md](docs/SECURITY.md): 민감정보 제거, 권한, 로컬 보안 정책
- [docs/EXPORT_FORMAT.md](docs/EXPORT_FORMAT.md): 단일 HTML 파일 구조와 동작 방식
- [docs/INSTALLATION.md](docs/INSTALLATION.md): 개발 설치, ZIP 배포, 업데이트 절차
- [docs/TEST_PLAN.md](docs/TEST_PLAN.md): 테스트 전략과 체크리스트

## 구현 시 주의사항

- 코드는 문서에 정의된 데이터 모델과 용어를 우선 따릅니다.
- Content Script, Background Service Worker, Popup의 책임을 섞지 않습니다.
- MV3 서비스 워커에는 DOM과 Canvas가 없으므로 이미지 합성은 Offscreen Document 또는 확장 페이지 컨텍스트에서 수행하도록 설계합니다.
- 외부 네트워크 요청, 원격 분석, 외부 스크립트 로딩을 추가하지 않습니다.
- 내보내기 HTML은 확장 프로그램 API 없이 동작해야 하므로 모든 렌더링 로직을 인라인으로 포함하거나 정적 HTML/CSS만 사용합니다.
- 민감정보 제거 정책을 우회하는 옵션을 만들 경우 기본값은 항상 제거 또는 확인이어야 합니다.
- 저장소 사용량은 `chrome.storage.local.getBytesInUse(null)`로 확인하고, 8MB부터 경고, 9MB부터 정리 권장, 9.5MB부터 임시 데이터와 내보내기 이력을 우선 정리합니다.
- 사용자가 작성한 메모 본문은 백업 또는 명시적 확인 없이 자동 삭제하지 않습니다.

## 개발 순서

1. WXT 프로젝트 스캐폴딩
2. Manifest V3 권한과 엔트리포인트 정의
3. 데이터 모델과 저장소 어댑터 구현
4. Content Script 메모 오버레이 구현
5. Popup 메모 목록과 내보내기 UI 구현
6. Background 메시지 라우팅 구현
7. 전체 페이지 스크린샷 캡처와 이미지 합성 구현
8. 단일 HTML 생성기 구현
9. 민감정보 제거 옵션 구현
10. 저장소 사용량 모니터링과 정리 정책 구현
11. 테스트와 ZIP 패키징 자동화
