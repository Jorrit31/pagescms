import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

// "Add to home screen": the editor opens like an app, under the brand's name
// and icon (public/images/app-icon-*.png, made from app/icon.svg).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.description,
    lang: "nl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6F7F9",
    theme_color: "#F6F7F9",
    icons: [
      { src: "/images/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/images/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/images/app-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
