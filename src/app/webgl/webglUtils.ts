/* eslint-disable no-magic-numbers */

// Util-Functions for abstracting some of WebGL's Boilerplate Code.
// Some functions use a small WebGL Helper library called TWGL (see https://www.npmjs.com/package/twgl.js)
// import * as twgl from "twgl.js";

//! these kernels are not used right now
// prettier-ignore
const blurKernels = {
    // Define several convolution kernels
    gaussianBlur: [
      0.045, 0.122, 0.045,
      0.122, 0.332, 0.122,
      0.045, 0.122, 0.045,
    ],
    boxBlur: [
        0.111, 0.111, 0.111,
        0.111, 0.111, 0.111,
        0.111, 0.111, 0.111,
    ],
    triangleBlur: [
        0.0625, 0.125, 0.0625,
        0.125, 0.25, 0.125,
        0.0625, 0.125, 0.0625,
    ],
  };

export function getBlurFilterKernel(name = "gaussianBlur"): number[] {
  switch (name) {
    case "boxBlur":
      return blurKernels.boxBlur;
    case "triangleBlur":
      return blurKernels.triangleBlur;
    case "gaussianBlur":
    default:
      return blurKernels.gaussianBlur;
  }
}

export function computeKernelWeight(kernel: number[]): number {
  const weight = kernel.reduce(function (prev: number, curr: number) {
    return prev + curr;
  });
  return weight <= 0 ? 1 : weight;
}

// Fills the buffer with the values that define a rectangle.
export function setRectangle(
  gl: WebGLRenderingContext,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  // Set a rectangle the same size as the image at (0, 0).
  const x1 = x;
  const x2 = x + width;
  const y1 = y;
  const y2 = y + height;

  // NOTE: gl.bufferData(gl.ARRAY_BUFFER, ...) will affect
  // whatever buffer is bound to the `ARRAY_BUFFER` bind point
  // but so far we only have one buffer. If we had more than one
  // buffer we'd want to bind that buffer to `ARRAY_BUFFER` first.
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]),
    gl.STATIC_DRAW
  );
}

export function createTexture(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  data: Uint8Array | HTMLImageElement,
  unit = 0,
  filter: number = gl.NEAREST,
  width = 1,
  height = 1
): WebGLTexture | null {
  const texture = gl.createTexture();
  //set texture unit to active;
  //needed on some drivers, see. https://learnopengl.com/Getting-started/Textures at "Texture Units":
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // Set the parameters so we can render any size image:
  //these properties let you upload textures of any size (defaul would be to repeat, but clamping makes more sense here)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  //these determine how interpolation is made if the image is being scaled up or down
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);

  // Upload the image or pixel data into the texture.
  if (data instanceof Uint8Array) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }

  //gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

export function createBuffer(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  data: any
): WebGLBuffer | null {
  const buffer = gl.createBuffer();
  // bind buffer (think of it as ARRAY_BUFFER = buffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

export function bindAttribute(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  buffer: WebGLBuffer | null,
  attribute: number,
  numComponents = 2
): void {
  // bind the corresponding buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // turn the attribute on
  gl.enableVertexAttribArray(attribute);
  // tell the attribute how to get data out of the buffer
  gl.vertexAttribPointer(attribute, numComponents, gl.FLOAT, false, 0, 0);
}

export function setupCanvasForDrawing(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  clearColor: [number, number, number, number] = [0, 0, 0, 0]
): void {
  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Clear the canvas
  gl.clearColor(...clearColor);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

//! not used
/*

type shaderType =
  | WebGL2RenderingContext["VERTEX_SHADER"]
  | WebGL2RenderingContext["FRAGMENT_SHADER"];
  
export function getPixelsFromImage(texture: HTMLImageElement): Uint8Array | null {
  // use canvas to get the pixel data array of the image
  const canvas = document.createElement("canvas");
  canvas.width = texture.width;
  canvas.height = texture.width;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(texture, 0, 0);
  const imageData = ctx?.getImageData(0, 0, texture.width, texture.height);
  if (!imageData) {
    return null;
  }
  const pixels = new Uint8Array(imageData.data.buffer);
  return pixels;
}

// see. https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html
export function createShader(
  gl: WebGLRenderingContext,
  type: shaderType,
  source: string
): WebGLShader {
  // Create the shader object
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Couldn't create shader!");
  }
  // Set the shader source code.
  gl.shaderSource(shader, source);
  // Compile the shader
  gl.compileShader(shader);
  // Check if it compiled successfully
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
  }

  return shader;
}

//Initialize a shader program, so WebGL knows how to draw the data.
//see. https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html
export function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Couldn't create program!");
  }

  gl.attachShader(program, vertexShader);
  gl.deleteShader(vertexShader); // cleanup instantly
  gl.attachShader(program, fragmentShader);
  gl.deleteShader(fragmentShader);
  gl.linkProgram(program);

  // check if creating the program was successfull
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
  }

  return program;
}

export function bindFramebufferAndSetViewport(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  fb: WebGLFramebuffer | null,
  width: number,
  height: number,
  texture: WebGLTexture | null
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.viewport(0, 0, width, height);
  if (texture) {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  }
}

//Clear the canvas and reset depth.
export function clearCanvas(gl: WebGL2RenderingContext | WebGLRenderingContext): void {
  gl.clearColor(0, 0, 0, 0.0);
  gl.clearDepth(1.0); // Clear everything
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL); // Near things obscure far things

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

// Util to enable VAO extension for Webgl 1
function enableVAOExtension(gl: WebGLRenderingContext): void {
  const ext = gl.getExtension("OES_vertex_array_object");
  if (!ext) {
    // tell user they don't have the required extension or work around it
  } else {
    const someVAO = ext.createVertexArrayOES();
  }
}
*/
