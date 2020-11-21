import * as twgl from "twgl.js";
import Benchmark from "../../shared/benchmarking";
import type { FilterLayer } from "../mapData/filterLayer";
import { applyGaussianBlur, setupGaussianBlurFilter } from "../webgl/gaussianBlurFilter";
import { combineOverlayFragmentShader, defaultVertexShader } from "../webgl/shaders";
import * as webglUtils from "../webgl/webglUtils";
import { fastGaußBlur, makeAlphaMask as applyAlphaMask, readImageFromCanvas } from "./canvasUtils";
import { map } from "../map/mapboxConfig";
import { metersInPixel } from "../map/mapboxUtils";
import { handleWebglInitError, showSnackbar, SnackbarType } from "../utils";
import { init } from "../main";
//import WebWorker from "worker-loader!../worker";

// the number of textures to combine
let textureCount;

class CanvasRenderer {
  //2D canvas api
  private overlayCanvas: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  // webgl resources
  private glCtx!: WebGL2RenderingContext | WebGLRenderingContext;
  private glProgram!: WebGLProgram;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;

  // others
  private weights: number[] = [];
  allTextures: HTMLImageElement[] = [];

  constructor() {
    const canvas = document.querySelector("#texture_canvas") as HTMLCanvasElement;
    canvas.width = map.getCanvas().clientWidth;
    canvas.height = map.getCanvas().clientHeight;

    this.overlayCanvas = canvas;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("No 2d context in canvasRenderer available!");
    }
    this.ctx = context;

