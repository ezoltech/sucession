const LOCAL_RASTER = /^\/images\/(?!optimized\/)([^?#]+)\.(jpe?g|png)([?#].*)?$/i;

export function optimizedImageUrl(src, width = 1024) {
  if (typeof src !== "string") return src;
  const match = src.match(LOCAL_RASTER);
  if (!match) return src;
  return `/images/optimized/${match[1]}-${width}.webp${match[3] ?? ""}`;
}
