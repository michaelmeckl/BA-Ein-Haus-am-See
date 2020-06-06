// see. https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html
export function createShader(
  gl: WebGL2RenderingContext,
  type: number,
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
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
  }

  return shader;
}

// see. https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html
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
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
  }

  return program;
}

// see. https://webgl2fundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
/**
 * Usage just before rendering:
 * resize(gl.canvas);
 * // Tell WebGL how to convert from clip space to pixels
 * gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
 */
export function resize(canvas: HTMLCanvasElement): void {
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

export function clearCanvas(gl: WebGL2RenderingContext): void {
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}
