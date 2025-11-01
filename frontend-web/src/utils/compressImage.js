export async function compressImage(file, { maxKB = 400, maxW = 1280, maxH = 1280 } = {}) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width, maxH / bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);

  let q = 0.92, blob;
  do {
    blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", q));
    q -= 0.05;
  } while (blob.size/1024 > maxKB && q > 0.4);

  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}
