const EARTH_M = 40075016.686;
export const metresPerPixel = (lat: number, zoom: number) => EARTH_M * Math.cos(lat * Math.PI / 180) / (256 * 2 ** zoom);
export const zoomForFrame = (lat: number, lengthM: number, widthPx: number) => Math.log2(EARTH_M * Math.cos(lat * Math.PI / 180) * Math.max(1, widthPx) / (256 * Math.max(1, lengthM)));
