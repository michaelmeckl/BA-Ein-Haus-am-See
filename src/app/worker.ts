/**
 * * This class was an attempt to move some of the computation to a separate worker thread so
 * * the UI stays responsive all the time. Unfortunately, a web worker can't access DOM elements
 * * like a canvas and therefore the overlay creation process needs a major refactoring to work with this.
 * ! An option would be to use an Offscreen-Canvas but this technology is only supported in Chrome, Edge and Opera as of late 2020 :(
 * ! It is available in Firefox but needs to be enabled in the browser config first (therefore not suited for normal users!)
 */

import * as twgl from "twgl.js";
import { combineOverlayFragmentShader, defaultVertexShader } from "./webgl/shaders";
import * as webglUtils from "./webgl/webglUtils";

const ctx: Worker = self as any;

let textureCount: any;

class Combiner {
  private glCtx!: WebGL2RenderingContext | WebGLRenderingContext;
  private glProgram!: WebGLProgram;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;

  // others
  private weights: number[] = [];

  constructor(weights: any) {
    this.weights = weights;
  }

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
    //console.log("Normalized Weights:", this.weights);
  }

  combineOverlays(width: number, height: number, textureLayers: HTMLImageElement[]): any {
    const canvas = new OffscreenCanvas(width, height);

    //handle webgl context loss
    canvas.addEventListener(
      "webglcontextlost",
      (event) => {
        console.error("Webgl Context lost");
        event.preventDefault();
      },
      false
    );
    canvas.addEventListener(
      "webglcontextrestored",
      () => {
        //this.combineOverlays(textureLayers);
      },
      false
    );

    //options: {stencil: true, antialias: true, premultipliedAlpha: false, alpha: false, preserveDrawingBuffer: false});
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      throw new Error("Couldn't get a webgl context for combining the overlays!");
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

    return canvas;
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
}

// Respond to message from parent thread
ctx.addEventListener("message", async (event) => {
  console.log("in worker onmessage: ", event);

  const canvasWidth = event.data[0];
  const canvasHeight = event.data[1];
  const weights = event.data[2];
  const textures = event.data[3];

  const combiner = new Combiner(weights);
  const resultCanvas = combiner.combineOverlays(canvasWidth, canvasHeight, textures);

  // return result to main thread
  ctx.postMessage(resultCanvas);
});
