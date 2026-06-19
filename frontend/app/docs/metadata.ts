/**
 * Shared metadata for all /docs/* pages.
 * Import this in individual page files that need per-page overrides,
 * or use it as the base for generateMetadata().
 *
 * Docs pages ARE indexable on production — they are public marketing content.
 */
import type { Metadata } from "next";

export const docsBaseMetadata: Metadata = {
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: "Zendbx",
  },
};

export function docsPageMetadata(
  title: string,
  description: string,
  path: string
): Metadata {
  const url = `https://zendbx.in${path}`;
  return {
    ...docsBaseMetadata,
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      ...docsBaseMetadata.openGraph,
      title,
      description,
      url,
    },
  };
}
