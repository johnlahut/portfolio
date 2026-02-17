import { Link, useSearch } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pin } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import { useImages } from '../hooks';
import type { ImageRecord } from '../types';
import { FaceOverlayImage } from './FaceOverlayImage';

const COLUMN_WIDTH = 280;
const GAP = 16;
const ESTIMATED_HEIGHT = 300;

// Cache measured heights to avoid re-estimation jumps
// const heightCache = new Map<string, number>();

type ImageMasonryProps = {
  showFaceOverlays?: boolean;
};

function isTaggedForPerson(image: ImageRecord, personId: string): boolean {
  return image.detected_faces.some((face) => face.person_id === personId);
}

function getMinDistanceForPerson(
  image: ImageRecord,
  personId: string,
): number | null {
  let minDistance: number | null = null;
  for (const face of image.detected_faces) {
    for (const match of face.matched_persons) {
      if (match.person_id === personId) {
        if (minDistance === null || match.distance < minDistance) {
          minDistance = match.distance;
        }
      }
    }
  }
  return minDistance;
}

function estimateImageHeight(image: ImageRecord): number {
  if (image.width && image.height) {
    const ratio = image.height / image.width;
    return COLUMN_WIDTH * ratio;
  }
  return ESTIMATED_HEIGHT;
}

export function ImageMasonry({ showFaceOverlays = true }: ImageMasonryProps) {
  const { images, imagesLoading, imagesError } = useImages();

  const { sortBy } = useSearch({ from: '/chirp' });

  const [lanes, setLanes] = useState(4);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const parentRef = useRef<HTMLDivElement>(null);

  const laneWidth = 100 / lanes;

  const sortedImages = useMemo(() => {
    const filtered = (images?.images ?? []).filter((img) => img.source_url);

    if (!sortBy) return filtered;

    return [...filtered].sort((a, b) => {
      // Pin tagged images at the top
      const taggedA = isTaggedForPerson(a, sortBy);
      const taggedB = isTaggedForPerson(b, sortBy);

      if (taggedA && !taggedB) return -1;
      if (!taggedA && taggedB) return 1;

      // Then sort by match distance
      const distA = getMinDistanceForPerson(a, sortBy);
      const distB = getMinDistanceForPerson(b, sortBy);

      if (distA === null && distB === null) return 0;
      if (distA === null) return 1;
      if (distB === null) return -1;
      return distA - distB;
    });
  }, [images?.images, sortBy]);

  const rowVirtualizer = useVirtualizer({
    count: sortedImages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const image = sortedImages[index];
      return image ? estimateImageHeight(image) + GAP : ESTIMATED_HEIGHT + GAP;
    },
    overscan: 5,
    lanes,
    getItemKey: (index) => sortedImages[index].id,
  });

  // need to re-measure when the order of our images changes (variable heights)
  useEffect(() => {
    rowVirtualizer.measure();
  }, [sortedImages, rowVirtualizer]);

  const onImageLoad = useCallback((imageId: string /*index: number*/) => {
    setLoadedImages((prev) => new Set(prev).add(imageId));
  }, []);

  // re-calc lanes when screen width changes
  useLayoutEffect(() => {
    const updateLanes = () => {
      if (parentRef.current) {
        const width = parentRef.current.offsetWidth;
        const newLanes = Math.max(
          1,
          Math.floor((width + GAP) / (COLUMN_WIDTH + GAP)),
        );
        setLanes(newLanes);
      }
    };

    updateLanes();
    window.addEventListener('resize', updateLanes);
    return () => window.removeEventListener('resize', updateLanes);
  }, []);

  // loading
  if (imagesLoading) {
    return <div className="p-4">Loading...</div>;
  }

  // error
  else if (imagesError) {
    return <div className="p-4 text-red-500">Error loading images</div>;
  }

  // empty
  else if (sortedImages.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No images found.
      </div>
    );
  }

  // happy path
  else {
    return (
      <div ref={parentRef} className="h-full overflow-auto p-1">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const image = sortedImages[virtualRow.index];
            const isLoaded = loadedImages.has(image.id);
            // const hasFaces = image.detected_faces.length > 0;
            const isPinned = sortBy && isTaggedForPerson(image, sortBy);

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={(el) => {
                  if (el) {
                    itemRefs.current.set(virtualRow.index, el);
                    rowVirtualizer.measureElement(el);
                  }
                }}
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
                  to="/chirp/image/$imageId"
                  params={{ imageId: image.id }}
                  className="block"
                >
                  <div
                    className="relative rounded-lg bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                    style={
                      !isLoaded && !(image.width && image.height)
                        ? { minHeight: 200 }
                        : undefined
                    }
                  >
                    {isPinned && (
                      <div className="absolute top-2 left-2 z-10 rounded-full bg-primary p-1.5 shadow-md">
                        <Pin className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                    {!isLoaded && (
                      <Skeleton className="absolute inset-0 w-full h-full" />
                    )}
                    <FaceOverlayImage
                      image={image}
                      showOverlays={showFaceOverlays}
                      className={`transition-opacity duration-200 ${
                        isLoaded ? 'opacity-100' : 'opacity-0'
                      }`}
                      imgClassName="w-full h-auto block rounded-lg"
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
}
