import type { MetadataRoute } from "next";
import logo from "./logo.png";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Financial Control Tower",
    short_name: "Control Tower",
    description: "See financial problems before they become losses.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f8f9",
    theme_color: "#1a4fd6",
    icons: [
      {
        src: logo.src,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: logo.src,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
