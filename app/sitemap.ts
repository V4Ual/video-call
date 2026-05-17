import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://videochat.vishalsharma.dev",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}