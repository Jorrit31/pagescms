"use client";

/**
 * Replace a photo straight from the live preview: tap the photo, then take a
 * new one, upload one, or pick one that is already on the website. The new
 * photo goes into the form like any other change, so Save works as always.
 * Everything else of the photo (its focus point, its description) stays.
 */

import { useRef } from "react";
import { Camera, FolderOpen, ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MediaUpload } from "@/components/media/media-upload";
import { MediaDialog, type MediaDialogHandle } from "@/components/media/media-dialog";
import { Thumbnail } from "@/components/thumbnail";
import { useImageFieldMedia } from "@/fields/core/image/edit-component";
import { normalizeMediaPath } from "@/lib/utils/file";
import { t } from "@/lib/i18n";
import type { Field } from "@/types/field";

const PhotoChoices = ({
  field,
  current,
  onChoose,
}: {
  field: Field;
  current: string;
  onChoose: (path: string) => void;
}) => {
  const { mediaConfig, rootPath, allowedExtensions } = useImageFieldMedia(field);
  const libraryRef = useRef<MediaDialogHandle>(null);
  if (!mediaConfig) return <p className="text-sm text-muted-foreground">{t("This part can't be changed here.")}</p>;

  return (
    <MediaUpload
      path={rootPath}
      media={mediaConfig.name}
      extensions={allowedExtensions || undefined}
      onUpload={(saved) => { if (saved.path) onChoose(normalizeMediaPath(saved.path)); }}
      multiple={false}
      rename={mediaConfig.rename}
    >
      <div className="grid gap-4">
        {current && (
          <div className="flex justify-center">
            <Thumbnail name={mediaConfig.name} path={current} className="size-24 rounded-lg sm:size-32" />
          </div>
        )}
        <div className="grid gap-2">
          {/* Phones and tablets: take a photo right away. */}
          <MediaUpload.Trigger capture="environment">
            <Button type="button" variant="outline" className="hidden h-12 justify-start gap-3 text-base pointer-coarse:flex">
              <Camera className="size-5" />
              {t("Take photo")}
            </Button>
          </MediaUpload.Trigger>
          <MediaUpload.Trigger>
            <Button type="button" variant="outline" className="h-12 justify-start gap-3 text-base sm:h-10 sm:text-sm">
              <ImageUp className="size-5" />
              <span className="pointer-coarse:hidden">{t("Upload a photo from your computer")}</span>
              <span className="hidden pointer-coarse:inline">{t("Choose a photo from your phone")}</span>
            </Button>
          </MediaUpload.Trigger>
          <Button
            type="button"
            variant="outline"
            className="h-12 justify-start gap-3 text-base sm:h-10 sm:text-sm"
            onClick={() => libraryRef.current?.open()}
          >
            <FolderOpen className="size-5" />
            {t("Pick a photo from the website")}
          </Button>
        </div>
      </div>
      <MediaDialog
        ref={libraryRef}
        media={mediaConfig.name}
        initialPath={rootPath}
        maxSelected={1}
        extensions={allowedExtensions}
        onSubmit={(paths) => { if (paths[0]) onChoose(normalizeMediaPath(paths[0])); }}
      />
    </MediaUpload>
  );
};

export function PreviewPhotoDialog({
  photo,
  onClose,
  onChoose,
}: {
  photo: { field: Field; path: string; current: string } | null;
  onClose: () => void;
  onChoose: (path: string, photo: string) => void;
}) {
  return (
    <Dialog open={photo !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        // On a phone: a panel that slides up from the bottom, easy to reach with a thumb.
        className="max-h-[85svh] overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:data-[state=open]:zoom-in-100 max-sm:data-[state=open]:slide-in-from-bottom-10"
      >
        <DialogHeader>
          <DialogTitle>{t("Replace photo")}</DialogTitle>
          <DialogDescription>{t("The new photo comes in the same place, in the style of your website.")}</DialogDescription>
        </DialogHeader>
        {photo && (
          <PhotoChoices
            field={photo.field}
            current={photo.current}
            onChoose={(chosen) => onChoose(photo.path, chosen)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