    // setup the webgl code for the gaussian blur filter
    //setupGaussianBlurFilter();
  }

  /**
   * Draws all polygons for the given filter on a canvas and applies a blur effect.
   * @param mapLayer the current filter layer, e.g. one for park, restaurant, etc.
   */
  async renderPolygons(mapLayer: FilterLayer): Promise<any> {
    // clear the canvas
    this.ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    this.weights.push(mapLayer.Relevance);

    /*
    const pixelDist = metersInPixel(mapLayer.Distance, map.getCenter().lat, map.getZoom());
    console.log("PixelDist: ", pixelDist);

    let blurStrength;
    if (pixelDist > 100) {
      blurStrength = pixelDist / 10;
    } else if (pixelDist > 20) {
      blurStrength = pixelDist / 4;
    } else {
      blurStrength = 7;
    }
    console.warn("blurStrength: ", blurStrength);

    // apply a "feather"/blur - effect to everything that is drawn on the canvas from now on
    this.ctx.filter = `blur(${blurStrength}px)`;
    */
    //TODO a good function to bring the pixelDistance in relation to the blur size is still needed!
    //TODO -> should probably have an upper and lower bound (?) and needs to rise quite slow
    this.ctx.filter = "blur(7px)";

    if (mapLayer.Wanted) {
      //fill canvas black initially
      this.ctx.fillStyle = "rgba(0.0, 0.0, 0.0, 1.0)";
      this.ctx.fillRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

      // fill polygons white, fully opaque
      this.ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
    } else {
      //fill canvas white initially
      this.ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
      this.ctx.fillRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

      // fill polygons black, fully opaque
      this.ctx.fillStyle = "rgba(0.0, 0.0, 0.0, 1.0)";
    }

    Benchmark.startMeasure("render all polygons of one layer");

    for (const polygon of mapLayer.Points) {
      const startPoint = polygon[0];
      if (!startPoint) {
        continue;
      }

      this.ctx.beginPath();
      this.ctx.moveTo(startPoint.x, startPoint.y);

      // draw the polygon
      for (let index = 1; index < polygon.length; index += 1) {
        this.ctx.lineTo(polygon[index].x, polygon[index].y);
      }
      this.ctx.closePath();

      this.ctx.fill("evenodd");
    }

    console.warn("constant canvas blur applied!");
    Benchmark.stopMeasure("render all polygons of one layer");

    /*
    const img = await readImageFromCanvas(this.overlayCanvas);

    Benchmark.startMeasure("blur Image in Webgl");
    const blurredCanvas = applyGaussianBlur(img, pixelDist);
    Benchmark.stopMeasure("blur Image in Webgl");

    // draw blurred canvas on the overlayCanvas
    this.ctx.drawImage(blurredCanvas, 0, 0);
    */

    /*
    Benchmark.startMeasure("fastgaussblur");
    fastGaußBlur(this.ctx, this.overlayCanvas);
    Benchmark.stopMeasure("fastgaussblur");
    */

    const blurredImage = await readImageFromCanvas(this.overlayCanvas);
    // save the blurred image for this layer
    this.allTextures.push(blurredImage);
  }

  /**
   * * Utility-Function to normalize all importance scores for all textures so they add up to 1
   * * but at the same time keep their relative importance to the other layers
   */
  normalizeWeights(textureCount: number): void {
    let sum = 0;
    for (let i = 0; i < textureCount; i++) {
      sum += this.weights[i];
    }
    // calculate a normalizer value so that all values will eventually sum up to 1
    const normalizer = 1 / sum;
    // normalize all values
    for (let index = 0; index < this.weights.length; index++) {
      this.weights[index] *= normalizer;
    }
  }

  /**
   * Combines the given image textures into one overlay canvas that can be used as a canvas layer for mapbox.
   * @param textureLayers the image elements that need to be comined for the final overlay
   */
  combineOverlays(textureLayers: HTMLImageElement[]): any {
    if (textureLayers.length === 0) {
      console.log("TextureLayers are empty! Overlay can't be created!");
      return;
    }

    // create an in-memory canvas and set width and height to fill the whole map on screen
    const canvas = document.createElement("canvas");
    canvas.width = map.getCanvas().clientWidth;
    canvas.height = map.getCanvas().clientHeight;

    //handle webgl context loss
    canvas.addEventListener(
      "webglcontextlost",
      (event) => {
        console.log("Webgl Context lost");
        event.preventDefault();
        showSnackbar(
          "Webgl Context Lost! Restarting application necessary!",
          SnackbarType.ERROR,
          4000
        );
        init();
      },
      false
    );
    canvas.addEventListener(
      "webglcontextrestored",
      () => {
        //this.combineOverlays(textureLayers);
        console.log("context restored! reloadin application...");
        init();
      },
      false
    );

    //options: {stencil: true, antialias: true, premultipliedAlpha: false, alpha: false, preserveDrawingBuffer: false});
    const gl = canvas.getContext("webgl");
    if (!gl) {
      handleWebglInitError();
      return;
    }

    this.glCtx = gl;

    // set the number of texture to use
    textureCount = textureLayers.length;
    //* Add the textureCount to the top of the fragment shader so it can dynamically use the
    //* correct number of textures. The shader MUST be created (or updated) AFTER the textureCount
    //* variable has been set as js/ts won't update the string itself when textureCount changes later.
    const fragmentSource =
      `#define NUM_TEXTURES ${textureCount}\n` + combineOverlayFragmentShader();
    const vertexSource = defaultVertexShader();

    // create and link program
    const program = twgl.createProgramFromSources(gl, [vertexSource, fragmentSource]);

    // lookup attributes
    const positionLocation = gl.getAttribLocation(program, "a_position");
    const texcoordLocation = gl.getAttribLocation(program, "a_texCoord");

    // lookup uniforms
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const weightsLoc = gl.getUniformLocation(program, "u_weights[0]");
    // lookup the location for the textures
    const textureLoc = gl.getUniformLocation(program, "u_textures[0]");

    // setup buffers
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    //* this works only because all images have the same size!
    webglUtils.setRectangle(gl, 0, 0, textureLayers[0].width, textureLayers[0].height);

    // texture coordinates are always in the space between 0.0 and 1.0
    const texcoordBuffer = webglUtils.createBuffer(
      gl,
      new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0])
    );

    // setup textures
    const textures = [];
    for (let ii = 0; ii < textureLayers.length; ++ii) {
      const texture = webglUtils.createTexture(gl, textureLayers[ii], ii, gl.NEAREST);
      textures.push(texture);
    }

    // ##### drawing code: #####

    webglUtils.setupCanvasForDrawing(gl, [0.0, 0.0, 0.0, 0.0]);

    gl.useProgram(program);

    //gl.disable(gl.DEPTH_TEST);

    // Turn on the position attribute
    webglUtils.bindAttribute(gl, positionBuffer, positionLocation);
    // Turn on the texcoord attribute
    webglUtils.bindAttribute(gl, texcoordBuffer, texcoordLocation);

    // set the resolution
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);

    this.normalizeWeights(textureLayers.length);
    gl.uniform1fv(weightsLoc, this.weights);

    // Tell the shader to use texture units 0 to textureCount - 1
    gl.uniform1iv(textureLoc, Array.from(Array(textureCount).keys())); //uniform variable location and texture Index (or array of indices)

    // see https://stackoverflow.com/questions/39341564/webgl-how-to-correctly-blend-alpha-channel-png/
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); //* this is the correct one for pre-multiplied alpha
    //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); //* this is the correct one for un-premultiplied alpha

    const vertexCount = 6; // 2 triangles for a rectangle
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);

    gl.disable(gl.BLEND);

    this.ctx.drawImage(canvas, 0, 0);

    //cleanup and delete webgl resources
    this.cleanupResources();
  }

  createOverlay(textures: HTMLImageElement[]): HTMLCanvasElement {
    Benchmark.startMeasure("combining textures");
    this.combineOverlays(textures);
    Benchmark.stopMeasure("combining textures");

    return this.overlayCanvas;
  }

  /**
   * Cleanup webgl resources to prevent memory leaks,
   * see https://stackoverflow.com/questions/23598471/how-do-i-clean-up-and-unload-a-webgl-canvas-context-from-gpu-after-use
   */
  cleanupResources(): void {
    // desallocate memory and free resources to avoid memory leak issues
    const numTextureUnits = this.glCtx.getParameter(this.glCtx.MAX_TEXTURE_IMAGE_UNITS);
    for (let unit = 0; unit < numTextureUnits; ++unit) {
      this.glCtx.activeTexture(this.glCtx.TEXTURE0 + unit);
      this.glCtx.bindTexture(this.glCtx.TEXTURE_2D, null);
      this.glCtx.bindTexture(this.glCtx.TEXTURE_CUBE_MAP, null);
    }

    this.glCtx.bindBuffer(this.glCtx.ARRAY_BUFFER, null);
    this.glCtx.bindBuffer(this.glCtx.ELEMENT_ARRAY_BUFFER, null);
    this.glCtx.bindRenderbuffer(this.glCtx.RENDERBUFFER, null);
    this.glCtx.bindFramebuffer(this.glCtx.FRAMEBUFFER, null);

    // Delete all your resources
    this.glCtx.deleteProgram(this.glProgram);
    this.glCtx.deleteBuffer(this.positionBuffer);
    this.glCtx.deleteBuffer(this.texCoordBuffer);

    //this.glCtx.getExtension("WEBGL_lose_context")?.loseContext();
    //this.glCtx.getExtension("WEBGL_lose_context")?.restoreContext();
  }

  /**
   * Reset weights and textures for next draw.
   */
  reset(): void {
    this.weights = [];
    this.allTextures.forEach((texture) => {
      texture.remove();
    });
    // clear images by setting its length to 0
    this.allTextures.length = 0;
  }
}

const renderer = new CanvasRenderer();

export async function createOverlay(data: FilterLayer[]): Promise<void> {
  Benchmark.startMeasure("creating canvas overlay overall");

  Benchmark.startMeasure("render all Polygons");
  const allRenderProcesses = data.map((layer: FilterLayer) => renderer.renderPolygons(layer));
  await Promise.all(allRenderProcesses);
  Benchmark.stopMeasure("render all Polygons");

  //console.log("Current number of saved textures in canvasRenderer: ", renderer.allTextures.length);

  const resultCanvas = renderer.createOverlay(renderer.allTextures);
  Benchmark.stopMeasure("creating canvas overlay overall");

  applyAlphaMask(resultCanvas);

  //Reset state for next rendering
  renderer.reset();
  //console.log("finished blurring and compositing");
}
