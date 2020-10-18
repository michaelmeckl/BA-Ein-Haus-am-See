import { vertexShaderCanvas, fragmentShaderCanvas } from "./shaders";
import {
  computeKernelWeight,
  createProgram,
  createShader,
  getBlurFilterKernel,
  resizeCanvas,
} from "./webglUtils";

function createTexture(glContext: WebGL2RenderingContext): void {
  if (!glContext) {
    return;
  }

  // Create a texture.
  const texture = glContext.createTexture();
  //needed on some drivers, see. https://learnopengl.com/Getting-started/Textures at "Texture Units":
  glContext.activeTexture(glContext.TEXTURE0);
  glContext.bindTexture(glContext.TEXTURE_2D, texture);

  // Set the parameters so we can render any size image:
  //these properties let you upload textures of any size (defaul would be to repeat, but clamping makes more sense here)
  glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.CLAMP_TO_EDGE);
  glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.CLAMP_TO_EDGE);
  //these determine how interpolation is made if the image is being scaled up or down
  glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.NEAREST);
  glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.NEAREST);
}

function initBuffers(
  glContext: WebGL2RenderingContext,
  image: HTMLImageElement
): {
  positionBuffer: WebGLBuffer | null;
  texcoordBuffer: WebGLBuffer | null;
} {
  // create and initialize a WebGLBuffer to store vertex and color data
  const positionBuffer = glContext.createBuffer();
  // bind buffer (think of it as ARRAY_BUFFER = positionBuffer)
  glContext.bindBuffer(glContext.ARRAY_BUFFER, positionBuffer);
  // Set a rectangle the same size as the image at (0, 0).
  const x1 = 0;
  const x2 = 0 + image.width;
  const y1 = 0;
  const y2 = 0 + image.height;
  glContext.bufferData(
    glContext.ARRAY_BUFFER,
    new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]),
    glContext.STATIC_DRAW
  );

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

// see https://stackoverflow.com/questions/12590685/blend-two-canvases-onto-one-with-webgl
export function renderAndBlur(image: HTMLImageElement): HTMLCanvasElement | null {
  const newCanvas = document.querySelector("#test_canvas") as HTMLCanvasElement;
  // const newCanvas = document.createElement("canvas"); // in-memory canvas
  const glContext = newCanvas.getContext("webgl2");

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

  const { positionBuffer, texcoordBuffer } = initBuffers(glContext, image);

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
