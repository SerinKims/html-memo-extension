# 웹 메모 HTML 검토 확장 프로그램

연구원이 웹사이트를 보면서 텍스트, 위치, 영역에 메모를 남기고, 현재 웹페이지 전체 화면과 메모를 하나의 독립 HTML 검토 파일로 저장하는 Chrome 확장 프로그램입니다.

내보낸 HTML 파일은 확장 프로그램 없이 열 수 있어야 하며, 이메일, 메신저, 사내 파일 시스템으로 전달할 수 있습니다. 서버, 공유 웹사이트, 클라우드 저장소는 사용하지 않습니다.

## 현재 상태

Prompt 03의 웹페이지 메모 오버레이 기반까지 완료되었습니다. Popup에서 현재 탭의 메모 모드를 시작할 수 있고, Content Script가 Shadow DOM 안에 도구 모음과 현재 페이지 메모 수를 표시합니다. ESC 종료, 중복 주입 방지, Background 메시지 처리, SPA URL 변경 감지를 포함합니다. 실제 메모 생성과 목록·HTML 내보내기 기능은 이후 단계에서 구현합니다.

## 개발 시작

```bash
pnpm install
pnpm dev
```

Chrome에서 `chrome://extensions`를 열고 개발자 모드를 활성화한 뒤 `.output/chrome-mv3-dev` 디렉터리를 압축해제된 확장 프로그램으로 로드합니다.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

위 명령으로 타입 검사, 린트, 기본 테스트, Chrome MV3 프로덕션 빌드를 각각 실행할 수 있습니다.

## 핵심 기능

- 웹페이지 위에 메모 작성
- 위치 메모, 텍스트 메모, 영역 메모 지원
- `chrome.storage.local` 기반 로컬 저장
- 전체 페이지 스크린샷 생성
- Base64 스크린샷과 JSON 메모 데이터를 포함한 단일 HTML 파일 내보내기
- 외부 CDN, 외부 JavaScript, 외부 CSS 없이 `file://`에서 검토 가능
- 내보내기 전 민감정보 제거 또는 마스킹
- 저장소 사용량 확인과 오래된 임시/이력 데이터 정리

## 기술 스택

- WXT
- React
- TypeScript
- Tailwind CSS
- Chrome Manifest V3
- pnpm
- `chrome.storage.local`

## 연구원 사용 흐름

1. 연구원이 Chrome에서 조사 대상 웹페이지를 엽니다.
2. 확장 프로그램을 실행하고 메모 모드를 선택합니다.
3. 페이지의 특정 위치, 텍스트 선택 범위, 또는 사각형 영역에 메모를 작성합니다.
4. Popup에서 저장된 메모 목록을 확인하고 필요하면 수정하거나 삭제합니다.
5. 내보내기를 실행하면 확장 프로그램이 전체 페이지 스크린샷을 생성합니다.
6. 확장 프로그램은 스크린샷과 메모 JSON을 포함한 단일 HTML 파일을 생성합니다.
7. 연구원은 생성된 HTML 파일을 이메일, 메신저, 사내 파일 시스템으로 전달합니다.
8. 수신자는 확장 프로그램 없이 HTML 파일을 열어 스크린샷과 메모를 확인합니다.

## 문서

- [요구사항](docs/REQUIREMENTS.md)
- [아키텍처](docs/ARCHITECTURE.md)
- [데이터 모델](docs/DATA_MODEL.md)
- [보안 정책](docs/SECURITY.md)
- [내보내기 형식](docs/EXPORT_FORMAT.md)
- [설치 및 배포](docs/INSTALLATION.md)
- [테스트 계획](docs/TEST_PLAN.md)

## 주요 비목표

- 서버 저장소 제공
- 협업 웹사이트 제공
- 실시간 동기화
- 계정, 로그인, 권한 관리 서버
- 외부 CDN 기반 검토 화면
- 확장 프로그램이 없는 상태에서 원본 웹페이지를 재실행하는 기능

## 구현 예정 순서

1. WXT 프로젝트 생성
2. Manifest V3 권한과 엔트리포인트 구성
3. 메모 데이터 모델과 `chrome.storage.local` 저장소 구현
4. Content Script 오버레이와 메모 작성 UI 구현
5. Popup 기반 목록, 편집, 내보내기 UI 구현
6. Background Service Worker 메시지 라우팅 구현
7. 전체 페이지 스크린샷 캡처와 합성 구현
8. 단일 HTML 내보내기 생성기 구현
9. 민감정보 제거 정책 적용
10. 저장소 사용량 모니터링과 정리 정책 구현
11. 테스트와 ZIP 배포 패키징
