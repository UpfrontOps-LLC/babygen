import { test, expect } from "@playwright/test";

// The live checkout hang was caused by uploading raw multi-MB photos. The fix
// compresses photos in the browser before upload. This tests that function
// (exposed as window.__shrinkImage) on a large generated image.
test("shrinkImage downscales large photos to <=1600px and far fewer bytes", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const fn = (window as unknown as { __shrinkImage?: (f: File) => Promise<File> }).__shrinkImage;
    if (!fn) return { error: "no __shrinkImage exposed" };
    const c = document.createElement("canvas");
    c.width = 3000; c.height = 2000;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#c08552"; ctx.fillRect(0, 0, 3000, 2000);
    ctx.fillStyle = "#fff"; ctx.fillRect(500, 500, 800, 800);
    const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
    const big = new File([blob], "big.png", { type: "image/png" });
    const small = await fn(big);
    const bmp = await createImageBitmap(small);
    return { error: undefined as string | undefined, maxDim: Math.max(bmp.width, bmp.height), bytes: small.size, origBytes: big.size };
  });
  expect(r.error).toBeUndefined();
  expect(r.maxDim).toBeLessThanOrEqual(1600);
  expect(r.bytes).toBeLessThan(r.origBytes);
});
