/**
 * Util-Functions to work with the HTML5 - Canvas.
 */
import { map } from "./mapboxConfig";
import Benchmark from "../../shared/benchmarking";
import mapLayerManager from "./mapLayerManager";
import type { CanvasSource, Point } from "mapbox-gl";
import { getViewportBounds } from "./mapboxUtils";
import "../vendors/fast-gauss-blur.js";

function drawCircle(context: CanvasRenderingContext2D, point: Point, radius = 20): void {
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, 2 * Math.PI);
  //context.closePath();
  //context.fill();

  // evenodd determines the "insideness" of a point in the shape by drawing a ray from that point to infinity in
  //any direction and counting the number of path segments from the given shape that the ray crosses.
  //If this number is odd, the point is inside; if even, the point is outside.
  context.fill("evenodd");
  context.stroke();
}

//! Julien hat den auf den ganzen Canvas angewandt so weit ich weiß, nicht pro kreis, polygon etc.
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

export function addImageOverlay(image: HTMLImageElement) {
  // wait till map is loaded, then add a imageSource
  if (!map.loaded()) {
    return;
  }

  map.addSource("myImageSource", {
    type: "image",
    url: image.src,
  });

  map.addLayer({
    id: "overlay",
    source: "myImageSource",
    type: "raster",
    paint: {
      "raster-opacity": 0.85,
    },
  });
}

export function blurImage(image: HTMLImageElement, blurAmount: number) {
  image.style.filter = `blur(${blurAmount}px)`;
}

export function blurCanvas(canvas: HTMLCanvasElement, blurAmount: number) {
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.filter = `blur(${blurAmount}px)`;
    //TODO oder: ctx.shadowBlur = blurAmount;
  }
}

export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
}

export function addCanvasOverlay(canvas: HTMLCanvasElement, opacity: number): void {
  /*
  // wait till map is loaded, then add a imageSource (or a canvas source alternatively)
  if (!map.loaded()) {
    return;
  }
  */

  const viewportBounds = getViewportBounds();

  mapLayerManager.removeAllLayersForSource("canvasSource");

  if (map.getSource("canvasSource")) {
    map.removeSource("canvasSource");
  }

  map.addSource("canvasSource", {
    type: "canvas",
    canvas: canvas,
    animate: false,
    coordinates: viewportBounds,
  });

  map.addLayer({
    id: "overlay",
    source: "canvasSource",
    type: "raster",
    paint: {
      "raster-opacity": opacity,
      //TODO opacity auf 0.5 ändern? -> dann hätte das ganze Overlay (egal wie dunkel es ist)
      //TODO immer 0.5 alpha und man könnte die karte noch sehen
    },
  });
}

export function addBlurredImage(img: HTMLImageElement, canvas: HTMLCanvasElement): void {
  Benchmark.startMeasure("addingImageOverlay");
  img.src = canvas.toDataURL();
  const viewportBounds = getViewportBounds();

  img.onload = () => {
    map.addSource("canvasSource", {
      type: "image",
      coordinates: viewportBounds,
      url: img.src,
    });
    //TODO save this source in the class and only use updateImage(options: ImageSourceOptions): this;
    // to update the image instead of rerendering the whole source

    map.addLayer({
      id: "overlay",
      source: "canvasSource",
      type: "raster",
      paint: {
        "raster-opacity": 0.85,
        //"raster-resampling": "linear",
      },
    });

    Benchmark.stopMeasure("addingImageOverlay");
  };
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
      //@ts-expect-error
      image = null;
      */
    };
    image.onerror = (error): void => reject(error);

    //* setting the source should ALWAYS be done after setting the event listener!
    image.src = canvas.toDataURL();
  });
}

export function cloneCanvas(oldCanvas: HTMLCanvasElement): HTMLCanvasElement {
  //create a new canvas
  const newCanvas = document.createElement("canvas");
  const context = newCanvas.getContext("2d");

  //set dimensions
  newCanvas.width = oldCanvas.width;
  newCanvas.height = oldCanvas.height;

  //apply the old canvas to the new one
  context?.drawImage(oldCanvas, 0, 0);

  //return the new canvas
  return newCanvas;
}

export function invertCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.globalCompositeOperation = "difference";
  ctx.fillStyle = "rgba(255, 255, 255, 1)";
  ctx.beginPath();
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fill();

  readImageFromCanvas(canvas)
    .then((img) => {
      console.log("inverted image:");
      console.log(img.src);
    })
    .catch((err) => {
      console.error(err);
    });
}

function clearCanvasPart(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  width: number,
  height: number
): void {
  ctx.clearRect(px, py, width, height);
}

//copy from one channel to another
function assignChannel(imageData: any, channelTo: number, channelFrom: number): void {
  if (channelTo < 0 || channelTo > 3 || channelFrom < 0 || channelFrom > 3) {
    throw new Error("bad channel number");
  }
  if (channelTo === channelFrom) {
    return;
  }
  const px = imageData.data;
  for (let i = 0; i < px.length; i += 4) {
    px[i + channelTo] = px[i + channelFrom];
  }
}

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

  //context.globalCompositeOperation = "copy";

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
  addCanvasOverlay(c, 0.7);
}
