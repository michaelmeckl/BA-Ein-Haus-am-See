import * as webglUtils from "./webglUtils";

// Mapbox Custom layer implemented as ES6 class
export class MapboxCustomLayer {
  id: string;
  type: string;
  renderingMode: string;

  program!: WebGLProgram;
  aPos!: number;
  buffer: WebGLBuffer | null;
  data: number[];

  constructor(customData: number[]) {
    this.id = "webglCustomLayer";
    this.type = "custom";
    this.renderingMode = "2d";
    this.data = customData;

    this.buffer = null;
  }

  // method called when the layer is added to the map
  // https://docs.mapbox.com/mapbox-gl-js/api/#styleimageinterface#onadd
  onAdd(map: mapboxgl.Map, gl: WebGLRenderingContext): void {
    const vertexSource = webglUtils.createVertexShaderSource();
    const fragmentSource = webglUtils.createFragmentShaderSource();

    //console.log("in onAdd: ", gl.canvas);

    // create a vertex and a fragment shader
    const vertexShader = webglUtils.createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = webglUtils.createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    //TODO die vertex und fragment shader sollten nachdem sie nicht mehr benutzt werden, sofort gelöscht werden, s. WebGL Best Practices

    // link the two shaders into a WebGL program
    this.program = webglUtils.createProgram(gl, vertexShader, fragmentShader);

    // look up where the vertex data needs to go.
    this.aPos = gl.getAttribLocation(this.program, "a_pos");

    // create and initialize a WebGLBuffer to store vertex and color data
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.data), gl.STATIC_DRAW);
  }

  // method fired on each animation frame
  // https://docs.mapbox.com/mapbox-gl-js/api/#map.event:render
  render(gl: WebGLRenderingContext, matrix: number[]): void {
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
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const primitiveType = gl.TRIANGLE_STRIP;
    const offset = 0; // 0 for offset means start at the beginning of the buffer.
    // eslint-disable-next-line no-magic-numbers
    const count = this.data.length / 2;
    gl.drawArrays(primitiveType, offset, count);
  }
}
