# 단일 HTML 내보내기 형식

## 목표

내보내기 결과물은 하나의 `.html` 파일이다. 이 파일은 확장 프로그램, 서버, CDN, 외부 JavaScript, 외부 CSS 없이 열 수 있어야 한다.

## 포함 데이터

HTML 파일은 다음을 포함한다.

- 페이지 제목
- 웹페이지 원본 URL 또는 로컬 파일명
- 캡처 시각
- 내보내기 시각
- 전체 페이지 스크린샷 Base64 이미지
- 메모 JSON
- 민감정보 제거 요약
- 검토 화면 렌더링에 필요한 인라인 CSS
- 메모 필터, 선택, 상세 보기 같은 최소 인라인 JavaScript
- 위치·영역·일반 댓글 편집과 revision 수정본 다운로드 코드

## 파일 구조

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="html-memo-export" content="2">
    <title>검토 파일</title>
    <style>
      /* 인라인 CSS */
    </style>
  </head>
  <body>
    <main id="review-app">
      <section id="metadata"></section>
      <section id="canvas">
        <img id="page-screenshot" alt="Captured web page">
        <div id="note-layer"></div>
      </section>
      <aside id="note-panel"></aside>
    </main>

    <script id="review-data" type="application/json">
      {}
    </script>
    <script>
      /* 인라인 검토 UI JavaScript */
    </script>
  </body>
</html>
```

실제 구현에서는 JSON 안의 `</script>` 문자열을 안전하게 이스케이프해야 한다.

## JSON 스키마

```json
{
  "schemaVersion": 2,
  "documentId": "018f-review-document-id",
  "revision": 1,
  "exportedAt": "2026-07-31T00:00:00.000Z",
  "generator": {
    "name": "web-memo-html-extension",
    "version": "0.1.0"
  },
  "source": {
    "kind": "web",
    "displayName": "Example Page",
    "url": "https://example.com/research"
  },
  "page": {
    "title": "Example Page",
    "capturedAt": "2026-07-31T00:00:00.000Z",
    "documentWidth": 1440,
    "documentHeight": 3200
  },
  "screenshot": {
    "mimeType": "image/png",
    "dataUrl": "data:image/png;base64,...",
    "width": 1440,
    "height": 3200
  },
  "notes": [],
  "redaction": {
    "applied": true,
    "removedFields": ["page.url.query"],
    "maskedPatterns": ["email"],
    "userConfirmed": true
  }
}
```

로컬 HTML의 source는 다음처럼 전체 경로 없이 저장한다.

```json
{
  "kind": "local-file",
  "displayName": "내부 보고서",
  "fileName": "report.html"
}
```

각 메모는 `origin: "capture" | "review"`를 갖는다. v2의 메모 유형은 `point`, `text`, `area`, `comment`이며 새 검토 메모는 원본 DOM이 없으므로 `point`, `area`, `comment`만 생성한다. v1 입력은 메모리에서 v2로 변환하고 다음 수정본부터 v2로 기록한다.

## 스크린샷 표현

- 기본 형식은 PNG이다.
- 이미지가 너무 큰 경우 사용자 확인 후 JPEG 또는 축소 이미지를 사용할 수 있다.
- 이미지 데이터는 `data:image/png;base64,...` 또는 `data:image/jpeg;base64,...` 형태로 포함한다.
- 스크린샷은 HTML 파일 안에 직접 포함하며 외부 이미지 파일을 만들지 않는다.

## 메모 레이어 표현

메모 레이어는 스크린샷 위에 절대 위치 요소로 표시한다.

- 위치 메모: 핀 또는 번호 마커
- 텍스트 메모: 반투명 하이라이트 영역
- 영역 메모: 테두리와 배경 강조

좌표 계산은 `ratioX`, `ratioY`, `ratioWidth`, `ratioHeight`를 우선 사용한다. 이렇게 하면 검토자가 브라우저 창 크기를 바꾸어도 메모 위치가 스크린샷에 맞게 유지된다.

## 검토 UI 동작

HTML 파일은 다음 동작을 지원한다.

- 메모 목록 표시
- 메모 유형별 필터
- 메모 클릭 시 상세 내용 표시
- 목록 항목 클릭 시 해당 위치로 스크롤
- 민감정보 제거 요약 표시
- 위치 메모 생성과 기존 위치 메모 수정·삭제
- 영역 드래그 메모 생성과 기존 영역 메모 수정·삭제
- 좌표 없는 일반 댓글 생성·수정·삭제
- 작성자, 본문, 색상, 해결 상태 편집
- 미저장 변경 표시와 페이지 이탈 경고
- 다음 revision의 단일 HTML 수정본 다운로드

검토 UI는 정적 파일 내부의 인라인 JavaScript만 사용한다. 외부 라이브러리, CDN, 확장 프로그램 API를 사용하지 않는다.

수정사항은 메모리에만 유지한다. `수정본 다운로드`를 누르면 `revision`과 `exportedAt`을 갱신하고 현재 스크린샷과 전체 메모 JSON을 포함한 새 Blob을 다운로드한다. 브라우저 보안 모델상 원본 HTML을 자동으로 덮어쓰지 않는다.

## 파일명 규칙

권장 파일명 형식은 다음과 같다.

```text
web-review_<sanitized-page-title>_<yyyyMMdd-HHmmss>.html
```

검토자가 저장한 수정본은 기존 revision 접미사를 제거한 뒤 다음 형식을 사용한다.

```text
<sanitized-source-name>_rev2.html
<sanitized-source-name>_rev3.html
```

파일명에는 운영체제에서 사용할 수 없는 문자를 제거한다.

## 금지 사항

- 외부 CDN 링크
- 외부 CSS 파일
- 외부 JavaScript 파일
- 외부 이미지 파일
- 원격 분석 코드
- 원본 웹사이트를 iframe으로 다시 불러오는 방식
- 확장 프로그램 API에 의존하는 검토 로직
- 로컬 파일의 절대 경로 포함
- 원본 HTML 자동 덮어쓰기
- 서로 분기된 revision의 자동 병합
