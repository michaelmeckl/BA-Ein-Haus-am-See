//TODO
resetCanvas(): void {
    if (this.gl.canvas instanceof HTMLCanvasElement) {
      webglUtils.resizeCanvas(this.gl.canvas);
    }

    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    webglUtils.resetCanvas(this.gl);
  }

  clearCanvas(): void {
    const context = this.overlayCanvas.getContext("2d");
    context?.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
  }

createTexture(image: HTMLImageElement): void {
    // Create a texture.
    const texture = this.gl.createTexture();
    //needed on some drivers, see. https://learnopengl.com/Getting-started/Textures at "Texture Units":
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

    // Set the parameters so we can render any size image:
    //these properties let you upload textures of any size (defaul would be to repeat, but clamping makes more sense here)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    //these determine how interpolation is made if the image is being scaled up or down
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    // Upload the image into the texture.
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      image
    );
  }

  initPositionBuffer(data: any[]): void {
    this.positionBuffer = this.gl.createBuffer();
    // bind buffer (think of it as ARRAY_BUFFER = positionBuffer)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), this.gl.STATIC_DRAW);
  }

  initImageBuffers(image: HTMLImageElement): WebGLBuffer | null {
    // create and initialize a WebGLBuffer to store vertex and color data
    const positionBuffer = this.gl.createBuffer();
    // bind buffer (think of it as ARRAY_BUFFER = positionBuffer)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
    // Set a rectangle the same size as the image at (0, 0).
    const x1 = 0;
    const x2 = 0 + image.width;
    const y1 = 0;
    const y2 = 0 + image.height;
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]),
      this.gl.STATIC_DRAW
    );

    return positionBuffer;
  }

  enableBlending(): void {
    const gl = this.gl;

    //enable alpha blending
    gl.enable(gl.BLEND);
    //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // diese ist laut https://limnu.com/webgl-blending-youre-probably-wrong/ die "beste" für "premultiplied alphas"
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  createOverlayLayer(): HTMLCanvasElement {
    //TODO this.drawTexture();
    this.cleanupResources();

    return this.overlayCanvas;
  }

  drawTexture(image: HTMLImageElement): HTMLCanvasElement {
    this.createTexture(image);

    //const blurKernel = getBlurFilterKernel("triangleBlur");
    const blurKernel = webglUtils.getBlurFilterKernel();
    const kernelWeight = webglUtils.computeKernelWeight(blurKernel);

    webglUtils.resizeCanvas(this.overlayCanvas);
    // Tell WebGL how to convert from clip space to pixels
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    // Clear the canvas
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    // Tell WebGL to use our program when drawing
    this.gl.useProgram(this.program);

    // set the map camera matrix
    //this.gl.uniformMatrix4fv(this.gl.getUniformLocation(this.program, "u_matrix"), false, matrix);

    /*
    // set the resolution
    this.gl.uniform2f(resolutionLocation, this.gl.canvas.width, this.gl.canvas.height);
    // set the size of the image
    this.gl.uniform2f(textureSizeLocation, image.width, image.height);

    // set the kernel and it's weight
    this.gl.uniform1fv(kernelLocation, blurKernel);
    this.gl.uniform1f(kernelWeightLocation, kernelWeight);
    */

    const offset = 0;
    const vertexCount = this.mapLayer.length / 2;
    this.gl.drawArrays(this.gl.TRIANGLE_FAN, offset, vertexCount);

    return this.overlayCanvas;
  }

  // see https://stackoverflow.com/questions/23598471/how-do-i-clean-up-and-unload-a-webgl-canvas-context-from-gpu-after-use
  cleanupResources(): void {
    //TODO or use gl-reset instead?
    //reset();

    // desallocate memory and free resources to avoid memory leak issues
    const numTextureUnits = this.gl.getParameter(this.gl.MAX_TEXTURE_IMAGE_UNITS);
    for (let unit = 0; unit < numTextureUnits; ++unit) {
      this.gl.activeTexture(this.gl.TEXTURE0 + unit);
      this.gl.bindTexture(this.gl.TEXTURE_2D, null);
      this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, null);
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, null);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    // Delete all your resources
    // TODO
    /*
    this.gl.deleteTexture(someTexture);
    this.gl.deleteTexture(someOtherTexture);
    this.gl.deleteBuffer(someBuffer);
    */

    this.gl.canvas.width = 1;
    this.gl.canvas.height = 1;

    //TODO ?
    //this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  /**
   * Shader:
   * <script id="vshader" type="whatever">
    attribute vec4 a_position;
    attribute float a_textureIndex;
    varying float v_textureIndex;
    void main() {
      gl_Position = a_position;
      v_textureIndex = a_textureIndex;
    }    

<script id="fshader" type="whatever">
#define numTextures 4
precision mediump float;
varying float v_textureIndex;
uniform sampler2D u_textures[numTextures];
    
vec4 getSampleFromArray(sampler2D textures[4], int ndx, vec2 uv) {
    vec4 color = vec4(0);
    for (int i = 0; i < numTextures; ++i) {
      vec4 c = texture2D(u_textures[i], uv);
      if (i == ndx) {
        color += c;
      }
    }
    return color;
}
    
void main() {
    gl_FragColor = getSampleFromArray(u_textures, int(v_textureIndex + 0.5), vec2(0.5, 0.5));
}
   */
  exampleTextures() {
    const canvas = document.getElementById("c");
    const gl = canvas.getContext("webgl");

    // Note: createProgramFromScripts will call bindAttribLocation
    // based on the index of the attibute names we pass to it.
    const program = webglUtils.createProgramFromScripts(
      gl,
      ["vshader", "fshader"],
      ["a_position", "a_textureIndex"]
    );
    gl.useProgram(program);
    const textureLoc = gl.getUniformLocation(program, "u_textures[0]");

    // Tell the shader to use texture units 0 to 3
    gl.uniform1iv(textureLoc, [0, 1, 2, 3]); //uniform variable location and texture Index (or array of indices)

    const positions = [1, 1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1];

    const textureIndex = [0, 1, 2, 3, 0, 1];

    const vertBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const vertBuffer2 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer2);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(textureIndex), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.UNSIGNED_BYTE, false, 0, 0);

    const colors = [[0, 0, 255, 255]];

    // make 4 textures
    colors.forEach(function (color, ndx) {
      gl.activeTexture(gl.TEXTURE0 + ndx);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1, //width
        1, //height
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array(color)
      );
    });

    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);
  }
