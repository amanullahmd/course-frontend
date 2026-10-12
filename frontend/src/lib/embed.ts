export type EmbedProvider = "youtube" | "vimeo" | "google" | "h5p" | "learningapps" | "generic";

export interface EmbedInfo {
  provider: EmbedProvider;
  embedUrl: string | null;
  label: string;
}

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Returns an iframe-able URL for known providers, otherwise `embedUrl: null`. */
export function getEmbedInfo(rawUrl: string | null | undefined): EmbedInfo | null {
  if (!rawUrl) return null;
  const url = parse(rawUrl.trim());
  if (!url || !/^https?:$/.test(url.protocol)) return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0] || null;
    else if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
      id = match?.[1] ?? null;
    }
    return {
      provider: "youtube",
      embedUrl: id ? `https://www.youtube-nocookie.com/embed/${id}` : null,
      label: "YouTube",
    };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const match = url.pathname.match(/(\d{6,})/);
    return {
      provider: "vimeo",
      embedUrl: match ? `https://player.vimeo.com/video/${match[1]}` : null,
      label: "Vimeo",
    };
  }
  if (host === "docs.google.com" || host === "drive.google.com") {
    const embedUrl = url.toString().replace(/\/(edit|view)(\?.*)?$/, "/preview");
    return { provider: "google", embedUrl, label: "Google" };
  }
  if (host.endsWith("h5p.com") || host === "h5p.org") {
    return { provider: "h5p", embedUrl: url.toString(), label: "H5P" };
  }
  if (host === "learningapps.org") {
    return { provider: "learningapps", embedUrl: url.toString(), label: "LearningApps" };
  }
  return { provider: "generic", embedUrl: null, label: host };
}

export function isVideoEmbed(rawUrl: string | null | undefined): boolean {
  const info = getEmbedInfo(rawUrl);
  return info?.provider === "youtube" || info?.provider === "vimeo";
}
