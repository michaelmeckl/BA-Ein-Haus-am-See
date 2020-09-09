// Custom layer implemented as ES6 class
class NullIslandLayer {
  renderingMode: string;
  id: string;
  type: string;
  program: WebGLProgram | undefined;

  constructor() {
    this.id = "null-island";
    this.type = "custom";
    this.renderingMode = "2d";
  }

  onAdd(map, gl) {
    const vertexSource = `
             uniform mat4 u_matrix;
             void main() {
                 gl_Position = u_matrix  vec4(0.5, 0.5, 0.0, 1.0);
                 gl_PointSize = 20.0;
             }`;

    const fragmentSource = `
             void main() {
                 gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
             }`;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);

    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);
  }

  render(gl, matrix) {
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, "u_matrix"), false, matrix);
    gl.drawArrays(gl.POINTS, 0, 1);
  }
}

/*
map.on("load", function () {
  map.addLayer(new NullIslandLayer());
});
*/
