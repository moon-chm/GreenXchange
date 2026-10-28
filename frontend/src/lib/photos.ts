export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export function validatePhoto(file: { size: number; type: string }): string | null {
  if (!file.size) return "The photo is empty. Please take another photo.";
  if (file.size > MAX_PHOTO_BYTES) return "The photo must be 10 MB or smaller.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Please use a JPEG, PNG or WebP photo.";
  }
  return null;
}
