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

export function renderAndBlur(image: HTMLImageElement): HTMLCanvasElement | null {
  const newCanvas = document.querySelector("#test_canvas") as HTMLCanvasElement;
  // const newCanvas = document.createElement("canvas"); // in-memory canvas
  const glContext = newCanvas.getContext("webgl");

  if (!glContext) {
    console.log("No gl context available!");
    return null;
  }

  // adjust canvas size to the image size
  newCanvas.width = image.width;
  newCanvas.height = image.height;

  const vertexShader = createShader(glContext, glContext.VERTEX_SHADER, vertexShaderCanvas());
  const fragmentShader = createShader(glContext, glContext.FRAGMENT_SHADER, fragmentShaderCanvas());

  const program = createProgram(glContext, vertexShader, fragmentShader);

  const positionLocation = glContext.getAttribLocation(program, "a_position");
  const texcoordLocation = glContext.getAttribLocation(program, "a_texCoord");

  // create and initialize a WebGLBuffer to store vertex and color data
  const positionBuffer = glContext.createBuffer();
  // bind buffer (think of it as ARRAY_BUFFER = positionBuffer)
  glContext.bindBuffer(glContext.ARRAY_BUFFER, positionBuffer);
  // Set a rectangle the same size as the image at (0, 0). Necessary to show the image on the canvas.
  setRectangle(glContext, 0, 0, image.width, image.height);

  // provide texture coordinates for the rectangle.
  const texcoordBuffer = glContext.createBuffer();
  glContext.bindBuffer(glContext.ARRAY_BUFFER, texcoordBuffer);
  glContext.bufferData(
    glContext.ARRAY_BUFFER,
    new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0]),
    glContext.STATIC_DRAW
  );

  //TODO
  function createTexture(): void {
    if (!glContext) {
      return;
    }

    // Create a texture.
    const texture = glContext.createTexture();
    glContext.bindTexture(glContext.TEXTURE_2D, texture);

    // Set the parameters so we can render any size image.
    glContext.texParameteri(
      glContext.TEXTURE_2D,
      glContext.TEXTURE_WRAP_S,
      glContext.CLAMP_TO_EDGE
    );
    glContext.texParameteri(
      glContext.TEXTURE_2D,
      glContext.TEXTURE_WRAP_T,
      glContext.CLAMP_TO_EDGE
    );
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.NEAREST);
    glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.NEAREST);
  }

  createTexture();

  // Upload the image into the texture.
  glContext.texImage2D(
    glContext.TEXTURE_2D,
    0,
    glContext.RGBA,
    glContext.RGBA,
    glContext.UNSIGNED_BYTE,
    image
  );

  // lookup uniforms
  const resolutionLocation = glContext.getUniformLocation(program, "u_resolution");
  const textureSizeLocation = glContext.getUniformLocation(program, "u_textureSize");
  const kernelLocation = glContext.getUniformLocation(program, "u_kernel[0]");
  const kernelWeightLocation = glContext.getUniformLocation(program, "u_kernelWeight");

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

//TODO 1. alternativ kann auch der Canvas weggelassen werden und nur der Weichzeichner auf das Bild angewendet werden, wenn WebGl nicht nötig
//TODO 2. oder man nutzt einfach das CustomLayer unten (das ist vermutlich fast am sinnvollsten?)
//TODO 3. testen ob zoomen dann überhaupt möglich ist, wenn als canvas / image layer drübergelegt ?? wenn nein bleibt eh nur option 2
//  -> zu 3. das overlay muss ja sowieso bei jeder bewegung entfernt und neu geladen werden, also sollte das nicht das problem sein
/**
   * Einen Canvas darüber zu legen ist laut https://github.com/mapbox/mapbox-gl-js/issues/6456 nicht allzu 
   * gut für die Performance, stattdessen Custom Layer verwenden! Probleme:
        - Severe performance hit; browsers have a hard time compositing two GL contexts.
        - You can only draw on top of a Mapbox map — there’s no way to draw something in between
   */

//TODO andere Idee: ich will ja die Kreise blurren (die ich mit Turf.js zeichne oder halt direkt mit Canvas?)
//TODO  -> d.h. ich kann einfach die Kreise blurren und die dann als Image/canvassource darüberlegen

/**
 * Idee (ich glaub die drüber is besser):
 * 1. vor neuem Layer ein Bild machen und das kurz anzeigen (also diesen canvas visible und die echte karte nicht)
 * 2. karten kontext clearen und dann neues Layer adden
 * 3. bild von neuem Layer (mit weißem Hintergrund) und das blurren
 * 4. dieses dann als image layer auf karte
 * -> bringt aber nichts weil bild ja nicht interaktiv
 *
 * -> karte wieder anzeigen mit geblurrtem CustomLayer stattdessen?
 * -> irgendwie müsste halt nur der unterschied zw. baselayer und neuem Layer geblurrt werden oder?
 */
