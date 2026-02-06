const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const isYoutubeHost = (host: string) => {
  const normalized = host.toLowerCase();
  return YOUTUBE_HOSTS.has(normalized);
};

const isSafeProtocol = (protocol: string) => protocol === "https:" || protocol === "http:";

export const toYouTubeEmbed = (rawUrl: string): string | null => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (!isSafeProtocol(url.protocol)) return null;
  if (!isYoutubeHost(url.hostname)) return null;

  // youtu.be/<id>
  if (url.hostname.toLowerCase().includes("youtu.be")) {
    const id = url.pathname.replace("/", "").trim();
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
  }

  // youtube.com/watch?v=<id>
  const v = url.searchParams.get("v");
  if (v) {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v)}`;
  }

  // youtube.com/embed/<id>
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "embed" && parts[1]) {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(parts[1])}`;
  }

  return null;
};

