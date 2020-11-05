import mapboxgl, { CustomLayerInterface } from "mapbox-gl";
import { map } from "../map/mapboxConfig";
import * as twgl from "twgl.js";
import { setRectangle } from "./webglUtils";

/**
 * for drawing Rectangles and Circles around map points
 */

const defaultVertexSource = `

attribute vec2 a_pos;

uniform mat4 u_matrix;
uniform vec2 u_resolution;

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);

    /*
    vec2 zeroToOne = a_pos / u_resolution;

    // convert from 0->1 to 0->2
    vec2 zeroToTwo = zeroToOne * 2.0;

    // convert from 0->2 to -1->+1 (clipspace)
    vec2 clipSpace = zeroToTwo - 1.0;

    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    */
}
`;

const defaultFragmentSource = `

precision mediump float;

// set color as uniform, so it doesn't need to be supplied for every vertex (whole shape has the same color now)
uniform vec4 u_color;

void main() {
  gl_FragColor = u_color;
}
`;

// calculate a circle directly in the vertex shader
// taken from https://webglfundamentals.org/webgl/lessons/webgl-drawing-without-data.html
const vs = `
attribute float vertexId;
uniform float numVerts;
uniform vec2 u_resolution;

#define PI radians(180.0)

const float numSlices = 20.0;
const float numVertsPerCircle = numSlices * 3.0;

vec2 computeCircleTriangleVertex(float vertexId) {
  float sliceId = floor(vertexId / 3.0);
  float triVertexId = mod(vertexId, 3.0);
  float edge = triVertexId + sliceId;
  float angleU = edge / numSlices;  // 0.0 to 1.0
  float angle = angleU * PI * 2.0;
  float radius = step(triVertexId, 1.5);
  return vec2(cos(angle), sin(angle)) * radius;
}

void main() {
  float circleId = floor(vertexId / numVertsPerCircle);
  float numCircles = numVerts / numVertsPerCircle;

  float u = circleId / numCircles;    // goes from 0 to 1
  float angle = u * PI * 2.0;         // goes from 0 to 2PI
  float radius = 0.8;

  vec2 pos = vec2(cos(angle), sin(angle)) * radius;

  vec2 triPos = computeCircleTriangleVertex(vertexId) * 0.1;
  
  float aspect = u_resolution.y / u_resolution.x;
  vec2 scale = vec2(aspect, 1);
  
  gl_Position = vec4((pos + triPos) * scale, 0, 1);
}
`;

// see https://www.desultoryquest.com/blog/drawing-anti-aliased-circular-points-using-opengl-slash-webgl/
const antiAliasedCircleFs = `
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif

precision mediump float;
uniform vec4 u_color;

void main()
{
    float r = 0.0, delta = 0.0, alpha = 1.0;
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    r = dot(cxy, cxy);
#ifdef GL_OES_standard_derivatives
    delta = fwidth(r);
    alpha = 1.0 - smoothstep(1.0 - delta, 1.0 + delta, r);
#endif

gl_FragColor = u_color * alpha;

}`;

const pointFragmentShader = `

precision mediump float;
uniform vec4 u_color;

void main()
{
    float r = 0.0, delta = 0.0, alpha = 1.0;
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    r = dot(cxy, cxy);
    if (r > 1.0) {
        discard;
    }
    gl_FragColor = u_color * (alpha);
}`;

