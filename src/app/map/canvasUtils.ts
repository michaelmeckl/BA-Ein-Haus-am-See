/**
 * Util-Functions to work with the HTML5 - Canvas.
 */
import { map } from "./mapboxConfig";
import Benchmark from "../../shared/benchmarking";
import mapLayerManager from "./mapLayerManager";
import type { CanvasSource, Point } from "mapbox-gl";
import { getViewportBounds } from "./mapboxUtils";

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

export function testCanvasBlurring(allPoints: any[]): void {
  const canvas = map.getCanvas();
  const context = canvas.getContext("2d");

  if (!context) {
    console.log("No context available!");
    return;
  }

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  //context.globalCompositeOperation = "source-over";
  //context.globalCompositeOperation = "xor"; //TODO funtioniert so nicht

  // clear canvas
  context.clearRect(0, 0, canvas.width, canvas.height);

  /*
  context.fillStyle = "black";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "white";
  context.strokeStyle = "white";
  */
  context.fillStyle = "rgba(60, 60, 60, 0.4)";
  context.strokeStyle = "rgba(150, 150, 150, 0.9)";
  //context.fillStyle = "white";
  //context.strokeStyle = "white";

  //TODO blurCanvas(canvas, 9);

  Benchmark.startMeasure(`Rendering ${allPoints.length} Circles took `);
  for (const point of allPoints) {
    //draw a circle
    drawCircle(context, point, 30);
  }
  Benchmark.stopMeasure(`Rendering ${allPoints.length} Circles took `);
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

export function addCanvasOverlay(canvas: HTMLCanvasElement): void {
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
      "raster-opacity": 0.8,
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
