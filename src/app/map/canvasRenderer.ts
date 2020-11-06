import * as twgl from "twgl.js";
import Benchmark from "../../shared/benchmarking";
import type { FilterLayer } from "../mapData/filterLayer";
import { applyGaussianBlur, setupGaussianBlurFilter } from "../webgl/gaussianBlurFilter";
import { combineOverlayFragmentShader, defaultVertexShader } from "../webgl/shaders";
import * as webglUtils from "../webgl/webglUtils";
import { makeAlphaMask as applyAlphaMask, readImageFromCanvas } from "./canvasUtils";
import { map } from "./mapboxConfig";
import { metersInPixel } from "./mapboxUtils";

// the number of textures to combine
let textureCount;

//! to improve performance everything that doesn't change can be rendered to an offscreen canvas (in a web worker)
//! and on next render simply blitted onto the main canvas with c.getContext('2d').drawImage(offScreenCanvas, 0, 0);

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
    setupGaussianBlurFilter();
  }

  async renderPolygons(mapLayer: FilterLayer): Promise<any> {
    // clear the canvas
    this.ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    this.weights.push(mapLayer.Relevance);

    const pixelDist = metersInPixel(mapLayer.Distance, map.getCenter().lat, map.getZoom());
    console.log("Meter in pixel: ", pixelDist);

    console.log("Wanted: ", mapLayer.Wanted);

    // apply a "feather"/blur - effect to everything that is drawn on the canvas from now on
    //ctx.filter = "blur(32px)";

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

    Benchmark.startMeasure("render and blur all polygons of one layer");

    for (const polygon of mapLayer.Points) {
      const startPoint = polygon[0];
      this.ctx.beginPath();
      this.ctx.moveTo(startPoint.x, startPoint.y);

      // draw the polygon
      for (let index = 1; index < polygon.length; index += 1) {
        this.ctx.lineTo(polygon[index].x, polygon[index].y);
      }
      this.ctx.closePath();

      this.ctx.fill("evenodd");
    }

    Benchmark.stopMeasure("render and blur all polygons of one layer");

    const img = await readImageFromCanvas(this.overlayCanvas);

    //TODO: give user the option to specify if he wants blur and set in at the beginning of each renderOverlay
    //if(this.shouldShowAreas) { do blur ]
    Benchmark.startMeasure("blur Image in Webgl");
    const blurredCanvas = applyGaussianBlur(img, pixelDist);
    Benchmark.stopMeasure("blur Image in Webgl");

    // draw blurred canvas on the overlayCanvas
    this.ctx.drawImage(blurredCanvas, 0, 0);

    const blurredImage = await readImageFromCanvas(this.overlayCanvas);
    // save the blurred image for this layer
    this.allTextures.push(blurredImage);
  }

  combineOverlays(textureLayers: HTMLImageElement[]): any {
    if (textureLayers.length === 0) {
      console.warn("TextureLayers are empty! Overlay can't be created!");
      return;
    }

    // set the number of texture to use
    textureCount = textureLayers.length;
    //* Add the textureCount to the top of the fragment shader so it can dynamically use the
    //* correct number of textures. The shader MUST be created (or updated) AFTER the textureCount
    //* variable has been set as js/ts won't update the string itself when textureCount changes later.
    const fragmentSource =
      `#define NUM_TEXTURES ${textureCount}\n` + combineOverlayFragmentShader();
    const vertexSource = defaultVertexShader();

    // create an in-memory canvas and set width and height to fill the whole map on screen
    const canvas = document.createElement("canvas");
    canvas.width = map.getCanvas().clientWidth;
    canvas.height = map.getCanvas().clientHeight;

    //options: {stencil: true, antialias: true, premultipliedAlpha: false, alpha: false, preserveDrawingBuffer: false});
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      throw new Error("Couldn't get a webgl context for combining the overlays!");
    }
    this.glCtx = gl;

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
    // TODO set the weights or get it from this.weights
    const ws: number[] = [];
    textureLayers.forEach(() => {
      ws.push(1 / textureLayers.length);
    });

    console.log("Weights:", this.weights);
    let sum = 0;
    for (let i = 0; i < textureLayers.length; i++) {
      sum += this.weights[i];
    }
    // calculate a normalizer value so that all values will eventually sum up to 1
    const normalizer = 1 / sum;
    // normalize all values
    this.weights.map((w) => w * normalizer);

    console.log("Normalized Weights:", this.weights);
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
    this.combineOverlays(textures);

    return this.overlayCanvas;
  }

  // see https://stackoverflow.com/questions/23598471/how-do-i-clean-up-and-unload-a-webgl-canvas-context-from-gpu-after-use
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

  reset(): void {
    this.weights = [];
    // clear images by setting its length to 0
    this.allTextures.length = 0;
  }
}

const renderer = new CanvasRenderer();

export async function createOverlay(data: FilterLayer[]): Promise<void> {
  console.log("Creating canvas overlay now...");

  Benchmark.startMeasure("creating canvas overlay");
  //renderer = new CanvasRenderer(); //TODO nur einmal am Anfang oder jedes mal neu??

  Benchmark.startMeasure("render all Polygons");
  const allRenderProcesses = data.map((layer: FilterLayer) => renderer.renderPolygons(layer));
  await Promise.all(allRenderProcesses);
  Benchmark.startMeasure("render all Polygons");

  //console.log("Current number of saved textures in canvasRenderer: ", renderer.allTextures.length);

  const resultCanvas = renderer.createOverlay(renderer.allTextures);
  Benchmark.stopMeasure("creating canvas overlay");

  applyAlphaMask(resultCanvas);

  //Reset state for next rendering
  renderer.reset();

  console.log("finished blurring and compositing");
}

//TODO separate method that only calculates which layers changed and only render difference??
/*
export async function updateOverlay(newData: FilterLayer[]): Promise<void> {
  // calc differences
  createOverlay(newData);
}
*/
