
# 원인 분석 및 해결 계획

## 근본 원인: CORS 차단

`apis.data.go.kr` (공공데이터포털) 서버는 브라우저에서 직접 호출하는 cross-origin 요청을 차단합니다. 즉, `Access-Control-Allow-Origin` 헤더가 없어 모든 MFDS API 요청이 브라우저에서 **네트워크 오류로 조용히 실패**합니다. `fetchWithRetry`가 예외를 catch하여 빈 배열 `[]`을 반환하고, 모든 행의 `mfds_not_found = true`, `generic_count = 0`이 됩니다.

```text
브라우저 → apis.data.go.kr   ← CORS 차단 (Access-Control-Allow-Origin 없음)
결과: fetch() 예외 → catch → 빈 배열 반환 → 매칭 0건
```

## 두 번째 원인: queryMFDSByIngredient가 Ingredient_base_ko를 무시함

현재 `calculateResults()`에서 `queryMFDSByIngredient(row.Ingredient_base, ...)` 를 호출합니다. 즉, OpenFDA 보강 단계에서 이미 매핑된 `row.Ingredient_base_ko` (한국어 성분명)을 사용하지 않고, 영문 `Ingredient_base`를 함수 내부에서 다시 번역합니다. 수동 매핑 패널에서 사용자가 입력한 한국어 성분명도 이 경로에서 무시됩니다.

## 해결 방법: Vite 개발서버 프록시

가장 간단하고 안정적인 해결책은 Vite 서버 프록시를 추가하는 것입니다. 브라우저는 같은 origin의 `/mfds-api/` 경로로 요청하고, Vite 서버가 서버사이드에서 `apis.data.go.kr`로 실제 요청을 전달합니다. 서버 간 통신은 CORS의 영향을 받지 않습니다.

```text
브라우저 → /mfds-api/... → Vite Dev Server → apis.data.go.kr  ✓ (서버간 통신)
```

---

## 변경 파일 목록

### 1. `vite.config.ts` — 프록시 추가

`/mfds-api/` 경로를 `https://apis.data.go.kr`로 프록시합니다.

```ts
server: {
  host: "::",
  port: 8080,
  proxy: {
    "/mfds-api": {
      target: "https://apis.data.go.kr",
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/mfds-api/, ""),
    },
  },
},
```

### 2. `src/lib/mfds.ts` — API URL 및 로직 수정

**2a. MFDS_BASE URL 변경**

```ts
// 변경 전
const MFDS_BASE = "https://apis.data.go.kr/1471000";

// 변경 후
const MFDS_BASE = "/mfds-api/1471000";
```

**2b. calculateResults에서 Ingredient_base_ko 우선 사용**

현재 코드:
```ts
const result = await queryMFDSByIngredient(row.Ingredient_base, options.includeRevoked);
```

수정 후 (수동 매핑된 한국어 성분명을 직접 사용):
```ts
const koOverride = row.Ingredient_base_ko || row.mfds_search_term;
const result = await queryMFDSByIngredient(
  row.Ingredient_base,
  options.includeRevoked,
  koOverride || undefined   // 한국어 성분명이 있으면 직접 전달
);
```

**2c. queryMFDSByIngredient에 선택적 Korean override 파라미터 추가**

```ts
export async function queryMFDSByIngredient(
  ingredientBase: string,
  includeRevoked: boolean = false,
  koOverride?: string   // 추가: 외부에서 한국어 성분명 직접 전달 가능
)
```

내부에서:
```ts
// 기존: const primaryKo = getPrimaryKorean(ingredientBase);
// 수정: override가 있으면 그것을 우선 사용
const primaryKo = koOverride || getPrimaryKorean(ingredientBase);
```

**2d. 캐시 키를 한국어 성분명 포함으로 변경**

동일한 영문 성분명이라도 다른 한국어 override가 있을 경우를 구분:
```ts
const cacheKey = `${koOverride ?? ingredientBase}__${includeRevoked}`;
```

### 3. `src/lib/mfds.ts` — 신약구분 판별 로직 강화

현재 `hasOriginal` 판별식:
```ts
p.신약구분 === "Y" || p.신약구분?.includes("신약")
```

MFDS API는 실제로 `신약구분` 필드에 `"신약"`, `"Y"`, 빈 문자열 등 다양한 값을 반환합니다. 이를 좀 더 명확히 처리:
```ts
const isOriginal = (p: MFDSProduct) => {
  const v = (p.신약구분 ?? "").trim();
  return v === "Y" || v === "신약" || v.includes("신약");
};
```

---

## 변경 요약

| 파일 | 변경 내용 |
|---|---|
| `vite.config.ts` | `/mfds-api/` → `apis.data.go.kr` 프록시 추가 |
| `src/lib/mfds.ts` | MFDS_BASE를 프록시 경로로 수정, `koOverride` 파라미터 추가, 캐시 키 수정, 신약구분 판별 강화 |

## 기대 효과

- CORS 오류 해소 → MFDS API 실제 응답 수신
- 수동 매핑 패널에서 입력한 한국어 성분명이 MFDS 검색에 올바르게 반영
- 아스피린(아스피린), 리피토르(아토르바스타틴) 등 브랜드명도 정상 매칭
