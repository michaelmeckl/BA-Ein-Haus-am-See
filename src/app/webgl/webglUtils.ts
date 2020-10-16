// Util-Functions for abstracting some of WebGL's Boilerplate Code.
// Some functions use a small WebGL Helper library called TWGL (see https://www.npmjs.com/package/twgl.js)
import * as twgl from "twgl.js";

type shaderType =
  | WebGL2RenderingContext["VERTEX_SHADER"]
  | WebGL2RenderingContext["FRAGMENT_SHADER"];

export function getBlurFilterKernel(name = "gaussianBlur"): number[] {
  // prettier-ignore
  const kernels = {
    // Define several convolution kernels
    gaussianBlur: [
      0.045, 0.122, 0.045,
      0.122, 0.332, 0.122,
      0.045, 0.122, 0.045,
    ],
    gaussianBlur2: [
      1, 2, 1,
      2, 4, 2,
      1, 2, 1,
    ],
    gaussianBlur3: [
      0, 1, 0,
      1, 1, 1,
      0, 1, 0,
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

  switch (name) {
    case "gaussianBlur2":
      return kernels.gaussianBlur2;
    case "gaussianBlur3":
      return kernels.gaussianBlur3;
    case "boxBlur":
      return kernels.boxBlur;
    case "triangleBlur":
      return kernels.triangleBlur;
    case "gaussianBlur":
    default:
      return kernels.gaussianBlur;
  }
}

export function computeKernelWeight(kernel: number[]): number {
  const weight = kernel.reduce(function (prev: number, curr: number) {
    return prev + curr;
  });
  return weight <= 0 ? 1 : weight;
}

export function bindFramebufferAndSetViewport(
  gl: WebGL2RenderingContext,
  fb: WebGLFramebuffer | null,
  width: number,
  height: number
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.viewport(0, 0, width, height);
}

export function createProgramInfo(
  gl: WebGL2RenderingContext,
  shaderProgram: WebGLProgram,
  attribs?: any[],
  uniforms?: any[]
): any {
  //TODO extract attributes and uniforms automatically and push them to the object:
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
      vertexColor: gl.getAttribLocation(shaderProgram, "aVertexColor"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
    },
  };

  return programInfo;
}

export function setupWebGLProgram(
  glContext: WebGL2RenderingContext | WebGLRenderingContext,
  vs: string,
  fs: string
): twgl.ProgramInfo {
  return twgl.createProgramInfo(glContext, [vs, fs]);
}

// see. https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html
export function createShader(
  gl: WebGL2RenderingContext,
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

/**
 * Initialize a shader program, so WebGL knows how to draw the data.
 * see. https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html
 */
export function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Couldn't create program!");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  // check if creating the program was successfull
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
  }

  return program;
}

// see. https://webgl2fundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
/**
 * Usage just before rendering:
 *    resize(gl.canvas);
 *    // Tell WebGL how to convert from clip space to pixels
 *    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
 */
export function resizeCanvas(canvas: HTMLCanvasElement): void {
  // Lookup the size the browser is displaying the canvas.
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  // Check if the canvas is not the same size.
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    // Make the canvas the same size
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
}

function resetDepth(gl: WebGL2RenderingContext): void {
  gl.clearDepth(1.0); // Clear depth
  gl.enable(gl.DEPTH_TEST); // Enable depth testing
  gl.depthFunc(gl.LEQUAL); // Near things obscure far things
}

/**
 * Clear the canvas and reset depth.
 */
export function clearCanvas(gl: WebGL2RenderingContext): void {
  gl.clearColor(0, 0, 0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

//* Kombination of the two methods above
function resetCanvas(gl: WebGL2RenderingContext): void {
  gl.clearColor(0.0, 0.0, 0.0, 1.0); // Clear to black, fully opaque
  gl.clearDepth(1.0); // Clear everything
  gl.enable(gl.DEPTH_TEST); // Enable depth testing
  gl.depthFunc(gl.LEQUAL); // Near things obscure far things

  // Clear the canvas before we start drawing on it.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

/**
 * * Use this at init time for performance improvement (only useful with WebGL2 though!)
 */
export function setupAttribVAO(gl: WebGL2RenderingContext, geometries: any[], attribs: any[]): any {
  // at init time
  //for each model / geometry / ...
  for (let index = 0; index < geometries.length; index++) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    //for each attribute
    for (let index = 0; index < attribs.length; index++) {
      const attribute = attribs[index];
      gl.enableVertexAttribArray(attribute);
      //TODO gl.bindBuffer(gl.ARRAY_BUFFER, bufferForAttribute);
      //TODO gl.vertexAttribPointer(...);
    }

    //if indexed geometry {
    /*
      if (geometry is indexed) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      }  */

    // unbind the vao
    gl.bindVertexArray(null);
  }

  /**
   * * at render time everything left to do is:
   *  gl.bindVertexArray(vaoForGeometry);
   */
}
