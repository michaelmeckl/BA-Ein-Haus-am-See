import * as twgl from "twgl.js";
import { init } from "../main";
import { handleWebglInitError, showSnackbar, SnackbarType } from "../utils";
import { getGaussianBlurFS, getVSForGaussBlur } from "./shaders";
//import { computeKernelWeight, getBlurFilterKernel } from "./webglUtils";

const renderCanvas = document.createElement("canvas");
const sourceTextureSize = [0, 0];

/*
const blurKernel = getBlurFilterKernel("gaussianBlur");
const kernelWeight = computeKernelWeight(blurKernel);
*/

let glProgram: WebGLProgram;

let renderImageCoordinatesBuffer: WebGLBuffer | null;
let renderImageTexureCoordinatesBuffer: WebGLBuffer | null;

let gl: WebGL2RenderingContext | WebGLRenderingContext;

export function setupGaussianBlurFilter(): void {
  const glCtx = renderCanvas.getContext("webgl");
  if (!glCtx) {
    handleWebglInitError();
    //throw new Error("Couldn't get a webgl context for combining the overlays!");
    return;
  }
  gl = glCtx;

  gl.clearColor(0.0, 0.0, 0.0, 1.0); // black, fully opaque
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL); // Near things obscure far things

  // buffers for the textured plane in normalized space
  renderImageCoordinatesBuffer = gl.createBuffer();
  renderImageTexureCoordinatesBuffer = gl.createBuffer();
  const renderImageVertices = [-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0];
  gl.bindBuffer(gl.ARRAY_BUFFER, renderImageCoordinatesBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(renderImageVertices), gl.STATIC_DRAW);

  const renderImageTextureCoordinates = [0, 0, 1, 0, 0, 1, 1, 1];
  gl.bindBuffer(gl.ARRAY_BUFFER, renderImageTexureCoordinatesBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(renderImageTextureCoordinates), gl.STATIC_DRAW);
}

//handle webgl context loss
renderCanvas.addEventListener(
  "webglcontextlost",
  (event) => {
    //console.log("Webgl Context lost");
    event.preventDefault();
    showSnackbar("Webgl Context Lost! Restarting application necessary!", SnackbarType.ERROR, 4000);
    init();
  },
  false
);
renderCanvas.addEventListener("webglcontextrestored", init, false);

function setupProgram(blurSize: number): void {
  //! the blur size needs to be defined as a constant so it can be used as an array index in the shader!
  //const blurShaderSource = `#version 300 es\n#define MSIZE ${blurSize}` + getGaussianBlurFS();

  //TODO adjusting the sigma based on the kernelsize changes how sharp/blurry the result appears per zoom level
  //TODO which gives quite nice effect when zooming out -> Find a good formula (maybe a better one than dividing by 2)
  //const sigma = (blurSize / 2).toFixed(1); //! needs to be a float to work correctly!
  const sigma = (10).toFixed(1);
  const blurShaderSource =
    `#define MSIZE ${blurSize}\n#define SIGMA ${sigma}` + getGaussianBlurFS();
  //console.log(blurShaderSource);

  // create and link program
  glProgram = twgl.createProgramFromSources(gl, [getVSForGaussBlur(), blurShaderSource]);

  // the coordinate attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, renderImageCoordinatesBuffer);
  const coordinateLocation = gl.getAttribLocation(glProgram, "coordinate");
  gl.enableVertexAttribArray(coordinateLocation);
  gl.vertexAttribPointer(coordinateLocation, 3, gl.FLOAT, false, 0, 0);

  // the textureCoordinate attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, renderImageTexureCoordinatesBuffer);
  const textureCoordinateLocation = gl.getAttribLocation(glProgram, "textureCoordinate");
  gl.enableVertexAttribArray(textureCoordinateLocation);
  gl.vertexAttribPointer(textureCoordinateLocation, 2, gl.FLOAT, false, 0, 0);
}

function setupSourceTexture(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  sourceTextureImage: HTMLImageElement
): WebGLTexture | null {
  const sourceTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  //gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); //* to premultiply alpha
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceTextureImage);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return sourceTexture;
}

function render(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  sourceTexture: WebGLTexture | null
): void {
  gl.viewport(0, 0, renderCanvas.width, renderCanvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(glProgram);

  // set up the sourceTextureSize
  gl.uniform2f(
    gl.getUniformLocation(glProgram, "sourceTextureSize"),
    sourceTextureSize[0],
    sourceTextureSize[1]
  );
  // set up the sourceTexelSize
  gl.uniform2f(
    gl.getUniformLocation(glProgram, "sourceTexelSize"),
    1.0 / sourceTextureSize[0],
    1.0 / sourceTextureSize[1]
  );

  /*
    const kernelLocation = gl.getUniformLocation(glProgram, "u_kernel[0]");
    const kernelWeightLocation = gl.getUniformLocation(glProgram, "u_kernelWeight");
    // set the kernel and it's weight
    gl.uniform1fv(kernelLocation, blurKernel);
    gl.uniform1f(kernelWeightLocation, kernelWeight);
    */

  // the sourceTexture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
  gl.uniform1i(gl.getUniformLocation(glProgram, "sourceTextureSampler"), 0);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export function applyGaussianBlur(
  image: HTMLImageElement,
  blurStrength: number
): HTMLCanvasElement {
  sourceTextureSize[0] = image.width;
  sourceTextureSize[1] = image.height;

  renderCanvas.width = image.width;
  renderCanvas.height = image.height;

  const ctx = gl;
  if (!ctx) {
    throw new Error("GL context not available for gaussian blur!");
  }

  setupProgram(blurStrength);

  const texture = setupSourceTexture(ctx, image);
  render(ctx, texture);

  /*
  // setup textures
  const textureArr = [];
  for (let ii = 0; ii < textures.length; ++ii) {
    const texture = setupSourceTexture(ctx, textures[ii]);
    textureArr.push(texture);
  }

  textureArr.forEach((element) => {
    render(ctx, element, blurStrength);
  });
  */

  return renderCanvas;
}
