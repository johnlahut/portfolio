# Infinite Scroll — Implementation Plan

## Overview

The image gallery currently fetches **all** images in a single request (`GET /images` → `get_all_images_with_person_matches` RPC). With thousands of images, this causes slow initial loads, high memory usage, and a large payload over the wire. This plan replaces the all-at-once load with cursor-based paginated fetching and infinite scroll in the masonry component.

The gallery supports **search**, **sort-by-person** (pin tagged images, rank by face match distance), and **face overlays**, so the backend pagination must support these features server-side.

---

## Current Architecture

### Backend

- `GET /images` → `services.get_images()` → `database.get_all_images()` → RPC `get_all_images_with_person_matches`
- The RPC returns denormalized rows (one row per face × person match), paginated internally at 1000-row chunks via `.range()`
- Rows are grouped into `ImageWithFaces` objects in `_build_image_records()`
- No query params — returns everything

### Frontend

- `useImages()` hook → `useQuery({ queryKey: ['images'], queryFn: getImages })`
- `ImageMasonryV2` receives all images, applies client-side filtering (removes images without `source_url`) and client-side sorting (by person tag/distance) in `useMemo`
- Uses `@tanstack/react-virtual` with `useVirtualizer` for DOM virtualization (already efficient for rendering)
- The gallery route (`/chirpv2`) passes `sortBy` (person ID) as a search param

---

## Design

### Pagination Strategy: Keyset (Cursor-Based)

Offset-based pagination (`LIMIT/OFFSET`) is simple but has issues:

- Inserting or deleting images between page fetches causes duplicates or missed items
- `OFFSET N` gets slower as N grows (DB must scan and discard N rows)