function drawRectangles(gl: WebGLRenderingContext, el: any, elPos: number, colorLoc: any): void {
  //* für Mercator Coordinates:
  if (elPos % 2 === 0) {
    setRectangle(gl, el.x, el.y, -0.000017, -0.00003);
  } else if (elPos === 3) {
    setRectangle(gl, el.x, el.y, -0.000017, 0.00003);
  } else {
    setRectangle(gl, el.x, el.y, -0.000017, -0.00003);
  }

  /*
    //* für Pixel Coordinates:
    if (ii % 2 === 0) {
        setRectangle(gl, el.x, el.y, -17, -30);
    } else if (ii === 3) {
        setRectangle(gl, el.x, el.y, 23, -30);
    } else {
        setRectangle(gl, el.x, el.y, 25, 15);
    }
    */

  const randColor = 0.2 + (elPos * 2) / 10;
  // Set a random color.
  gl.uniform4f(colorLoc, randColor, 0.8, 0.0, 1);

  // Draw the rectangle.
  // 6 vertices as we want rectangles
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function drawCirclesInWebGL(
  gl: WebGLRenderingContext,
  el: any,
  elPos: number,
  colorLoc: any
): void {
  const positions = [el.x, el.y];

  // use 360 points to draw the circle
  const totalPoints = 360;
  const radius = 0.000002;
  for (let i = 0; i <= totalPoints; i++) {
    positions.push(
      el.x + radius * Math.cos(2 * Math.PI * (i / 360)),
      el.y + radius * Math.sin(2 * Math.PI * (i / 360))
    );
  }

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const randColor = 0.2 + (elPos * 2) / 10;
  // Set a random color.
  gl.uniform4f(colorLoc, randColor, 0.8, 0.0, 1);

  // 362: 360 punkte für Kreis und die 2 startkoordinaten
  gl.drawArrays(gl.TRIANGLE_FAN, 0, 362);
}

function loadCustomData(): any {
  // define vertices to be rendered in the custom style layer
  // * mercator Coordinates for map points
  const uniSouthWest = mapboxgl.MercatorCoordinate.fromLngLat({
    lng: 12.089283,
    lat: 48.9920256,
  });
  const uniSouthEast = mapboxgl.MercatorCoordinate.fromLngLat({
    lng: 12.1025303,
    lat: 48.9941069,
  });
  const uniNorthWest = mapboxgl.MercatorCoordinate.fromLngLat({
    lng: 12.0909411,
    lat: 49.0012031,
  });
  const uniNorthEast = mapboxgl.MercatorCoordinate.fromLngLat({
    lng: 12.0989967,
    lat: 49.0016276,
  });

  // * pixel/point Coordinates for map points
  /*
  const uniSouthWest = map.project([12.089283, 48.9920256]);
  const uniSouthEast = map.project([12.1025303, 48.9941069]);
  const uniNorthWest = map.project([12.0909411, 49.0012031]);
  const uniNorthEast = map.project([12.0989967, 49.0016276]);
  */
  return [uniSouthEast, uniNorthEast, uniSouthWest, uniNorthWest];
}

function showCampus(): void {
  let resolutionLocation: WebGLUniformLocation | null,
    positionAttributeLocation: number,
    positionBuffer: WebGLBuffer | null,
    program: WebGLProgram | null,
    uniformMatrix: WebGLUniformLocation | null,
    colorLocation: WebGLUniformLocation | null;

  const vertices: any[] = loadCustomData();
  //console.log(vertices);

  const glCustomLayer: CustomLayerInterface = {
    id: "glCustomLayer",
    type: "custom",

    onAdd: (map: mapboxgl.Map, gl: WebGLRenderingContext) => {
      program = twgl.createProgramFromSources(gl, [defaultVertexSource, antiAliasedCircleFs]);

      // look up attribute locations
      positionAttributeLocation = gl.getAttribLocation(program, "a_pos");

      // look up uniform locations for vertex shader:
      uniformMatrix = gl.getUniformLocation(program, "u_matrix");
      resolutionLocation = gl.getUniformLocation(program, "u_resolution");
      // look up uniform locations for fragment shader:
      colorLocation = gl.getUniformLocation(program, "u_color");

      // Create a buffer
      positionBuffer = gl.createBuffer();

      // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

      //* enableVertixAttribArray zur init-Zeit funktioniert nicht immer, hier tut es das aber
      //* (kleiner Performance - boost da weniger zur Renderzeit (onAdd wird nur einmal ausgeführt!))
      // Turn on the attribute
      gl.enableVertexAttribArray(positionAttributeLocation);

      // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
      const size = 2; // 2 components per iteration
      const type = gl.FLOAT; // the data is 32bit floats
      const normalize = false; // don't normalize the data
      const stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
      const offset = 0; // start at the beginning of the buffer
      gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);

      //Pass in the canvas resolution so we can convert from pixels to clipspace in the shader
      gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
    },

    render: function (gl: WebGLRenderingContext, matrix: number[]): void {
      // Tell it to use our program (pair of shaders)
      gl.useProgram(program);

      // Bind the position buffer.
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

      gl.uniformMatrix4fv(uniformMatrix, false, matrix);
      //const color = new Float32Array([0.0, 1.0, 0.0, 1.0]);
      //gl.uniform4fv(colorLocation, color);

      for (let ii = 0; ii < vertices.length; ++ii) {
        const el = vertices[ii];
        //drawRectangles(gl, el, ii, colorLocation);
        drawCirclesInWebGL(gl, el, ii, colorLocation);
      }
    },

    onRemove: function (map: mapboxgl.Map, gl: WebGLRenderingContext): void {
      // desallocate memory after send data to avoid memory leak issues
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    },
  };

  map.addLayer(glCustomLayer, "waterway-label");
}

