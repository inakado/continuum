export const resolveAuthBaseUrl = (apiBaseUrl: string) =>
  `${apiBaseUrl.replace(/\/+$/, '')}/auth`;
