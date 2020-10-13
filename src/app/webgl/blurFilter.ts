import {
  computeKernelWeight,
  createProgram,
  createShader,
  fragmentShaderCanvas,
  getBlurFilterKernel,
  resizeCanvas,
  vertexShaderCanvas,
} from "./webglUtils";

export function setRectangle(
  gl: WebGLRenderingContext,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const x1 = x;
  const x2 = x + width;
  const y1 = y;
  const y2 = y + height;
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]),
    gl.STATIC_DRAW
  );
}

function createTexture(glContext: WebGLRenderingContext): void {
  if (!glContext) {
    return;
  }

  // Create a texture.
  const texture = glContext.createTexture();
  glContext.bindTexture(glContext.TEXTURE_2D, texture);

  // Set the parameters so we can render any size image.
  glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.CLAMP_TO_EDGE);
  glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.CLAMP_TO_EDGE);
  glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.NEAREST);
  glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.NEAREST);
}

function initBuffers(
  glContext: WebGLRenderingContext
): {
  positionBuffer: WebGLBuffer | null;
  texcoordBuffer: WebGLBuffer | null;
} {
  // create and initialize a WebGLBuffer to store vertex and color data
  const positionBuffer = glContext.createBuffer();
  // bind buffer (think of it as ARRAY_BUFFER = positionBuffer)
  glContext.bindBuffer(glContext.ARRAY_BUFFER, positionBuffer);

  // provide texture coordinates for the rectangle.
  const texcoordBuffer = glContext.createBuffer();
  glContext.bindBuffer(glContext.ARRAY_BUFFER, texcoordBuffer);
  glContext.bufferData(
    glContext.ARRAY_BUFFER,
    new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0]),
    glContext.STATIC_DRAW
  );

  return {
    positionBuffer: positionBuffer,
    texcoordBuffer: texcoordBuffer,
  };
}

export function renderAndBlur(image: HTMLImageElement): HTMLCanvasElement | null {
  const newCanvas = document.querySelector("#test_canvas") as HTMLCanvasElement;
  // const newCanvas = document.createElement("canvas"); // in-memory canvas
  const glContext = newCanvas.getContext("webgl");

  if (!glContext) {
    //eslint-disable-next-line
    alert("No webgl context available in renderAndBlur!");
    return null;
  }

  // adjust canvas size to the image size
  newCanvas.width = image.width;
  newCanvas.height = image.height;

  // init shader program
  const vertexShader = createShader(glContext, glContext.VERTEX_SHADER, vertexShaderCanvas());
  const fragmentShader = createShader(glContext, glContext.FRAGMENT_SHADER, fragmentShaderCanvas());
  const program = createProgram(glContext, vertexShader, fragmentShader);

  // lookup attributes
  const positionLocation = glContext.getAttribLocation(program, "a_position");
  const texcoordLocation = glContext.getAttribLocation(program, "a_texCoord");

  // lookup uniforms
  const resolutionLocation = glContext.getUniformLocation(program, "u_resolution");
  const textureSizeLocation = glContext.getUniformLocation(program, "u_textureSize");
  const kernelLocation = glContext.getUniformLocation(program, "u_kernel[0]");
  const kernelWeightLocation = glContext.getUniformLocation(program, "u_kernelWeight");

  const { positionBuffer, texcoordBuffer } = initBuffers(glContext);

  // Set a rectangle the same size as the image at (0, 0). Necessary to show the image on the canvas.
  setRectangle(glContext, 0, 0, image.width, image.height);

  createTexture(glContext);

  // Upload the image into the texture.
  glContext.texImage2D(
    glContext.TEXTURE_2D,
    0,
    glContext.RGBA,
    glContext.RGBA,
    glContext.UNSIGNED_BYTE,
    image
  );

  //const blurKernel = getBlurFilterKernel("triangleBlur");
  const blurKernel = getBlurFilterKernel();
  const kernelWeight = computeKernelWeight(blurKernel);

  function drawWithKernel(): void {
    if (!glContext) {
      return;
    }

    resizeCanvas(newCanvas);
    // Tell WebGL how to convert from clip space to pixels
    glContext.viewport(0, 0, glContext.canvas.width, glContext.canvas.height);

    // Clear the canvas
    glContext.clearColor(0, 0, 0, 0);
    glContext.clear(glContext.COLOR_BUFFER_BIT);

    // Tell it to use our program (pair of shaders)
    glContext.useProgram(program);

    // Turn on the position attribute
    glContext.enableVertexAttribArray(positionLocation);
    // Bind the position buffer.
    glContext.bindBuffer(glContext.ARRAY_BUFFER, positionBuffer);
    // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    const size = 2; // 2 components per iteration
    const type = glContext.FLOAT; // the data is 32bit floats
    const normalize = false; // don't normalize the data
    const stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
    const offset = 0; // start at the beginning of the buffer
    glContext.vertexAttribPointer(positionLocation, size, type, normalize, stride, offset);

    // Turn on the texcoord attribute
    glContext.enableVertexAttribArray(texcoordLocation);
    // bind the texcoord buffer.
    glContext.bindBuffer(glContext.ARRAY_BUFFER, texcoordBuffer);
    // Tell the texcoord attribute how to get data out of texcoordBuffer (ARRAY_BUFFER)
    glContext.vertexAttribPointer(texcoordLocation, size, type, normalize, stride, offset);

    // set the resolution
    glContext.uniform2f(resolutionLocation, glContext.canvas.width, glContext.canvas.height);
    // set the size of the image
    glContext.uniform2f(textureSizeLocation, image.width, image.height);

    // set the kernel and it's weight
    glContext.uniform1fv(kernelLocation, blurKernel);
    glContext.uniform1f(kernelWeightLocation, kernelWeight);

    // Draw the rectangle.
    const primitiveType = glContext.TRIANGLES;
    const rectOffset = 0;
    const count = 6; // 6 means two triangles
    glContext.drawArrays(primitiveType, rectOffset, count);
  }

  drawWithKernel();

  return newCanvas;
}

//TODO oder man nutzt einfach das CustomLayer unten (das ist vermutlich fast am sinnvollsten?)
/**
   * Einen Canvas darüber zu legen ist laut https://github.com/mapbox/mapbox-gl-js/issues/6456 nicht allzu 
   * gut für die Performance, stattdessen Custom Layer verwenden! Probleme:
        - Severe performance hit; browsers have a hard time compositing two GL contexts.
        - You can only draw on top of a Mapbox map — there’s no way to draw something in between
   */

//TODO  -> d.h. ich kann einfach die turf Kreise blurren und die dann als Image/canvassource darüberlegen
