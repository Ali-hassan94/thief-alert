export type Face = { name: string; d: number[] };
const KEY = "family_faces";
let fa: any = null;

async function load() {
  if (fa) return fa;
  // @ts-ignore
  const m = await import("@vladmandic/face-api/dist/face-api.esm.js");
  await m.nets.tinyFaceDetector.loadFromUri("/models");
  await m.nets.faceLandmark68Net.loadFromUri("/models");
  await m.nets.faceRecognitionNet.loadFromUri("/models");
  fa = m;
  return fa;
}

export function getFaces(): Face[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function saveFaces(f: Face[]) {
  localStorage.setItem(KEY, JSON.stringify(f));
}

export async function descriptorFrom(el: HTMLImageElement | HTMLVideoElement): Promise<number[] | null> {
  const m = await load();
  const r = await m
    .detectSingleFace(el, new m.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return r ? Array.from(r.descriptor as Float32Array) : null;
}

function dist(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

// Ghar ka fard mila to uska naam, warna null (face na dikhe to bhi null: alert chalega)
export async function familyMatch(video: HTMLVideoElement): Promise<string | null> {
  const faces = getFaces();
  if (faces.length === 0) return null;
  try {
    const d = await descriptorFrom(video);
    if (!d) return null;
    for (const f of faces) if (dist(d, f.d) < 0.5) return f.name;
  } catch {}
  return null;
}