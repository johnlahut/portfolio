import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ExternalLink, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { FaceOverlayImage } from '~/chirp/components/FaceOverlayImage';
import { useDeleteImage, useImage, useTagFaceToPerson } from '~/chirp/hooks';

export const Route = createFileRoute('/chirp/image/$imageId')({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const { imageId } = Route.useParams();

  const { image, imageLoading, imageError } = useImage(imageId);
  const { deleteImage, deleteImageLoading } = useDeleteImage();
  const { tagFaceToPerson } = useTagFaceToPerson();

  const [showOverlays, setShowOverlays] = useState(true);

  const handleClose = () => navigate({ to: '/chirp', search: (prev) => prev });

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this image?')) {
      deleteImage(imageId, { onSuccess: handleClose });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] w-auto flex-col overflow-visible p-0">
        {/* Overlay toggle */}
        {image?.detected_faces && image.detected_faces.length > 0 && (
          <div className="flex items-center gap-2 px-4 pt-4">
            <Switch
              id="preview-overlays"
              checked={showOverlays}
              onCheckedChange={setShowOverlays}
              size="sm"
            />
            <Label htmlFor="preview-overlays" className="text-sm text-white">
              Face overlays
            </Label>
          </div>
        )}

        {/* Image */}
        <div className="flex flex-1 items-center justify-center overflow-visible px-4 py-8">
          {imageLoading ? (
            <span className="text-white">Loading...</span>
          ) : imageError || !image?.source_url ? (
            <span className="text-white">
              {imageError ? 'Error loading image' : 'Image not found'}
            </span>
          ) : (
            <FaceOverlayImage
              image={image}
              showOverlays={showOverlays}
              enablePersonSelect
              onPersonSelect={(face, person) =>
                tagFaceToPerson({
                  faceId: face.id,
                  personId: person?.id ?? null,
                })
              }
              imgClassName="block"
              imgStyle={{
                maxWidth: 'calc(100vw - 4rem)',
                maxHeight: 'calc(100vh - 8rem)',
              }}
            />
          )}
        </div>

        {/* Footer */}
        {image && (
          <DialogFooter className="px-4 pb-4 text-sm text-white sm:justify-between">
            <div className="flex items-center gap-3">
              <span>
                {image.filename}
                {image.detected_faces.length > 0 && (
                  <span className="text-white/70 ml-2">
                    · {image.detected_faces.length} face(s)
                  </span>
                )}
              </span>
              {image.source_url && (
                <a
                  href={image.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-white/70 hover:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
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
              <Trash2 className="h-4 w-4 mr-1" />
              {deleteImageLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
