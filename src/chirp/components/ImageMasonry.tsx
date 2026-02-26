import { Link } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import { useImages } from '../hooks';
import type { ImageRecord } from '../types';
import { ImageFaceOverlay } from './ImageWithFaceOverlay';

const COLUMN_WIDTH = 280;
const GAP = 16;
const ESTIMATED_HEIGHT = 300;

// FNV-1a 32-bit hash → xorshift32 PRNG → pseudo-random sparkle positions per image
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number) {
  let s = (seed || 1) >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

// 12 sparkles seeded by image ID — unique pattern per anchor
// durations (1.6–3.4 s) so phase drifts continuously and never looks locked
function genSparkles(imageId: string) {
  const rng = makeRng(hashString(imageId));
  return Array.from({ length: 12 }, () => ({
    left: `${6 + Math.floor(rng() * 86)}%`, // 6 %–92 %
    top: 58 + Math.floor(rng() * 68), // 58–126 px (scan line at y=90)
    delay: `${(rng() * 2.5).toFixed(2)}s`, // 0–2.5 s
    dur: `${(1.6 + rng() * 1.8).toFixed(1)}s`, // 1.6–3.4 s
  }));
}

type ImageMasonryProps = {
  showFaceOverlays?: boolean;
  sortPersonId?: string;
  search?: string;
};

function isTaggedForPerson(image: ImageRecord, personId: string): boolean {
  return image.detected_faces.some((face) => face.person_id === personId);
}

function estimateImageHeight(
  image: ImageRecord,
  columnWidth: number = COLUMN_WIDTH,
): number {
  if (image.width && image.height) {
    const ratio = image.height / image.width;
    return columnWidth * ratio;
  }
  return ESTIMATED_HEIGHT;
}

function getContentWidth(container: HTMLDivElement): number {
  const styles = window.getComputedStyle(container);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  return Math.max(0, container.clientWidth - paddingLeft - paddingRight);
}

export function ImageMasonry({
  showFaceOverlays = true,
  sortPersonId,
  search,
}: ImageMasonryProps) {
  const {
    images,
    imagesLoading,
    imagesError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useImages({ sortPersonId, search });

  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useState(() => ({
    lanes: 3,
    columnWidth: COLUMN_WIDTH,
  }));

  const parentRef = useRef<HTMLDivElement>(null);

  const { lanes, columnWidth } = layout;
  const laneWidth = 100 / lanes;

  // +1 for the loader row when there are more pages
  const virtualCount = hasNextPage ? images.length + 1 : images.length;

  const rowVirtualizer = useVirtualizer({
    count: virtualCount,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const image = images[index];
      return image
        ? estimateImageHeight(image, columnWidth) + GAP
        : ESTIMATED_HEIGHT + GAP;
    },
    overscan: 5,
    lanes,
    getItemKey: (index) => images[index]?.id ?? 'loader',
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];

  // Trigger next page fetch when loader row (or last image) becomes visible
  useEffect(() => {
    if (!lastItem) return;
    if (
      lastItem.index >= images.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [lastItem, hasNextPage, isFetchingNextPage, fetchNextPage, images.length]);

  // Recompute estimated sizes when data count or lane width changes.
  useEffect(() => {
    rowVirtualizer.measure();
  }, [images.length, columnWidth, lanes, rowVirtualizer]);

  const onImageLoad = useCallback((imageId: string) => {
    setLoadedImages((prev) => new Set(prev).add(imageId));
  }, []);

  useLayoutEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const updateLayout = () => {
      const contentWidth = getContentWidth(parent);
      const lanesFromWidth = Math.max(
        1,
        Math.floor((contentWidth + GAP) / (COLUMN_WIDTH + GAP)),
      );
      const nextColumnWidth = Math.max(1, contentWidth / lanesFromWidth - GAP);

      setLayout((prev) => {
        if (
          prev.lanes === lanesFromWidth &&
          Math.abs(prev.columnWidth - nextColumnWidth) < 0.5
        ) {
          return prev;
        }
        return { lanes: lanesFromWidth, columnWidth: nextColumnWidth };
      });
    };

    updateLayout();

    const resizeObserver = new ResizeObserver(updateLayout);
    resizeObserver.observe(parent);

    return () => resizeObserver.disconnect();
  }, []);

  if (imagesLoading) {
    // Alternating tall/short pattern offset per column so adjacent columns interlock
    const TALL = 450;
    const SHORT = 300;
    const colHeights = (col: number) =>
      Array.from({ length: 5 }, (_, row) =>
        (col + row) % 2 === 0 ? TALL : SHORT,
      );

    return (
      <div ref={parentRef} className="h-full overflow-auto bg-chirp-grid p-6">
        <div className="flex gap-4">
          {Array.from({ length: lanes }, (_, col) => (
            <div key={col} className="flex flex-1 flex-col gap-4">
              {colHeights(col).map((h, row) => (
                <Skeleton
                  key={row}
                  className="w-full rounded-[14px] bg-chirp-panel"
                  style={{ height: h }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (imagesError) {
    return (
      <div className="flex items-center justify-center p-12 text-red-400">
        Error loading images
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div
        className="
        flex items-center justify-center p-12 text-chirp-text-faint
      "
      >
        No images found.
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto bg-chirp-grid p-6">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          // Loader row
          if (virtualRow.index === images.length) {
            return (
              <div
                key="loader"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${virtualRow.lane * laneWidth}%`,
                  width: `calc(${laneWidth}% - ${GAP}px)`,
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: GAP,
                }}
              >
                <Skeleton
                  className="w-full rounded-[14px] bg-chirp-panel"
                  style={{ height: ESTIMATED_HEIGHT }}
                />
              </div>
            );
          }

          const image = images[virtualRow.index];
          if (!image) return null;
          const isLoaded = loadedImages.has(image.id);
          const isAnchor =
            sortPersonId && isTaggedForPerson(image, sortPersonId);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: `${virtualRow.lane * laneWidth}%`,
                width: `calc(${laneWidth}% - ${GAP}px)`,
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: GAP,
              }}
            >
              <Link
                to="/chirp/gallery/$imageId"
                params={{ imageId: image.id }}
                className="group block"
              >
                <div
                  className={`
                    relative cursor-pointer overflow-hidden rounded-[14px]
                    border shadow-[0_8px_24px_rgba(0,0,0,0.35)]
                    transition-all
                    hover:shadow-[0_12px_32px_rgba(0,0,0,0.45)]
                    ${
                      isAnchor
                        ? 'border-(--chirp-border-warm)/45 ring-1 ring-(--chirp-border-warm)/25 hover:border-(--chirp-border-warm)/65'
                        : 'border-chirp-border-warm/15 hover:border-chirp-border-warm/30'
                    }
                  `}
                  style={
                    !isLoaded && !(image.width && image.height)
                      ? { minHeight: ESTIMATED_HEIGHT }
                      : undefined
                  }
                >
                  {isAnchor && (
                    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[14px]">
                      {/* Scan beam */}
                      <div
                        className="absolute inset-x-0 animate-chirp-scan"
                        style={{ top: 0 }}
                      >
                        <div className="relative" style={{ height: '192px' }}>
                          {/* Grid above scan line — leading trail */}
                          <div
                            className="absolute inset-x-0 top-0"
                            style={{
                              height: '90px',
                              backgroundImage: [
                                'linear-gradient(color-mix(in srgb, var(--chirp-accent) 28%, transparent) 1px, transparent 1px)',
                                'linear-gradient(90deg, color-mix(in srgb, var(--chirp-accent) 28%, transparent) 1px, transparent 1px)',
                              ].join(', '),
                              backgroundSize: '15px 15px',
                              maskImage:
                                'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 20%, rgba(0,0,0,0.8) 60%, black 88%)',
                              WebkitMaskImage:
                                'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 20%, rgba(0,0,0,0.8) 60%, black 88%)',
                            }}
                          />
                          {/* Scan line */}
                          <div
                            className="absolute inset-x-0 h-[2px]"
                            style={{
                              top: '90px',
                              background:
                                'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--chirp-accent-start) 60%, transparent) 12%, var(--chirp-accent-end) 30%, var(--chirp-scan-sparkle) 50%, var(--chirp-accent-end) 70%, color-mix(in srgb, var(--chirp-accent-start) 60%, transparent) 88%, transparent 100%)',
                              boxShadow:
                                '0 0 16px 6px color-mix(in srgb, var(--chirp-accent) 45%, transparent), 0 0 6px 2px color-mix(in srgb, var(--chirp-scan-sparkle) 65%, transparent), 0 0 2px 0px rgba(255,255,255,0.9)',
                            }}
                          />
                          {/* Grid below scan line — wake (fainter) */}
                          <div
                            className="absolute inset-x-0"
                            style={{
                              top: '92px',
                              height: '100px',
                              backgroundImage: [
                                'linear-gradient(color-mix(in srgb, var(--chirp-accent) 13%, transparent) 1px, transparent 1px)',
                                'linear-gradient(90deg, color-mix(in srgb, var(--chirp-accent) 13%, transparent) 1px, transparent 1px)',
                              ].join(', '),
                              backgroundSize: '15px 15px',
                              backgroundPosition: '0 -2px',
                              maskImage:
                                'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.1) 80%, transparent 100%)',
                              WebkitMaskImage:
                                'linear-gradient(to bottom, black 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.1) 80%, transparent 100%)',
                            }}
                          />
                          {/* Sparkle dots — positions seeded by image ID */}
                          {genSparkles(image.id).map((s, i) => (
                            <div
                              key={i}
                              style={{
                                position: 'absolute',
                                left: s.left,
                                top: `${s.top}px`,
                                transform: 'translate(-50%, -50%)',
                              }}
                            >
                              <div
                                style={{
                                  width: '2px',
                                  height: '2px',
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--chirp-scan-sparkle)',
                                  boxShadow:
                                    '0 0 3px 1px color-mix(in srgb, var(--chirp-scan-sparkle) 40%, transparent), 0 -4px 0 0 color-mix(in srgb, var(--chirp-scan-sparkle) 12%, transparent), 0 4px 0 0 color-mix(in srgb, var(--chirp-scan-sparkle) 12%, transparent), -4px 0 0 0 color-mix(in srgb, var(--chirp-scan-sparkle) 12%, transparent), 4px 0 0 0 color-mix(in srgb, var(--chirp-scan-sparkle) 12%, transparent)',
                                  animation: `chirp-sparkle ${s.dur} ease-in-out infinite`,
                                  animationDelay: s.delay,
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {!isLoaded && (
                    <Skeleton
                      className="
                        absolute inset-0 size-full rounded-[14px] bg-chirp-panel
                      "
                    />
                  )}
                  <ImageFaceOverlay
                    image={image}
                    showOverlays={showFaceOverlays}
                    className={`
                      transition-opacity duration-200
                      ${isLoaded ? 'opacity-100' : 'opacity-0'}
                    `}
                    imgClassName="w-full h-auto block rounded-[14px]"
                    onLoad={() => onImageLoad(image.id)}
                  />
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
