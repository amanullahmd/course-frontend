import { api, uploadMedia } from "./client";
import type { MediaDto } from "./types";

export const mediaApi = {
  upload: uploadMedia,
  get: (id: string) => api.get<MediaDto>(`/api/media/${id}`),
  remove: (id: string) => api.delete(`/api/media/${id}`),
};

/** Signed media URL that forces a download (Content-Disposition: attachment). */
export function downloadUrl(media: Pick<MediaDto, "url">): string {
  try {
    const url = new URL(media.url);
    url.searchParams.set("download", "true");
    return url.toString();
  } catch {
    return media.url;
  }
}
