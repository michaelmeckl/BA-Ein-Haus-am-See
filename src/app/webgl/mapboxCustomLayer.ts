import { drawBufferInfo } from "twgl.js";
import { createFragmentShaderSource, createVertexShaderSource } from "./shaders";
import * as webglUtils from "./webglUtils";

//TODO das custom Layer unterstützt nur webgl1 !

// Mapbox Custom layer implemented as ES6 class
export class MapboxCustomLayer {
  id: string;
  type: string;
  renderingMode: string;

  data: number[];

  // definite assignment assertion (!) is fine here as the custom layer interface implementation
  // makes sure the methods are called in correct order.
  program!: WebGLProgram;
  aPos!: number;
  buffer: WebGLBuffer | null;

  constructor(customData: number[]) {
    this.id = "webglCustomLayer";
    this.type = "custom";
    this.renderingMode = "2d";
    this.data = customData;

    this.buffer = null;
  }

  /**
   * method called when the layer is added to the map,
   * see https://docs.mapbox.com/mapbox-gl-js/api/#styleimageinterface#onadd
   */
  onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext): void {
    //console.log("in onAdd: ", gl.canvas.getContext("webgl"));
    //console.log("in onAdd: ", gl.canvas.getContext("webgl2"));

    const vertexSource = createVertexShaderSource();
    const fragmentSource = createFragmentShaderSource();
    //TODO add blur shader instead:
    //const fragmentSource = webglUtils.fragmentShaderCanvas();

    /*
    // create a vertex and a fragment shader
    const vertexShader = webglUtils.createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = webglUtils.createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    // link the two shaders into a WebGL program
    this.program = webglUtils.createProgram(gl, vertexShader, fragmentShader);
    */
    const programinfo = webglUtils.setupWebGLProgram(gl, vertexSource, fragmentSource);
    this.program = programinfo.program;

    // look up where the vertex data needs to go.
    this.aPos = gl.getAttribLocation(this.program, "a_pos");

    // create and initialize a WebGLBuffer to store vertex and color data
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.data), gl.STATIC_DRAW);
  }

  /**
   * method fired on each animation frame, see https://docs.mapbox.com/mapbox-gl-js/api/#map.event:render
   * @param matrix The map's camera matrix. It projects spherical mercator coordinates to gl
   *               coordinates. The mercator coordinate  [0, 0] represents the top left corner of
   *               the mercator world and  [1, 1] represents the bottom right corner.
   */
  render(gl: WebGL2RenderingContext, matrix: number[]): void {
    //console.log("in render: ", gl.canvas);

    //TODO cleart die ganze map
    //webglUtils.clearCanvas(gl); // clear canvas color and depth
    //gl.viewport(0, 0, gl.canvas.width, gl.canvas.height); //resize canvas

    gl.useProgram(this.program);

    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "u_matrix"), false, matrix);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(this.aPos); // this command tells WebGL we want to supply data from a buffer.

    const size = 2; // always 1 to 4
    const stride = 0; // stride = how many bytes to skip to get from one piece of data to the next piece of data)
    // 0 for stride means "use a stride that matches the type and size".
    const normalized = false;
    //this command tells WebGL to get data from the buffer that was last bound with gl.bindBuffer,
    gl.vertexAttribPointer(this.aPos, size, gl.FLOAT, normalized, stride, 0);
    //enable alpha blending
    gl.enable(gl.BLEND);
    //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    //TODO andere blend Functions benutzen?
    // diese ist laut https://limnu.com/webgl-blending-youre-probably-wrong/ die "beste" für "premultiplied alphas"
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // oder das:
    // used for blending pixel arithmetic for RGB and alpha components separately:
    //gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // * Lines für Umrisse, Triangle_fan für fill
    const primitiveType = gl.TRIANGLE_FAN;
    const offset = 0; // 0 for offset means start at the beginning of the buffer.
    const count = this.data.length / 2;
    gl.drawArrays(primitiveType, offset, count);
    //TODO use drawElements or type = gl.Triangles instead??

    //TODO
    /*
    gl.enable(gl.STENCIL_TEST);

    //TODO
    ...

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    //gl.disable(gl.STENCIL_TEST);

    this.map.triggerRepaint();
    */
  }

  /**
   * Optional method called when the layer has been removed from the Map with Map#removeLayer.
   * This gives the layer a chance to clean up gl resources and event listeners.
   */
  onRemove(map: mapboxgl.Map, gl: WebGL2RenderingContext): void {
    // Cleanup resources
    this.buffer = null;
  }

  /**
   * Optional method called during a render frame to allow a layer to prepare resources
   * or render into a texture.
   * The layer cannot make any assumptions about the current GL state and must bind a framebuffer
   * before rendering.
   */
  prerender(gl: WebGL2RenderingContext, matrix: number[]): void {
    //TODO If the layer needs to render to a texture, it should implement the `prerender` method
    // to do this and only use the `render` method for drawing directly into the main framebuffer.
  }

  //TODO test this in the render func above:
  /*
  renderWithStencilBuffer(glCtx: WebGL2RenderingContext, matrix: number[]): void {
    const gl = someCanvasElement.getContext("webgl2", { stencil: true });
    gl.enable(gl.STENCIL_TEST);

    // Set up the test so it always passes and set the reference value to 1
    gl.stencilFunc(
      gl.ALWAYS, // the test
      1, // reference value
      0xff // mask
    );
    // set the operation so we'll set the stencil to the reference value when both the stencil and depth tests pass
    gl.stencilOp(
      gl.KEEP, // what to do if the stencil test fails
      gl.KEEP, // what to do if the depth test fails
      gl.REPLACE // what to do if both tests pass
    );

    // ... lots of setup for a single triangle ...

    //gl.drawArrays(...) or gl.drawElements(...)

    // change the test so it only passes if the stencil is zero
    gl.stencilFunc(
      gl.EQUAL, // the test
      0, // reference value
      0xff // mask
    );
    gl.stencilOp(
      gl.KEEP, // what to do if the stencil test fails
      gl.KEEP, // what to do if the depth test fails
      gl.KEEP // what to do if both tests pass
    );

    // now we can draw something else (the larger triangle) and it will only draw where there is 0 in the stencil buffer which is everywhere except where the first triangle was drawn
  }

  exampleStencilBuffer() {
    const m4 = twgl.m4;
    const gl = document.querySelector("canvas").getContext("webgl2", { stencil: true });

    const vs = `
      attribute vec4 position;
      uniform mat4 matrix;
      void main() {
        gl_Position = matrix * position;
      }
      `;

    const fs = `
      precision mediump float;
      uniform vec4 color;
      void main() {
        gl_FragColor = color;
      }
      `;

    const program = twgl.createProgram(gl, [vs, fs]);
    const posLoc = gl.getAttribLocation(program, "position");
    const matLoc = gl.getUniformLocation(program, "matrix");
    const colorLoc = gl.getUniformLocation(program, "color");

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(
      posLoc, // attribute location
      2, // 2 value per vertex
      gl.FLOAT, // 32bit floating point values
      false, // don't normalize
      0, // stride (0 = base on type and size)
      0 // offset into buffer
    );

    // clear the stencil to 0 (the default)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

    gl.useProgram(program);

    // turn on the stencil
    gl.enable(gl.STENCIL_TEST);

    // Set the stencil test so it always passes
    // and the reference to 1
    gl.stencilFunc(
      gl.ALWAYS, // the test
      1, // reference value
      0xff // mask
    );
    // Set it so we replace with the reference value (1)
    gl.stencilOp(
      gl.KEEP, // what to do if the stencil test fails
      gl.KEEP, // what to do if the depth test fails
      gl.REPLACE // what to do if both tests pass
    );

    // draw a white small triangle
    gl.uniform4fv(colorLoc, [1, 1, 1, 1]); // white
    gl.uniformMatrix4fv(matLoc, false, m4.scaling([0.2, 0.2, 1]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Set the test that the stencil must = 0
    gl.stencilFunc(
      gl.EQUAL, // the test
      0, // reference value
      0xff // mask
    );
    // don't change the stencil buffer on draw
    gl.stencilOp(
      gl.KEEP, // what to do if the stencil test fails
      gl.KEEP, // what to do if the depth test fails
      gl.KEEP // what to do if both tests pass
    );

    // draw a large green triangle
    gl.uniform4fv(colorLoc, [0, 1, 0, 1]); // green
    gl.uniformMatrix4fv(matLoc, false, m4.scaling([0.9, -0.9, 1]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  anotherExampleStencilBuffer() {
    var gl;

    var gProgram;

    var gVertexAttribLocation;
    var gColorAttribLocation;

    var gTriangleVertexBuffer;
    var gTriangleColorBuffer;
    var gQuadVertexBuffer;
    var gQuadColorBuffer;

    function initGL() {
      var glcanvas = document.getElementById("glcanvas");
      gl = glcanvas.getContext("webgl2", { stencil: true });
    }

    function createAndCompileShader(type, source) {
      var shader = gl.createShader(type);

      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
      }

      return shader;
    }

    function createAndLinkProgram(glVertexShader, glFragmentShader) {
      var glProgram = gl.createProgram();

      gl.attachShader(glProgram, glVertexShader);
      gl.attachShader(glProgram, glFragmentShader);
      gl.linkProgram(glProgram);

      if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
        throw new Error("Could not initialise shaders");
      }

      return glProgram;
    }

    function initShaderPrograms() {
      var gVertexShader = createAndCompileShader(
        gl.VERTEX_SHADER,
        [
          "attribute vec3 a_vertex;",
          "attribute vec4 a_color;",

          "varying vec4 v_color;",

          "void main(void) {",
          "v_color = a_color;",
          "gl_Position = vec4(a_vertex, 1.0);",
          "}",
        ].join("\n")
      );

      var gFragmentShader = createAndCompileShader(
        gl.FRAGMENT_SHADER,
        [
          "precision mediump float;",

          "varying vec4 v_color;",
          "void main(void) {",
          "gl_FragColor = v_color;",
          "}",
        ].join("\n")
      );

      gProgram = createAndLinkProgram(gVertexShader, gFragmentShader);
    }

    function initGLAttribLocations() {
      gVertexAttribLocation = gl.getAttribLocation(gProgram, "a_vertex");
      gColorAttribLocation = gl.getAttribLocation(gProgram, "a_color");
    }

    function initBuffers() {
      gTriangleVertexBuffer = gl.createBuffer();
      gTriangleColorBuffer = gl.createBuffer();
      gQuadVertexBuffer = gl.createBuffer();
      gQuadColorBuffer = gl.createBuffer();

      gl.bindBuffer(gl.ARRAY_BUFFER, gTriangleVertexBuffer);
      var vertices = new Float32Array([
        0.0,
        1.0,
        0.0,
        -1.0,
        -1.0,
        0.0,
        1.0,
        -1.0,
        0.0,

        0.0,
        -1.0,
        0.0,
        -1.0,
        1.0,
        0.0,
        1.0,
        1.0,
        0.0,
      ]);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, gTriangleColorBuffer);
      var colors = new Float32Array([
        0.0,
        1.0,
        0.0,
        1.0,
        0.0,
        1.0,
        0.0,
        1.0,
        0.0,
        1.0,
        0.0,
        1.0,

        0.0,
        0.0,
        1.0,
        1.0,
        0.0,
        0.0,
        1.0,
        1.0,
        0.0,
        0.0,
        1.0,
        1.0,
      ]);
      gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, gQuadVertexBuffer);
      var vertices = new Float32Array([
        -1.0,
        1.0,
        0.0,
        -1.0,
        -1.0,
        0.0,
        1.0,
        1.0,
        0.0,
        1.0,
        -1.0,
        0.0,
      ]);
      for (let i = 0, ii = vertices.length; i < ii; ++i) {
        vertices[i] *= 0.75;
      }
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, gQuadColorBuffer);
      var colors = new Float32Array([
        1.0,
        0.0,
        0.0,
        1.0,
        1.0,
        0.0,
        0.0,
        1.0,
        1.0,
        0.0,
        0.0,
        1.0,
        1.0,
        0.0,
        0.0,
        1.0,
      ]);
      gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    }

    function drawQuads() {
      gl.bindBuffer(gl.ARRAY_BUFFER, gQuadVertexBuffer);
      gl.vertexAttribPointer(gVertexAttribLocation, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, gQuadColorBuffer);
      gl.vertexAttribPointer(gColorAttribLocation, 4, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function drawTriagles() {
      gl.bindBuffer(gl.ARRAY_BUFFER, gTriangleVertexBuffer);
      gl.vertexAttribPointer(gVertexAttribLocation, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, gTriangleColorBuffer);
      gl.vertexAttribPointer(gColorAttribLocation, 4, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function renderScene() {
      gl.enable(gl.STENCIL_TEST);
      gl.enable(gl.DEPTH_TEST);
      // gl.enable(gl.CULL_FACE);
      gl.useProgram(gProgram);

      gl.clearColor(0.5, 0.5, 0.5, 1.0);

      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

      gl.enableVertexAttribArray(gVertexAttribLocation);
      gl.enableVertexAttribArray(gColorAttribLocation);

      gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

      gl.stencilFunc(gl.ALWAYS, 1, 0xff);
      gl.stencilMask(0xff);
      gl.depthMask(false);
      gl.colorMask(false, false, false, false);

      drawQuads();

      gl.stencilFunc(gl.EQUAL, 1, 0xff);
      gl.stencilMask(0x00);
      gl.depthMask(true);
      gl.colorMask(true, true, true, true);

      drawTriagles();

      gl.disableVertexAttribArray(gVertexAttribLocation);
      gl.disableVertexAttribArray(gColorAttribLocation);

      gl.flush();
    }

    initGL();
    initShaderPrograms();
    initGLAttribLocations();
    initBuffers();
    renderScene();
  }
  */
}
