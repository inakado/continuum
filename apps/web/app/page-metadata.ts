import type { Metadata } from "next";

const APP_NAME = "Континуум";

export const buildPageMetadata = (title: string, description: string): Metadata => ({
  title: `${title} | ${APP_NAME}`,
  description,
});
