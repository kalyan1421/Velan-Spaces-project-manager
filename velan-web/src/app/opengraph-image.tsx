import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

// Branded share image for the whole site. It lives at the root segment (not in
// the (marketing) group) so its URL is a stable "/opengraph-image" that page
// metadata can reference explicitly. Generated once at build time.

export const alt = "Velan Spaces — interior design and construction";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const logoData = await readFile(join(process.cwd(), "public/brand/logo.png"), "base64");
const logoSrc = `data:image/png;base64,${logoData}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#F8F9FC",
          padding: "0 88px",
          gap: 72,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 400,
            height: 400,
            borderRadius: 48,
            background: "#FFFFFF",
            border: "2px solid #E6E8EF",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <img src={logoSrc} width={520} height={520} alt="" style={{ objectFit: "cover" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", width: 72, height: 8, borderRadius: 4, background: "#FFB347" }} />
          <div
            style={{
              display: "flex",
              marginTop: 36,
              fontSize: 92,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: "#1A1A2E",
            }}
          >
            Velan Spaces
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 40, lineHeight: 1.25, color: "#3B3B52" }}>
            Interior design and construction
          </div>
          <div style={{ display: "flex", marginTop: 44, fontSize: 28, lineHeight: 1.35, color: "#4B4B60" }}>
            Itemised quotations. Progress you can follow in our app.
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: -90,
            top: -90,
            width: 260,
            height: 260,
            borderRadius: 9999,
            background: "#FFE566",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