**Keyset pagination** uses a cursor (the last item's sort key) to fetch the next page. The cursor is an opaque JSON object that captures all sort-relevant fields of the last item. The frontend never interprets it — it receives the cursor from one response and passes it back verbatim in the next request.

### Default Sort: `created_at DESC, id`

The default sort is newest-first by creation date, with `id` as a tiebreaker for images with identical timestamps (e.g., bulk inserts from scrape jobs). `created_at` is monotonically increasing, so new images always sort before the cursor — they appear at the top on a fresh load rather than being missed.

UUIDs (v4) are random and not suitable as the primary sort key — a newly inserted image could get a UUID that sorts before the cursor, causing it to be skipped during pagination.

### Sort Options

The frontend selects a named sort option via a `sort_by` query param. The backend owns the mapping from sort name → `ORDER BY` clause → cursor shape → `WHERE` comparison direction. The cursor stays opaque to the frontend.

| Sort option                      | `ORDER BY`                                        | Cursor fields                     | Comparison           |
| -------------------------------- | ------------------------------------------------- | --------------------------------- | -------------------- |
| `newest` (default)               | `created_at DESC, id`                             | `{ created_at, id }`              | `<` (descending)     |
| `oldest`                         | `created_at ASC, id`                              | `{ created_at, id }`              | `>` (ascending)      |
| `person` (with `sort_person_id`) | `is_tagged DESC, min_distance ASC NULLS LAST, id` | `{ is_tagged, min_distance, id }` | row-value comparison |

**Changing sort resets the cursor to `null`** — a cursor from `newest` is meaningless for `oldest` since the position in the sequence is different. TanStack Query handles this naturally since sort is part of the `queryKey` — changing it starts a fresh infinite query.

### Page Size

**40 images per page** — large enough to fill the viewport + overscan on wide screens (4-5 columns × ~8 visible rows), small enough to keep payloads fast.

### The `limit + 1` Trick

To determine `has_next_page` without a separate `SELECT count(*)`, the RPC fetches `limit + 1` rows. If it gets back more than `limit` images, there's a next page — the extra row is trimmed and its sort fields become the `next_cursor`. If `<= limit` rows come back, `next_cursor` is `null`.

---

## 1. Update SQL RPC: `get_all_images_with_person_matches`

Add pagination, search, and sort parameters to the existing `get_all_images_with_person_matches` RPC. All new parameters have defaults so existing callers (if any) continue to work.

```sql
CREATE OR REPLACE FUNCTION portfolio.get_all_images_with_person_matches(
    p_threshold FLOAT DEFAULT 0.5,
    p_top_n INT DEFAULT 3,
    p_limit INT DEFAULT 40,
    p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
    p_cursor_id UUID DEFAULT NULL,
    p_sort_person_id UUID DEFAULT NULL,
    p_cursor_is_tagged INT DEFAULT NULL,
    p_cursor_min_distance FLOAT DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
    image_id UUID,
    filename TEXT,
    source_url TEXT,
    width INT,
    height INT,
    created_at TIMESTAMPTZ,
    face_id UUID,
    face_encoding vector(512),
    location_top INT,
    location_right INT,
    location_bottom INT,
    location_left INT,
    assigned_person_id UUID,
    matched_person_id UUID,
    matched_person_name TEXT,
    match_distance FLOAT
)
```

Note: `created_at` is added to the return columns so the backend can build the cursor from the last row.

**SQL logic:**

1. **Base image set** — `SELECT FROM portfolio.image WHERE source_url IS NOT NULL`
2. **Search filter** — `AND (filename ILIKE '%' || p_search || '%' OR source_url ILIKE '%' || p_search || '%')` when `p_search` is not null
3. **Sort order**:
   - **Default (no person):** `ORDER BY i.created_at DESC, i.id` (newest first, stable)
   - **With person:** `ORDER BY is_tagged DESC, min_distance ASC NULLS LAST, i.id` — tagged images first, then ranked by closest face match distance
4. **Cursor:** Row-value comparison using the cursor fields, e.g. `WHERE (i.created_at, i.id) < (p_cursor_created_at, p_cursor_id)` for default sort
5. **Limit:** `LIMIT p_limit + 1` — Python trims the extra row and builds `next_cursor`
6. **Join faces + person matches** using the same lateral join pattern as the existing RPC, but only for the paginated image set

**Simplified approach for person sorting:**

Use a CTE to compute image sort order first, then paginate, then join faces:

```sql
WITH ranked_images AS (
    SELECT
        i.id,
        i.created_at,
        -- is_tagged: 1 if any face on this image is assigned to p_sort_person_id
        CASE WHEN EXISTS (
            SELECT 1 FROM portfolio.detected_face df
            WHERE df.image_id = i.id AND df.person_id = p_sort_person_id
        ) THEN 1 ELSE 0 END AS is_tagged,
        -- min_distance: closest face match to any face assigned to p_sort_person_id
        (
            SELECT MIN(df.encoding <=> ref.encoding)
            FROM portfolio.detected_face df
            CROSS JOIN portfolio.detected_face ref
            WHERE df.image_id = i.id
              AND ref.person_id = p_sort_person_id
              AND df.encoding <=> ref.encoding < p_threshold
        ) AS min_distance
    FROM portfolio.image i
    WHERE i.source_url IS NOT NULL
      AND (p_search IS NULL OR i.filename ILIKE '%' || p_search || '%'
           OR i.source_url ILIKE '%' || p_search || '%')
),
paginated AS (
    SELECT id
    FROM ranked_images
    WHERE (p_sort_person_id IS NULL AND (
            p_cursor_created_at IS NULL
            OR (created_at, id) < (p_cursor_created_at, p_cursor_id)
          ))
       OR (p_sort_person_id IS NOT NULL AND (
            p_cursor_id IS NULL
            OR (is_tagged, min_distance, id) < (p_cursor_is_tagged, p_cursor_min_distance, p_cursor_id)
          ))
    ORDER BY
        CASE WHEN p_sort_person_id IS NOT NULL THEN is_tagged END DESC NULLS LAST,
        CASE WHEN p_sort_person_id IS NOT NULL THEN min_distance END ASC NULLS LAST,
        CASE WHEN p_sort_person_id IS NULL THEN created_at END DESC,
        id
    LIMIT p_limit + 1
)
SELECT ... FROM paginated
JOIN portfolio.image i ON i.id = paginated.id
LEFT JOIN portfolio.detected_face df ON df.image_id = i.id
LEFT JOIN LATERAL (...person matches...) matches ON true
```

### Cursor Encoding

The cursor is a JSON object that the backend serializes/deserializes. The frontend treats it as an opaque string.

For default sort (newest first):

```json
{ "created_at": "2025-01-15T10:30:00Z", "id": "uuid-here" }
```

For person sort:

```json
{ "id": "uuid-here", "is_tagged": 0, "min_distance": 0.342 }
```

The backend parses the cursor JSON, extracts the fields, and passes them as individual RPC parameters. The `WHERE` clause direction is determined by the sort option, not the cursor.

**Response shape:**

```json
{
    "images": [...],
    "next_cursor": "{\"created_at\":\"2025-01-15T10:30:00Z\",\"id\":\"uuid-here\"}" | null
}
```

`next_cursor` is `null` when there are no more pages. The frontend passes it back as-is via query param.

---

## 2. Backend Changes

### `backend/models.py` — Update `GetImagesResponse`

Replace the existing response model with one that supports pagination:

```python
class GetImagesResponse(BaseModel):
    images: list[ImageWithFaces]
    next_cursor: str | None = None
```

The `count` field is removed — with pagination, total count is no longer relevant (and expensive to compute). The frontend can drop `images.count` usage.

### `backend/database.py` — Update `get_all_images()`

Update the existing function signature to accept pagination/filter/sort params:

```python
def get_all_images(
    limit: int = 40,
    cursor: str | None = None,
    sort_person_id: str | None = None,
    search: str | None = None,
    person_match_threshold: float = 0.5,
    person_match_top_n: int = 3,
) -> tuple[list[ImageWithFaces], str | None]:
    """Fetch a page of images with cursor-based pagination.

    Returns (images, next_cursor). next_cursor is None when no more pages.
    """
```

- Parses the cursor JSON string into individual fields
- Calls the updated `get_all_images_with_person_matches` RPC with individual cursor params
- Removes the internal 1000-row pagination loop (the RPC now limits results)
- Uses `_build_image_records()` to group the denormalized rows
- Builds `next_cursor` from the `(limit + 1)`th image's sort fields, serialized as JSON

### `backend/services.py` — Update `get_images()`

Update the existing function to accept and pass through the new params:

```python
def get_images(
    limit: int = 40,
    cursor: str | None = None,
    sort_person_id: str | None = None,
    search: str | None = None,
) -> GetImagesResponse:
```

### `backend/main.py` — Update `GET /images`

Add query params to the existing endpoint:

```python
@app.get("/images", response_model=GetImagesResponse, dependencies=[Depends(require_auth)])
def get_images(
    limit: int = 40,
    cursor: str | None = None,
    sort_person_id: str | None = None,
    search: str | None = None,
):
    return services.get_images(limit, cursor, sort_person_id, search)
```

All params have defaults, so existing callers without query params still work (they get the first 40 images).

---

## 3. Frontend Changes

### `src/chirp/types.ts` — Update `GetImagesResponse`

```typescript
export type GetImagesResponse = {
  images: ImageRecord[];
  next_cursor: string | null;
};
```

Remove the `count` field — no longer needed with pagination.

### `src/chirp/api.ts` — Update `getImages()`

```typescript
export const getImages = (params?: {
  limit?: number;
  cursor?: string | null;
  sortPersonId?: string;
  search?: string;
}) =>
  api
    .get<GetImagesResponse>('/images', {
      params: {
        limit: params?.limit,
        cursor: params?.cursor,
        sort_person_id: params?.sortPersonId,
        search: params?.search,
      },
    })
    .then((res) => res.data);
```

### `src/chirp/hooks.ts` — Update `useImages`

Convert `useImages` from `useQuery` to `useInfiniteQuery`:

```typescript
export const useImages = (options?: {
  sortPersonId?: string;
  search?: string;
}) => {
  const hook = useInfiniteQuery({
    queryKey: [
      'images',
      { sortPersonId: options?.sortPersonId, search: options?.search },
    ],
    queryFn: ({ pageParam }) =>
      getImages({
        cursor: pageParam ?? undefined,
        sortPersonId: options?.sortPersonId,
        search: options?.search,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    staleTime: Infinity,
  });

  const allImages = useMemo(
    () => hook.data?.pages.flatMap((page) => page.images) ?? [],
    [hook.data?.pages],
  );

  return {
    images: allImages,
    imagesLoading: hook.isFetching && !hook.isFetchingNextPage,
    imagesError: hook.error,
    fetchNextPage: hook.fetchNextPage,
    hasNextPage: hook.hasNextPage,
    isFetchingNextPage: hook.isFetchingNextPage,
  };
};
```

**Key details:**

- `queryKey` includes sort/search params so changing them resets the infinite query
- `initialPageParam: null` (first page has no cursor)
- `getNextPageParam` returns `next_cursor` from the response
- `allImages` flattens all fetched pages into a single array for the virtualizer
- Sorting is now server-side — the client no longer needs `useMemo` sort logic
- Return shape changes: `images` is now `ImageRecord[]` directly (not `{ images, count }`)

### `src/chirp/components/ImageMasonryV2.tsx` — Changes

Uses the [TanStack Virtual infinite scroll pattern](https://github.com/TanStack/virtual/blob/main/examples/react/infinite-scroll/src/main.tsx) — the virtualizer itself drives page fetching, no separate IntersectionObserver needed.

1. **Accept new props** from the parent:

   ```typescript
   type ImageMasonryV2Props = {
     showFaceOverlays?: boolean;
     sortBy?: string;
     search?: string;
   };
   ```

2. **Update `useImages` call** to pass sort/search params:

   ```typescript
   const {
     images,
     imagesLoading,
     imagesError,
     fetchNextPage,
     hasNextPage,
     isFetchingNextPage,
   } = useImages({ sortPersonId: sortBy, search });
   ```

3. **Remove client-side sorting** — the `sortedImages` `useMemo` that sorts by person distance is no longer needed since the backend handles it. Use `images` directly instead.

4. **Add a loader row to the virtualizer count** — when `hasNextPage`, add 1 extra item. This virtual "loader row" triggers fetching when scrolled into view:

   ```typescript
   const rowVirtualizer = useVirtualizer({
     count: hasNextPage ? images.length + 1 : images.length,
     getScrollElement: () => parentRef.current,
     estimateSize: (index) => {
       if (index >= images.length) return 100; // loader row
       const image = images[index];
       return image ? estimateImageHeight(image) + GAP : ESTIMATED_HEIGHT + GAP;
     },
     overscan: 5,
     lanes,
   });
   ```

5. **Fetch next page when the last virtual item is visible** — a `useEffect` watches the virtualizer's rendered items. When the last rendered item reaches the loader row index, trigger `fetchNextPage()`:

   ```typescript
   useEffect(() => {
     const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();
     if (!lastItem) return;

     if (
       lastItem.index >= images.length - 1 &&
       hasNextPage &&
       !isFetchingNextPage
     ) {
       fetchNextPage();
     }
   }, [
     hasNextPage,
     fetchNextPage,
     images.length,
     isFetchingNextPage,
     rowVirtualizer.getVirtualItems(),
   ]);
   ```

6. **Render loader row as skeleton** — in the virtual items map, check if the item index exceeds the data array. If so, render the existing `Skeleton` component (matching the current loading state style) instead of an image card:

   ```typescript
   {rowVirtualizer.getVirtualItems().map((virtualRow) => {
     const isLoaderRow = virtualRow.index >= images.length;

     if (isLoaderRow) {
       return (
         <div key="loader" style={...}>
           {hasNextPage ? (
             <Skeleton className="h-full w-full rounded-[14px] bg-chirp-panel" />
           ) : null}
         </div>
       );
     }

     const image = images[virtualRow.index];
     // ... existing image card rendering
   })}
   ```

7. **Keep `isTaggedForPerson` / pin badge** — the pinned state is still derivable from the image's `detected_faces` data (no change needed). The backend sort ensures tagged images come first.

### `src/routes/chirpv2.tsx` — Search input

The search input in the header is currently a placeholder `<span>`. Wire it up:

1. Update the route search schema — remove `page` (no longer meaningful with infinite scroll), add `search`:

   ```typescript
   const defaultParams = {
     sortBy: undefined as string | undefined,
     search: undefined as string | undefined,
   };

   const searchSchema = z.object({
     sortBy: z.string().optional(),
     search: z.string().optional(),
   });
   ```

2. Replace the placeholder `<span>` with an actual `<input>` that debounces and updates the URL search param.

3. Pass `search` to `ImageMasonryV2`:
   ```tsx
   <ImageMasonryV2
     showFaceOverlays={showOverlays}
     sortBy={sortBy}
     search={search}
   />
   ```

---

## 4. File Changes Summary

### SQL (modified)

| File                                            | Purpose                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `backend/sql/get_image_with_person_matches.sql` | Update `get_all_images_with_person_matches` RPC with pagination, search, sort params |

### Backend (modified)

| File                  | Changes                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `backend/models.py`   | Update `GetImagesResponse` — replace `count` with `next_cursor`                                                   |
| `backend/database.py` | Update `get_all_images()` — add pagination/filter/sort params, remove internal 1000-row loop, cursor JSON parsing |
| `backend/services.py` | Update `get_images()` — accept and pass through new params                                                        |
| `backend/main.py`     | Update `GET /images` — add query params (`limit`, `cursor`, `sort_person_id`, `search`)                           |

### Frontend (modified)

| File                                      | Changes                                                                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/chirp/types.ts`                      | Update `GetImagesResponse` — replace `count` with `next_cursor`                                                             |
| `src/chirp/api.ts`                        | Update `getImages()` — accept params object                                                                                 |
| `src/chirp/hooks.ts`                      | Update `useImages()` — convert from `useQuery` to `useInfiniteQuery`, accept sort/search options                            |
| `src/chirp/components/ImageMasonryV2.tsx` | Update `useImages` call, add virtualizer-driven infinite scroll (loader row + useEffect), remove client-side sort           |
| `src/routes/chirpv2.tsx`                  | Remove `page` from search schema, add `search`, wire up search input, pass `search` to masonry, remove `images.count` usage |

---

## 5. Implementation Order

1. **SQL RPC** — Update `get_all_images_with_person_matches` in Supabase with new params
2. **Backend models** — Update `GetImagesResponse` (replace `count` with `next_cursor`)
3. **Backend database + services** — Update `get_all_images()` and `get_images()` with pagination params
4. **Backend endpoint** — Update `GET /images` with query params
5. **Frontend types + API** — Update `GetImagesResponse` and `getImages()`
6. **Frontend hook** — Convert `useImages` from `useQuery` to `useInfiniteQuery`
7. **Masonry component** — Update `useImages` call with params, add virtualizer-driven infinite scroll, remove client-side sort
8. **Route** — Remove `page` from search schema, add `search`, wire up search input with debounce, remove `images.count` usage
9. **Testing** — Verify scroll triggers fetch, search filters, person sort works server-side

---

## 6. Edge Cases & Considerations

- **Changing sort/search resets the infinite query** — `queryKey` includes these params, so TanStack Query starts fresh when they change. The virtualizer resets to the top.
- **Changing sort resets cursor** — the cursor from one sort option is invalid for another. TanStack Query handles this since sort is in the `queryKey`.
- **Image detail page (`/chirpv2/image/$imageId`)** — Currently uses `useImage(imageId)` which fetches a single image. No change needed.
- **Cache invalidation** — `useScrapeJob`, `useTagFaceToPerson`, `useDeleteImage`, etc. all invalidate `{ queryKey: ['images'] }`. With the new key structure `['images', { sortPersonId, search }]`, the partial match on `['images']` still works and invalidates all variants.
- **`images.count` removal** — The route currently uses `images?.count` for a photo count badge. With pagination, total count is expensive. Options: remove the badge, show count of loaded images, or add a separate cheap `SELECT count(*)` endpoint later if needed.
- **Empty search** — Treat empty string the same as `undefined` (no filter).
- **Debounce** — Search input should debounce by ~300ms before updating the URL search param and triggering a refetch.
- **No `page` in URL** — Infinite scroll always starts from the top. Browser back/forward relies on TanStack Query's in-memory cache for the session.
