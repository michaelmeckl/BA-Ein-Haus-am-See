/**
 * Util-Functions to work with the HTML5 - Canvas.
 */
import { map } from "./mapboxConfig";
import mapLayerManager from "../mapData/mapLayerManager";
import { getViewportBounds } from "./mapboxUtils";
//import "../vendors/fast-gauss-blur.js";

export function clearCanvasPart(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  width: number,
  height: number
): void {
  ctx.clearRect(px, py, width, height);
}

//TODO is it possible to save this source in the class and only use updateCanvas(options: ImageSourceOptions)
//TODO  to update the canvas instead of rerendering the whole source
export function addCanvasOverlay(canvas: HTMLCanvasElement, opacity: number): void {
  const viewportBounds = getViewportBounds();

  mapLayerManager.removeAllLayersForSource("canvasSource");

  if (map.getSource("canvasSource")) {
    map.removeSource("canvasSource");
  }

  map.addSource("canvasSource", {
    type: "canvas",
    canvas: canvas,
    animate: false, //static canvas for performance reasons
    coordinates: viewportBounds,
  });

  map.addLayer({
    id: "overlay",
    source: "canvasSource",
    type: "raster",
    paint: {
      "raster-opacity": opacity,
    },
  });
}

export async function readImageFromCanvas(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  const image = new Image();
  return new Promise((resolve, reject) => {
    image.onload = (): void => {
      image.width = canvas.clientWidth; //use clientWidth and Height so the image fits the current screen size
      image.height = canvas.clientHeight;

      resolve(image);

      //cleanup
      /*
      image.onload = null;
      image = null;
      */
    };
    image.onerror = (error): void => reject(error);

    //* setting the source should ALWAYS be done after setting the event listener!
    image.src = canvas.toDataURL();
  });
}

const overlayOpacity = 0.7;

export function makeAlphaMask(canvas: HTMLCanvasElement): any {
  console.warn("in make alpha mask");

  const c = document.createElement("canvas");
  c.width = map.getCanvas().clientWidth;
  c.height = map.getCanvas().clientHeight;
  const context = c.getContext("2d");
  if (!context) {
    console.warn("no 2d context");
    return;
  }

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

  //* add canvas with opacity 0.7 (i.e. 70% overlay, 30% map background) which makes the overlay clearly visible
  //* even for lighter grey but still allows the user to see the map background everywhere
  addCanvasOverlay(c, overlayOpacity);
}

// function taken from previous bachelor thesis from Julien Wachter
/*
export function fastGaußBlur(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const redChannel = [];

  for (let i = 0; i < imgData.data.length; i += 4) {
    redChannel.push(imgData.data[i]);
  }

  const blurredRedChannel: any[] = [];

  const size = 25;
  console.time("fastgaussblur");
  //@ts-expect-error
  FastGaussBlur.apply(redChannel, blurredRedChannel, canvas.width, canvas.height, size);
  console.timeEnd("fastgaussblur");

  for (let i = 0; i < imgData.data.length; i += 4) {
    const colorValue = blurredRedChannel[i / 4];
    imgData.data[i] = colorValue;
    imgData.data[i + 1] = colorValue;
    imgData.data[i + 2] = colorValue;
  }

  ctx.putImageData(imgData, 0, 0);
}
*/
