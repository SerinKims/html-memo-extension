# 데이터 모델

## 설계 원칙

- 저장소는 `chrome.storage.local`을 사용한다.
- 메모는 페이지 단위로 그룹화한다.
- 좌표는 문서 기준 픽셀 좌표와 스크린샷 기준 비율 좌표를 함께 저장한다.
- 내보낸 HTML 안에는 필요한 검토 데이터 전체를 JSON으로 포함한다.
- 원본 웹페이지 DOM 전체는 저장하지 않는다.

## 저장소 키

```text
memoHtml.pages.<pageId>
memoHtml.notes.<pageId>
memoHtml.settings
memoHtml.exports.<exportId>
memoHtml.temp.<jobId>
```

`pageId`는 URL 정규화 결과와 origin, pathname, query 정책을 기반으로 생성한다. HTTP/HTTPS는 추적 query와 fragment를 제거하고, `file:`은 모든 query와 fragment를 제거한 절대 파일 URL을 사용한다. 로컬 파일이 이동하거나 이름이 바뀌면 새 `pageId`가 생성된다.

## PageRecord

```ts
interface PageRecord {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  origin: string;
  createdAt: string;
  updatedAt: string;
  lastCapturedAt?: string;
}
```

## MemoRecord

```ts
type MemoType = "point" | "text" | "area";

interface MemoRecord {
  id: string;
  pageId: string;
  type: MemoType;
  body: string;
  color?: string;
  status: "open" | "resolved";
  anchor: PointAnchor | TextAnchor | AreaAnchor;
  createdAt: string;
  updatedAt: string;
}
```

## 위치 메모 앵커

```ts
interface PointAnchor {
  kind: "point";
  pageX: number;
  pageY: number;
  ratioX: number;
  ratioY: number;
  viewportWidth: number;
  viewportHeight: number;
  documentWidth: number;
  documentHeight: number;
}
```

- `pageX`, `pageY`: 문서 기준 좌표
- `ratioX`, `ratioY`: 전체 스크린샷 기준 0부터 1 사이의 비율 좌표
- 문서 크기가 바뀌는 경우 비율 좌표를 우선 사용해 표시한다.

## 텍스트 메모 앵커

```ts
interface TextAnchor {
  kind: "text";
  selectedText: string;
  prefixText?: string;
  suffixText?: string;
  selector?: string;
  rangeHint?: {
    startOffset?: number;
    endOffset?: number;
  };
  boundingRects: RectAnchor[];
}
```

- `selectedText`: 사용자가 선택한 텍스트
- `prefixText`, `suffixText`: 선택 영역 주변 문맥
- `selector`: 가능한 경우 선택 영역의 공통 부모를 가리키는 선택자
- `boundingRects`: 선택 텍스트가 화면에서 차지한 사각형 목록

내보낸 HTML에서는 원본 DOM을 다시 탐색하지 않는다. `boundingRects`를 사용해 스크린샷 위에 하이라이트를 표시한다.

## 영역 메모 앵커

```ts
interface AreaAnchor {
  kind: "area";
  rect: RectAnchor;
}
```

## RectAnchor

```ts
interface RectAnchor {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
  ratioX: number;
  ratioY: number;
  ratioWidth: number;
  ratioHeight: number;
}
```

## CaptureRecord

```ts
interface CaptureRecord {
  pageId: string;
  capturedAt: string;
  pageUrl: string;
  pageTitle: string;
  viewportWidth: number;
  viewportHeight: number;
  documentWidth: number;
  documentHeight: number;
  devicePixelRatio: number;
  imageMimeType: "image/png" | "image/jpeg";
  imageDataUrl: string;
}
```

`imageDataUrl`은 내보내기 HTML에 포함할 Base64 이미지이다. 장기 저장이 필요하지 않으면 `chrome.storage.local`에 보관하지 않고 내보내기 작업 중 메모리에서만 유지한다.

## ExportDocument

