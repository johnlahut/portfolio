import { AnimatePresence } from 'motion/react';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

import type { DetectedFace, ImageRecord, Person } from '../types';
import { FaceBoundingBox } from './FaceBoundingBox';
import { FacePersonSelect } from './FacePersonSelect';
import { useImageDimensions } from './hooks/useImageDimensions';

type FaceOverlayImageProps = {
  image: ImageRecord;
  showOverlays?: boolean;
  className?: string;
  imgClassName?: string;
  imgStyle?: CSSProperties;
  onLoad?: () => void;
  onPersonSelect?: (face: DetectedFace, person: Person | null) => void;
  enablePersonSelect?: boolean;
};

export function FaceOverlayImage({
  image,
  showOverlays = true,
  className,
  imgClassName,
  imgStyle,
  onLoad,
  onPersonSelect,
  enablePersonSelect = false,
}: FaceOverlayImageProps) {
  const { imageRef, dimensions, handleImageLoad } = useImageDimensions();
  const [popoverFace, setPopoverFace] = useState<DetectedFace | null>(null);
  const [hoveredFaceId, setHoveredFaceId] = useState<string | null>(null);

  const scaleX = dimensions.isLoaded
    ? dimensions.displayedWidth / dimensions.naturalWidth
    : 1;
  const scaleY = dimensions.isLoaded
    ? dimensions.displayedHeight / dimensions.naturalHeight
    : 1;

  const handleFaceClick = (face: DetectedFace) => {
    if (enablePersonSelect) {
      setPopoverFace(face);
    }
  };

  // Sort faces so hovered/selected renders last (on top) in SVG paint order
  const activeFaceId = hoveredFaceId ?? popoverFace?.id;
  const sortedFaces = useMemo(() => {
    if (!activeFaceId) return image.detected_faces;
    return [...image.detected_faces].sort((a, b) => {
      if (a.id === activeFaceId) return 1;
      if (b.id === activeFaceId) return -1;
      return 0;
    });
  }, [image.detected_faces, activeFaceId]);

  return (
    <div className={cn('relative', className)}>
      <img
        ref={imageRef}
        src={image.source_url!}
        alt={image.filename}
        onLoad={() => {
          handleImageLoad();
          onLoad?.();
        }}
        className={imgClassName ?? 'w-full h-auto block'}
        style={{
          ...(image.width && image.height
            ? { aspectRatio: `${image.width} / ${image.height}` }
            : {}),
          ...imgStyle,
        }}
      />
      {dimensions.isLoaded && image.detected_faces.length > 0 && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ overflow: 'visible' }}
          viewBox={`0 0 ${dimensions.displayedWidth} ${dimensions.displayedHeight}`}
          preserveAspectRatio="none"
        >
          <g className="pointer-events-auto">
            <AnimatePresence>
              {showOverlays &&
                sortedFaces.map((face) => (
                  <FaceBoundingBox
                    key={face.id}
                    face={face}
                    scaleX={scaleX}
                    scaleY={scaleY}
                    isSelected={popoverFace?.id === face.id}
                    onClick={handleFaceClick}
                    onHoverChange={(hovered) =>
                      setHoveredFaceId(hovered ? face.id : null)
                    }
                  />
                ))}
            </AnimatePresence>
          </g>
        </svg>
      )}
      {popoverFace && (
        <FacePersonSelect
          face={popoverFace}
          scaleX={scaleX}
          scaleY={scaleY}
          isOpen={!!popoverFace}
          onOpenChange={(open) => !open && setPopoverFace(null)}
          onPersonSelect={onPersonSelect}
        />
      )}
    </div>
  );
}
