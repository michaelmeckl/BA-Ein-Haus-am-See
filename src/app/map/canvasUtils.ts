/**
 * Util-Functions to work with the HTML5 - Canvas.
 */
import { map } from "./mapboxConfig";
import Benchmark from "../../shared/benchmarking";

export function addImageOverlay(image: HTMLImageElement) {
  // wait till map is loaded, then add a imageSource (or a canvas source alternatively)
  if (!map.loaded()) {
    return;
  }

  map.addSource("myImageSource", {
    type: "image",
    url: image.src,
    /*
      coordinates: [
        [-80.425, 46.437],
        [-71.516, 46.437],
        [-71.516, 37.936],
        [-80.425, 37.936],
      ],*/
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

export function clearCanvasRect(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
}

// vgl. https://stackoverflow.com/questions/13422917/get-elements-from-canvas
export function drawImageToHiddenCanvas(ctx: CanvasRenderingContext2D) {
  // make a hidden canvas:
  var hiddenCanvas = document.createElement("canvas");
  var hCtx = hiddenCanvas.getContext("2d");
  // First you round the corners permanently by making a clipping region:
  ctx.roundedRect(etc);
  ctx.clip();
  //then a user draws something onto HIDDEN canvas, like an image
  // This image never gets its corners cut
  hCtx.drawImage(myImage, 0, 0);
  // Then you draw the hidden canvas onto your normal one:
  ctx.drawImage(hiddenCanvas, 0, 0);
}

export function addCanvasOverlay(canvas: HTMLCanvasElement): void {
  /*
  // wait till map is loaded, then add a imageSource (or a canvas source alternatively)
  if (!map.loaded()) {
    return;
  }
  */

  const bounds = map.getBounds();
  const viewportBounds = [
    bounds.getNorthWest().toArray(),
    bounds.getNorthEast().toArray(),
    bounds.getSouthEast().toArray(),
    bounds.getSouthWest().toArray(),
  ];

  map.addSource("canvasSource", {
    type: "canvas",
    canvas: canvas,
    animate: false, // TODO turn off for better performance if not needed!
    coordinates: viewportBounds,
  });

  map.addLayer({
    id: "overlay",
    source: "canvasSource",
    type: "raster",
    paint: {
      "raster-opacity": 0.85,
    },
  });
}

export function addBlurredImage(img: HTMLImageElement, canvas: HTMLCanvasElement): void {
  Benchmark.startMeasure("addingImageOverlay");
  img.src = canvas.toDataURL();

  const bounds = map.getBounds();
  const viewportBounds = [
    bounds.getNorthWest().toArray(),
    bounds.getNorthEast().toArray(),
    bounds.getSouthEast().toArray(),
    bounds.getSouthWest().toArray(),
  ];
  //console.log("ViewportBounds: ", viewportBounds);

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
