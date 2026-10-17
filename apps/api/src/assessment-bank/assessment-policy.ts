export const assessmentPolicy = {
  zipBytes: 25 * 1024 * 1024,
  unpackedBytes: 80 * 1024 * 1024,
  fileBytes: 4 * 1024 * 1024,
  textBytes: 256 * 1024,
  files: 3000,
  imagePixels: 40_000_000,
  previewTtlMs: 30 * 60 * 1000,
  pageSize: 50,
} as const;
