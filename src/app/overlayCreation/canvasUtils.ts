/**
 * Util-Functions to work with the HTML5 - Canvas.
 */
import { map } from "../map/mapboxConfig";
import mapLayerManager from "../mapData/mapLayerManager";
import { getViewportBounds } from "../map/mapboxUtils";
import Benchmark from "../../shared/benchmarking";
import "../vendors/fast-gauss-blur.js";

export function clearCanvasPart(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  width: number,
  height: number
): void {
  ctx.clearRect(px, py, width, height);
}

const overlaySourceID = "overlaySource";
const overlayLayerID = "overlay";

export function addCanvasOverlay(canvas: HTMLCanvasElement, opacity: number): void {
  const viewportBounds = getViewportBounds();

  //mapLayerManager.removeAllLayersForSource(overlaySourceID);
  //mapLayerManager.removeCanvasLayer(overlayLayerID);

  if (map.getSource(overlaySourceID)) {
    mapLayerManager.removeCanvasSource(overlaySourceID);
  }
  mapLayerManager.addNewCanvasSource(overlaySourceID, canvas, viewportBounds);

  //show the source data on the map
  mapLayerManager.addCanvasLayer(overlaySourceID, overlayLayerID, opacity);
}

export async function readImageFromCanvas(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    //! toBlob() is way more performant than toDataUrl (because the latter is synchronous) and needs less memory
    canvas.toBlob(function (blob) {
      let newImg = document.createElement("img");
      const url = URL.createObjectURL(blob);

      newImg.onload = () => {
        resolve(newImg);
        // no longer need to read the blob so it's revoked
        URL.revokeObjectURL(url);

        newImg.remove(); //remove from dom so it can be garbage-collected
        newImg.onload = null;
        //@ts-expect-error
        newImg = null;
      };
      newImg.onerror = (error): void => reject(error);

      //* setting the source should ALWAYS be done after setting the event listener!
      newImg.src = url;
    });
  });
}

const overlayOpacity = 0.7;

export function makeAlphaMask(canvas: HTMLCanvasElement): any {
  const c = document.createElement("canvas");
  c.width = map.getCanvas().clientWidth;
  c.height = map.getCanvas().clientHeight;
  const context = c.getContext("2d");
  if (!context) {
    console.warn("no 2d context in make alpha mask");
    return;
  }

  Benchmark.startMeasure("create alpha mask");

  context.drawImage(canvas, 0, 0);

  const imageData = context.getImageData(0, 0, c.width, c.height);

  /*
  // taken from http://jsfiddle.net/andrewjbaker/Fnx2w/
  const buf = new ArrayBuffer(imageData.data.length);
  const buf8 = new Uint8ClampedArray(buf);
  const buf32 = new Uint32Array(buf);
  
  const color = 0;
  for (let pixel = 0; pixel < buf32.length; pixel++) {
    const alpha = 255 - imageData.data[pixel * 64];
    buf32[pixel] = (alpha << 24) | (color << 16) | (color << 8) | color;
  }
  imageData.data.set(buf8);
  */

  const data = imageData.data;
  let i = 0;
  while (i < data.length) {
    const alpha = 255 - data[i]; //in this matte, white = fully transparent
    data[i] = data[i + 1] = data[i + 2] = 0; // clear matte to black
    data[i + 3] = alpha; // set alpha
    i += 4; // next pixel
  }

  context.putImageData(imageData, 0, 0);
  Benchmark.stopMeasure("create alpha mask");

  Benchmark.startMeasure("add canvas layer to map");
  //* add canvas with opacity 0.7 (i.e. 70% overlay, 30% map background) which makes the overlay clearly visible
  //* even for lighter grey but still allows the user to see the map background everywhere
  addCanvasOverlay(c, overlayOpacity);
  Benchmark.stopMeasure("add canvas layer to map");
}

// function taken from previous bachelor thesis from Julien Wachter
export function fastGaußBlur(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  Benchmark.startMeasure("fastgaussblur");
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const redChannel = [];

  for (let i = 0; i < imgData.data.length; i += 4) {
    redChannel.push(imgData.data[i]);
  }

  const blurredRedChannel: any[] = [];

  const size = 25;

  //@ts-expect-error
  FastGaussBlur.apply(redChannel, blurredRedChannel, canvas.width, canvas.height, size);

  for (let i = 0; i < imgData.data.length; i += 4) {
    const colorValue = blurredRedChannel[i / 4];
    imgData.data[i] = colorValue;
    imgData.data[i + 1] = colorValue;
    imgData.data[i + 2] = colorValue;
  }

  ctx.putImageData(imgData, 0, 0);
  Benchmark.stopMeasure("fastgaussblur");
}
