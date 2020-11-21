import * as webglUtils from "./webglUtils";
import * as twgl from "twgl.js";
import { defaultVertexShader } from "./shaders";

//! das custom Layer unterstützt nur webgl1 !
const vertexSource3 = `
uniform mat4 u_matrix;
attribute vec2 a_position;

void main() {
    //vec2 scaled = a_position * 1.8
    gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
}
`;

const fragmentSource2 = `

precision mediump float;

void main() {
  gl_FragColor = vec4(0.5, 0.5, 0.7, 0.8);
}
`;

//! not used at the moment
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
  program2!: WebGLProgram;
  aPos2!: number;
  buffer: WebGLBuffer | null;
  buffer2: WebGLBuffer | null;

  constructor(customData: number[]) {
    this.id = "webglCustomLayer";
    this.type = "custom";
    this.renderingMode = "2d";
    this.data = customData;

    this.buffer = null;
    this.buffer2 = null;
  }

  /**
   * method called when the layer is added to the map,
   * see https://docs.mapbox.com/mapbox-gl-js/api/#styleimageinterface#onadd
   */
  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext): void {
    const vertexSource = defaultVertexShader();
    this.program = twgl.createProgramFromSources(gl, [vertexSource, fragmentSource2]);

    this.program2 = twgl.createProgramFromSources(gl, [vertexSource3, fragmentSource2]);

    // look up where the vertex data needs to go.
    this.aPos = gl.getAttribLocation(this.program, "a_pos");

    this.aPos2 = gl.getAttribLocation(this.program2, "a_position");

    // create and initialize a WebGLBuffer to store vertex and color data
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.data), gl.STATIC_DRAW);

    // create and initialize a WebGLBuffer to store vertex and color data
    this.buffer2 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer2);

    // whole viewport:
    const vertexLocations = [
      // X, Y
      -1.0,
      -1.0,
      1.0,
      -1.0,
      -1.0,
      1.0,
      -1.0,
      1.0,
      1.0,
      -1.0,
      1.0,
      1.0,
    ];

    //TODO add outline / glow effect and blur this afterwards!
    const newData = this.data.map((el) => el + el / 2);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexLocations), gl.STATIC_DRAW);
  }

  /**
   * method fired on each animation frame, see https://docs.mapbox.com/mapbox-gl-js/api/#map.event:render
   * @param matrix The map's camera matrix. It projects spherical mercator coordinates to gl
   *               coordinates. The mercator coordinate  [0, 0] represents the top left corner of
   *               the mercator world and  [1, 1] represents the bottom right corner.
   */
  render(gl: WebGLRenderingContext, matrix: number[]): void {
    gl.useProgram(this.program);

    // set the map camera matrix
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
    // diese ist laut https://limnu.com/webgl-blending-youre-probably-wrong/ die "beste" für "premultiplied alphas"
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // enable Stencil Buffer

    //gl.disable(gl.BLEND);
    gl.stencilMask(0xff); //this allows the stencil buffer values to be changed. This is important because the first rendering pass is creating the mask in the stencil buffer.
    gl.enable(gl.STENCIL_TEST);
    gl.colorMask(false, false, false, false); //disables changes to the color buffer so that the renderings that create the stencil do not change the visible image.
    gl.depthMask(false); //disables changes to the depth buffer
    gl.clear(gl.STENCIL_BUFFER_BIT);

    // Set up the test so it always passes and set the reference value to 1
    gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    // set the operation so we'll set the stencil to the reference value when both the stencil and depth tests pass
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

    // * Lines für Umrisse, Triangle_fan für fill
    const offset = 0; // 0 for offset means start at the beginning of the buffer.
    const count = this.data.length / 2;
    gl.drawArrays(gl.TRIANGLE_FAN, offset, count);

    // change the test so it only passes if the stencil is zero
    gl.stencilFunc(
      gl.NOTEQUAL, // the test
      0.0, // reference value
      0xff // mask
    );
    gl.stencilOp(
      gl.KEEP, // what to do if the stencil test fails
      gl.KEEP, // what to do if the depth test fails
      gl.KEEP // what to do if both tests pass
    );
    gl.colorMask(true, true, true, true); //enables modifications to the color buffer
    //gl.stencilMask(0x00); // disable writing to the stencil buffer

    /*
    gl.stencilFunc(gl.EQUAL, 1, 0xff);
    gl.stencilMask(0x00);
    */
    gl.depthMask(true);

    // now we can draw something else (the larger triangle) and it will only draw where there is 0 in the stencil buffer which is everywhere except where the first triangle was drawn

    // switch to another program
    gl.useProgram(this.program2);

    // set the map camera matrix
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program2, "u_matrix"), false, matrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer2);
    gl.enableVertexAttribArray(this.aPos2); // this command tells WebGL we want to supply data from a buffer.

    const size2 = 2; // always 1 to 4
    const stride2 = 0; // stride = how many bytes to skip to get from one piece of data to the next piece of data)
    // 0 for stride means "use a stride that matches the type and size".
    const normalized2 = false;
    //this command tells WebGL to get data from the buffer that was last bound with gl.bindBuffer,
    gl.vertexAttribPointer(this.aPos2, size2, gl.FLOAT, normalized2, stride2, 0);

    gl.drawArrays(gl.TRIANGLES, 0, this.data.length / 2);
  }

  /**
   * Optional method called when the layer has been removed from the Map with Map#removeLayer.
   * This gives the layer a chance to clean up gl resources and event listeners.
   */
  onRemove(map: mapboxgl.Map, gl: WebGLRenderingContext): void {
    // Cleanup resources
    // desallocate memory after send data to avoid memory leak issues
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // delete the gl context
    //delete this.gl;

    //this.positionBuffer.delete();
  }

  /**
   * Optional method called during a render frame to allow a layer to prepare resources
   * or render into a texture.
   * The layer cannot make any assumptions about the current GL state and must bind a framebuffer
   * before rendering.
   */
  prerender(gl: WebGLRenderingContext, matrix: number[]): void {
    //* If the layer needs to render to a texture, it should implement the `prerender` method
    // to do this and only use the `render` method for drawing directly into the main framebuffer.
    //Kommentar Ansis: "So if you need to use gl to draw into a gl texture you should do that in prerender"
  }

  renderWithStencilBuffer(gl: WebGLRenderingContext, matrix: number[]): void {
    //* to use stencil buffer with a normal webgl context:
    //const gl = someCanvasElement.getContext("webgl2", { stencil: true });
  }
}
