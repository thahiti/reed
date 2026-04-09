# Frontmatter Table: YAML 프론트매터를 테이블 카드로 렌더링

## Overview

마크다운 문서의 YAML frontmatter를 파싱하여 문서 최상단에 key-value 테이블 카드 형태로 렌더링한다.

## 렌더링 스타일

테이블 카드 스타일: 둥근 모서리 박스 안에 key-value 행이 나열. 키는 좌측 회색 배경, 값은 우측. 배열 값은 태그 뱃지(pill)로 표시.

## 파이프라인 변경

기존 remark 파이프라인에 `remark-frontmatter`를 추가하여 YAML frontmatter를 AST 노드로 인식시킨다. 커스텀 rehype 플러그인 `rehypeFrontmatter`에서 YAML 노드를 파싱하고 테이블 HTML 엘리먼트로 변환하여 문서 최상단에 주입한다.

```
remark-parse → remark-frontmatter → remark-gfm → ... → remark-rehype
  → rehypeFrontmatter (YAML → 테이블 HTML) → rehype-katex → ... → rehype-react
```

### rehypeFrontmatter 플러그인

- hast tree에서 `type: 'element'`, `tagName: 'div'`로 변환된 frontmatter 노드를 찾지 않고, remark-frontmatter가 생성한 YAML 노드의 `value`를 파싱
- `yaml` npm 패키지로 YAML 파싱
- 파싱 결과를 `<frontmatter-table>` 커스텀 엘리먼트로 변환하여 hast tree 최상단에 삽입
- 빈 frontmatter 또는 파싱 실패 시 아무것도 삽입하지 않음

### rehype-react 매핑

`<frontmatter-table>` → `FrontmatterTable` React 컴포넌트. 데이터는 `data-frontmatter` 속성에 JSON 문자열로 전달.

## 값 렌더링 규칙

| 타입 | 렌더링 |
|---|---|
| 문자열/숫자/boolean | 값 그대로 표시 |
| 배열 | 각 항목을 태그 뱃지(pill)로 표시 |
| null/undefined | 빈 셀 |
| 중첩 객체 | `JSON.stringify`로 표시 |
| 빈 frontmatter | 테이블 렌더링하지 않음 |

## 다크 모드

기존 CSS 변수를 활용:
- 키 셀 배경: `var(--color-code-bg)`
- 키 텍스트: `var(--color-text-secondary)`
- 테두리: `var(--color-table-border)`
- 뱃지 배경/텍스트: `var(--color-link)` 기반

## 변경 파일

### 신규

| 파일 | 내용 |
|---|---|
| `src/renderer/pipeline/rehypeFrontmatter.ts` | YAML → 테이블 HTML 변환 rehype 플러그인 |
| `src/renderer/components/markdown/FrontmatterTable.tsx` | 테이블 카드 React 컴포넌트 |

### 수정

| 파일 | 변경 |
|---|---|
| `package.json` | `remark-frontmatter`, `yaml` 패키지 추가 |
| `src/renderer/pipeline/createProcessor.ts` | remark-frontmatter 플러그인 추가, rehypeFrontmatter 플러그인 추가, rehype-react에 frontmatter-table 매핑 |
| `src/renderer/styles/markdown.css` | 프론트매터 테이블 CSS 추가 |

### 변경하지 않는 파일

- `App.tsx` — 변경 불필요
- `MarkdownView.tsx` — 변경 불필요
- `MarkdownEditor.tsx` — 편집 모드에서는 원본 YAML 텍스트 그대로 표시
