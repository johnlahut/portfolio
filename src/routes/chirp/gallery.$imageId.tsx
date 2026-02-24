import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ExternalLink, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { ImageFaceOverlay } from '~/chirp/components/ImageWithFaceOverlay';
import { useDeleteImage, useImage, useTagFaceToPerson } from '~/chirp/hooks';

export const Route = createFileRoute('/chirp/gallery/$imageId')({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { imageId } = Route.useParams();

  const { image, imageLoading, imageError } = useImage(imageId);
  const { deleteImage, deleteImageLoading } = useDeleteImage();
  const { tagFaceToPerson } = useTagFaceToPerson();

  const [showOverlays, setShowOverlays] = useState(true);

  const handleClose = () =>
    navigate({ to: '/chirp/gallery', search: (prev) => prev });

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this image?')) {
      deleteImage(imageId, { onSuccess: handleClose });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="
        flex max-h-[calc(100vh-2rem)] w-auto max-w-[calc(100vw-2rem)] flex-col
        overflow-visible border-chirp-border/40 bg-chirp-panel p-0
        sm:max-w-[calc(100vw-2rem)]
      "
      >
        {/* Overlay toggle */}
        {image?.detected_faces && image.detected_faces.length > 0 && (
          <div className="flex items-center gap-2 px-4 pt-4">
            <Switch
              id="preview-overlays-v2"
              checked={showOverlays}
              onCheckedChange={setShowOverlays}
              size="sm"
            />
            <Label
              htmlFor="preview-overlays-v2"
              className="text-sm text-chirp-text"
            >
              Face overlays
            </Label>
          </div>
        )}

        {/* Image */}
        <div
          className="
          flex flex-1 items-center justify-center overflow-visible px-4 py-8
        "
        >
          {imageLoading ? (
            <span className="text-chirp-text-muted">Loading...</span>
          ) : imageError || !image?.source_url ? (
            <span className="text-chirp-text-muted">
              {imageError ? 'Error loading image' : 'Image not found'}
            </span>
          ) : (
            <ImageFaceOverlay
              image={image}
              showOverlays={showOverlays}
              enablePersonSelect
              onPersonSelect={(face, person) =>
                tagFaceToPerson({
                  faceId: face.id,
                  personId: person?.id ?? null,
                })
              }
              imgClassName="block rounded-[14px]"
              imgStyle={{
                maxWidth: 'calc(100vw - 4rem)',
                maxHeight: 'calc(100vh - 8rem)',
              }}
            />
          )}
        </div>

        {/* Footer */}
        {image && (
          <DialogFooter
            className="
            border-t border-chirp-border/30 px-4 pt-3 pb-4 text-sm
            text-chirp-text
            sm:justify-between
          "
          >
            <div className="flex items-center gap-3">
              <span className="font-medium">
                {image.filename}
                {image.detected_faces.length > 0 && (
                  <span className="ml-2 text-chirp-text-muted">
                    · {image.detected_faces.length} face(s)
                  </span>
                )}
              </span>
              {image.source_url && (
                <a
                  href={image.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    inline-flex items-center gap-1 text-chirp-text-muted
                    transition-colors
                    hover:text-chirp-text
                  "
                >
                  <ExternalLink className="size-3.5" />
                  Source
                </a>
              )}
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteImageLoading}
            >
              <Trash2 className="mr-1 size-4" />
              {deleteImageLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