//TODO performance messen! das sollte schneller sein:

//TODO 2 : rausfinden wie die punkte hier von außen noch definiert werden können! geht das hier überhaupt?
function showCampusNew(): void {
  let vertexIdLoc: number,
    numVertsLoc: WebGLUniformLocation | null,
    numVerts: number,
    idBuffer: WebGLBuffer | null,
    resolutionLocation: WebGLUniformLocation | null,
    positionAttributeLocation: number,
    positionBuffer: WebGLBuffer | null,
    program: WebGLProgram | null,
    uniformMatrix: WebGLUniformLocation | null,
    colorLocation: WebGLUniformLocation | null;

  const vertices: any[] = loadCustomData();
  //console.log(vertices);

  const glCustomLayer: CustomLayerInterface = {
    id: "glCustomLayer",
    type: "custom",

    onAdd: (map: mapboxgl.Map, gl: WebGLRenderingContext) => {
      program = twgl.createProgramFromSources(gl, [vs, defaultFragmentSource]);

      // look up attribute locations
      positionAttributeLocation = gl.getAttribLocation(program, "a_pos");
      vertexIdLoc = gl.getAttribLocation(program, "vertexId");

      // look up uniform locations for vertex shader:
      uniformMatrix = gl.getUniformLocation(program, "u_matrix");
      numVertsLoc = gl.getUniformLocation(program, "numVerts");
      resolutionLocation = gl.getUniformLocation(program, "u_resolution");
      // look up uniform locations for fragment shader:
      colorLocation = gl.getUniformLocation(program, "u_color");

      // Make a buffer with just a count in it.

      numVerts = 8 * 3 * 20;
      //numVerts = 360;
      const vertexIds = new Float32Array(numVerts);
      vertexIds.forEach((v, i) => {
        vertexIds[i] = i;
      });

      idBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, idBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertexIds, gl.STATIC_DRAW);

      /*
      //* enableVertixAttribArray zur init-Zeit funktioniert nicht immer, hier tut es das aber
      //* (kleiner Performance - boost da weniger zur Renderzeit (onAdd wird nur einmal ausgeführt!))
      // Turn on the attribute
      gl.enableVertexAttribArray(positionAttributeLocation);

      // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
      const size = 2; // 2 components per iteration
      const type = gl.FLOAT; // the data is 32bit floats
      const normalize = false; // don't normalize the data
      const stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
      const offset = 0; // start at the beginning of the buffer
      gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);
      */
    },

    render: function (gl: WebGLRenderingContext, matrix: number[]): void {
      // Tell it to use our program (pair of shaders)
      gl.useProgram(program);

      gl.uniformMatrix4fv(uniformMatrix, false, matrix);

      {
        // Turn on the attribute
        gl.enableVertexAttribArray(vertexIdLoc);

        // Bind the id buffer.
        gl.bindBuffer(gl.ARRAY_BUFFER, idBuffer);

        // Tell the attribute how to get data out of idBuffer (ARRAY_BUFFER)
        const size = 1; // 1 components per iteration
        const type = gl.FLOAT; // the data is 32bit floats
        const normalize = false; // don't normalize the data
        const stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
        const offset = 0; // start at the beginning of the buffer
        gl.vertexAttribPointer(vertexIdLoc, size, type, normalize, stride, offset);
      }

      // tell the shader the number of verts
      gl.uniform1f(numVertsLoc, numVerts);
      // tell the shader the resolution
      gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
      gl.uniform4f(colorLocation, 1.0, 0.8, 0.0, 1);

      const offset = 0;
      gl.drawArrays(gl.TRIANGLES, offset, numVerts);
    },

    onRemove: function (map: mapboxgl.Map, gl: WebGLRenderingContext): void {
      // desallocate memory after send data to avoid memory leak issues
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    },
  };

  map.addLayer(glCustomLayer, "waterway-label");
}

export function testCampusExampes(): void {
  //showCampus();    //* CustomLayer Implementation für drawRectangles und drawCirclesInWebGL
  showCampusNew(); //* CustomLayer Implementation für drawCirclesInShader
}