```ts
interface ExportDocumentV2 {
  schemaVersion: 2;
  documentId: string;
  revision: number;
  exportedAt: string;
  generator: {
    name: "web-memo-html-extension";
    version: string;
  };
  source:
    | { kind: "web"; displayName: string; url: string }
    | { kind: "local-file"; displayName: string; fileName: string };
  page: {
    title: string;
    capturedAt: string;
    documentWidth: number;
    documentHeight: number;
  };
  screenshot: {
    mimeType: "image/png" | "image/jpeg";
    dataUrl: string;
    width: number;
    height: number;
  };
  notes: ExportNote[];
  redaction: RedactionSummary;
}

type ExportNote =
  | (ExportNoteBase & { type: "point"; position: PointPosition })
  | (ExportNoteBase & { type: "area"; position: AreaPosition })
  | (ExportNoteBase & { type: "text"; anchor: TextAnchor })
  | (ExportNoteBase & { type: "comment" });

interface ExportNoteBase {
  id: string;
  content: string;
  author: string;
  color: AnnotationColor;
  status: "open" | "resolved";
  origin: "capture" | "review";
  createdAt: string;
  updatedAt: string;
}
```

`documentId`는 같은 검토 문서에서 파생된 revision을 식별하고 `revision`은 수정본을 저장할 때마다 증가한다. 로컬 파일 source에는 전체 경로를 저장하지 않는다. v1 문서는 읽을 때 v2 메모리 모델로 변환하고 다음 수정본부터 v2로 저장한다.

## RedactionSummary

```ts
interface RedactionSummary {
  applied: boolean;
  removedFields: string[];
  maskedPatterns: string[];
  userConfirmed: boolean;
}
```

## StorageUsage

```ts
interface StorageUsage {
  measuredAt: string;
  bytesInUse: number;
  quotaBytes: 10_485_760;
  level: "normal" | "warning" | "cleanupRecommended" | "critical";
}
```

사용량은 `chrome.storage.local.getBytesInUse(null)`로 측정한다. UI와 Background 작업은 같은 기준을 사용한다.

| 수준 | 기준 | 동작 |
| --- | --- | --- |
| `normal` | 8MB 미만 | 별도 안내 없음 |
| `warning` | 8MB 이상 | Popup에 저장소 경고 표시 |
| `cleanupRecommended` | 9MB 이상 | 오래된 이력 정리 권장 |
| `critical` | 9.5MB 이상 | 임시 데이터와 내보내기 이력 우선 정리 |

## 정리 우선순위

자동 정리는 사용자가 작성한 메모를 보호하는 방향으로 수행한다.

1. `memoHtml.temp.<jobId>` 임시 작업 데이터
2. 실패했거나 중단된 내보내기 이력
3. 최근 30개 또는 30일을 초과한 내보내기 이력
4. 메모가 0개이고 30일 이상 접근하지 않은 페이지 메타데이터
5. 사용자 확인을 받은 오래된 메모 데이터

## 데이터 보존 정책

- 기본적으로 메모는 사용자가 삭제할 때까지 `chrome.storage.local`에 보존한다.
- 캡처 이미지는 파일 내보내기 과정에서 생성하고, 기본적으로 저장소에 장기 보관하지 않는다.
- 내보내기 기록은 파일명, URL, 내보낸 시각, 메모 수 같은 최소 메타데이터만 저장할 수 있다.
- 내보내기 기록은 기본적으로 최근 30개 또는 최근 30일 범위만 보존한다.
- 임시 작업 데이터는 내보내기 성공, 실패, 취소 시 즉시 삭제한다.
- 저장소 사용량이 9.5MB 이상이면 임시 데이터와 내보내기 이력을 우선 정리한다.
- 사용자 메모 본문은 백업 또는 명시적 확인 없이 자동 삭제하지 않는다.
- 사용자가 전체 데이터 삭제를 실행하면 페이지 기록, 메모, 내보내기 기록을 삭제한다.
