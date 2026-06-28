import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "See Our Baby, AI Future Baby Generator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social-share preview, makes shared links (the AITA/organic angle)
// look good, which lifts click-through = free traffic.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ffe4e6, #fbcfe8)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 130 }}>👶</div>
        <div style={{ fontSize: 68, fontWeight: 800, color: "#9f1239", marginTop: 8 }}>See Our Baby</div>
        <div style={{ fontSize: 38, color: "#7c2d3b", marginTop: 6 }}>What will your baby look like?</div>
        <div style={{ fontSize: 26, color: "#9d174d", marginTop: 22 }}>AI baby generator · just for fun</div>
      </div>
    ),
    { ...size }
  );
}
