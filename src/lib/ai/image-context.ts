import { createHash } from "node:crypto";
import type { InputImage } from "./provider";

/** Keep image bytes out of model text. Tokens are resolved only inside this run. */
export function imageContext(images: InputImage[] = []) {
  const values = new Map<string,string>();
  function token(dataUrl: string) {
    const key = `__IDAEVIA_IMAGE_${createHash("sha256").update(dataUrl).digest("hex").slice(0,24)}__`;
    values.set(key,dataUrl); return key;
  }
  const attachments = images.map((image,index) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(image.mediaType) || !image.data || image.data.length>6_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)) throw new Error("Invalid attached image.");
    return `Image ${index+1}: ${token(`data:${image.mediaType};base64,${image.data}`)}`;
  });
  return {
    compact: (source: string) => source.replace(/data:image\/(?:png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/]+=*/g,token),
    restore: (source: string) => source.replace(/__IDAEVIA_IMAGE_[A-Za-z0-9_]+__/g,key => {
      const value=values.get(key); if(!value)throw new Error("Model did not return a known image reference."); return value;
    }),
    instructions: attachments.length ? `ATTACHED IMAGES, in the same order as the vision inputs:\n${attachments.join("\n")}\nFor an uploaded logo/photo/image that the user wants placed in the project, use its exact token as the quoted src/URL value. The platform replaces it with the real image bytes when saving; never invent an upload URL, redraw the image or use a stock substitute. For a screenshot used as a design reference, recreate only the requested part instead of embedding the screenshot. Preserve the rest of an existing project. If the intended placement is missing or ambiguous, ask one focused question. Existing __IDAEVIA_IMAGE_...__ tokens are already saved assets: preserve them unchanged unless replacing that image.` : "Existing __IDAEVIA_IMAGE_...__ values are saved image URLs represented by stable tokens. Keep them unchanged unless the request replaces that image. Never invent new image tokens.",
  };
}
