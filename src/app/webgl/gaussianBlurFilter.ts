import * as twgl from "twgl.js";
import { getGaussianBlurFS, getVSForGaussBlur } from "./shaders";
//import { computeKernelWeight, getBlurFilterKernel } from "./webglUtils";

const renderCanvas = document.createElement("canvas");
const sourceTextureSize = [0, 0];

/*
const blurKernel = getBlurFilterKernel("gaussianBlur");
const kernelWeight = computeKernelWeight(blurKernel);
*/

let glProgram: WebGLProgram;

let renderImageCoordinatesBuffer;
let renderImageTexureCoordinatesBuffer;

let gl: WebGL2RenderingContext | WebGLRenderingContext | null;

export function createGaussianBlurFilter(): void {
  gl = renderCanvas.getContext("webgl2");
  if (!gl) {
    throw new Error("Couldn't get a webgl context for combining the overlays!");
  }

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

  // create and link program
  glProgram = twgl.createProgramFromSources(gl, [getVSForGaussBlur(), getGaussianBlurFS()]);
  /*
    glProgram = twgl.createProgramFromSources(gl, [
        gaussianBlurVertexShader(),
        gaussianBlurFragmentShader(),
    ]);
    */

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
  //gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); //* premultiply?
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

  //const count = 6; // 6 means two triangles
  //gl.drawArrays(gl.TRIANGLES, 0, count);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export function applyGaussianBlur(textures: HTMLImageElement[]): HTMLCanvasElement {
  // all textures have the same size:
  sourceTextureSize[0] = textures[0].width;
  sourceTextureSize[1] = textures[0].height;

  renderCanvas.width = textures[0].width;
  renderCanvas.height = textures[0].height;

  const ctx = gl;
  if (!ctx) {
    throw new Error("GL context not available for gaussian blur!");
  }

  // setup textures
  const textureArr = [];
  for (let ii = 0; ii < textures.length; ++ii) {
    const texture = setupSourceTexture(ctx, textures[ii]);
    textureArr.push(texture);
  }

  textureArr.forEach((element) => {
    render(ctx, element);
  });

  return renderCanvas;
}
