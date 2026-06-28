import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Branded favicon: 👶 on a rose circle. Replaces the default Next.js favicon.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 22,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f43f5e",
          borderRadius: "50%",
        }}
      >
        👶
      </div>
    ),
    { ...size },
  );
}
