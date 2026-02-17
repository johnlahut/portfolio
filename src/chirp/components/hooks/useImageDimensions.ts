import { useCallback, useEffect, useRef, useState } from 'react';

import type { ImageDimensions } from '../../types';

export function useImageDimensions() {
  const imageRef = useRef<HTMLImageElement>(null);
  const [dimensions, setDimensions] = useState<ImageDimensions>({
    naturalWidth: 0,
    naturalHeight: 0,
    displayedWidth: 0,
    displayedHeight: 0,
    isLoaded: false,
  });

  const updateDisplayedDimensions = useCallback(() => {
    if (imageRef.current) {
      setDimensions((prev) => ({
        ...prev,
        displayedWidth: imageRef.current!.clientWidth,
        displayedHeight: imageRef.current!.clientHeight,
      }));
    }
  }, []);

  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      setDimensions({
        naturalWidth: imageRef.current.naturalWidth,
        naturalHeight: imageRef.current.naturalHeight,
        displayedWidth: imageRef.current.clientWidth,
        displayedHeight: imageRef.current.clientHeight,
        isLoaded: true,
      });
    }
  }, []);

  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;

    const resizeObserver = new ResizeObserver(updateDisplayedDimensions);
    resizeObserver.observe(img);

    return () => resizeObserver.disconnect();
  }, [updateDisplayedDimensions]);

  return { imageRef, dimensions, handleImageLoad };
}
