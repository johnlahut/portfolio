import { Link } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pin } from 'lucide-react';
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

  const [layout, setLayout] = useState(() => ({
    lanes: 3,
    columnWidth: COLUMN_WIDTH,
  }));
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

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

  // Trigger next page fetch when loader row (or last image) becomes visible.
  // Use lastItem.index (a number) as the dep — not the array ref — to avoid
  // running this effect on every render.
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
          const isPinned =
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
                  className="
                    relative cursor-pointer overflow-hidden rounded-[14px]
                    border border-chirp-border-warm/15
                    shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-all
                    hover:border-chirp-border-warm/30
                    hover:shadow-[0_12px_32px_rgba(0,0,0,0.45)]
                  "
                  style={
                    !isLoaded && !(image.width && image.height)
                      ? { minHeight: ESTIMATED_HEIGHT }
                      : undefined
                  }
                >
                  {isPinned && (
                    <div
                      className="
                      absolute top-2.5 left-2.5 z-10 rounded-full
                      bg-chirp-accent p-1.5 shadow-md
                    "
                    >
                      <Pin className="size-3.5 text-chirp-page" />
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
