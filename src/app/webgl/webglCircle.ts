import { mat4 } from "gl-matrix";
import mapboxgl, { CustomLayerInterface } from "mapbox-gl";
import * as webglUtils from "./webglUtils";

function getCircleVertexSource(): string {
  // Vertex shader program

  return `
    attribute vec4 aVertexPosition;
    attribute vec4 aVertexColor;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying lowp vec4 vColor;

    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      vColor = aVertexColor;
    }
    `;
}

function getCircleFragmentSource(): string {
  // Fragment shader program

  return `
    varying lowp vec4 vColor;

    void main(void) {
      gl_FragColor = vColor;
    }
  `;
}

//
// initBuffers
//
// Initialize the buffers we'll need. For this demo, we just
// have one object -- a simple two-dimensional square.
//
function initBuffers(gl: WebGLRenderingContext, startingPosition: mapboxgl.MercatorCoordinate) {
  // Create a buffer for the square's positions.
  const positionBuffer = gl.createBuffer();

  // Select the positionBuffer as the one to apply buffer
  // operations to from here out.

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const positions = [startingPosition.x, startingPosition.y];

  // use 100 points to draw the circle
  const totalPoints = 100;
  for (let i = 0; i <= totalPoints; i++) {
    positions.push(Math.cos((i * 2 * Math.PI) / totalPoints));
    positions.push(Math.sin((i * 2 * Math.PI) / totalPoints));
  }

  //console.log(positions);

  // Now pass the list of positions into WebGL to build the
  // shape. We do this by creating a Float32Array from the
  // JavaScript array, then use it to fill the current buffer.

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  // Now set up the colors for the vertices

  const colors = [
    1.0,
    1.0,
    1.0,
    1.0, // RGBA COLOR
  ];

  for (let i = 0; i <= 100; i++) {
    if (i % 2 === 0) {
      colors.push(1.0, 0.0, 0.0, 1.0);
    } else {
      colors.push(1.0, 0.0, 1.0, 1.0);
    }
  }

  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    color: colorBuffer,
  };
}

function createPerspectiveMatrix(gl: WebGLRenderingContext, programInfo): any {
  // Create a perspective matrix, a special matrix that is
  // used to simulate the distortion of perspective in a camera.
  // Our field of view is 45 degrees, with a width/height
  // ratio that matches the display size of the canvas
  // and we only want to see objects between 0.1 units
  // and 100 units away from the camera.

  const fieldOfView = (45 * Math.PI) / 180; // in radians
  const aspect = gl.canvas.width / gl.canvas.height;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();

  mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

  // Set the drawing position to the "identity" point, which is
  // the center of the scene.
  const modelViewMatrix = mat4.create();

  // Now move the drawing position a bit to where we want to
  // start drawing the square.

  mat4.translate(
    modelViewMatrix, // destination matrix
    modelViewMatrix, // matrix to translate
    [-0.0, 0.0, -6.0]
  ); // amount to translate

  return {
    projectionMatrix: projectionMatrix,
    modelViewMatrix: modelViewMatrix,
  };
}

function setPositionInformation(gl: WebGLRenderingContext, programInfo, buffers): void {
  // Tell WebGL how to pull out the positions from the position
  // buffer into the vertexPosition attribute
  const numComponents = 2;
  const type = gl.FLOAT;
  const normalize = false;
  const stride = 0;
  const offset = 0;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexPosition,
    numComponents,
    type,
    normalize,
    stride,
    offset
  );
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
}

function setColorInformation(gl: WebGLRenderingContext, programInfo, buffers): void {
  // Tell WebGL how to pull out the colors from the color buffer
  // into the vertexColor attribute.
  const numComponents = 2;
  const type = gl.FLOAT;
  const normalize = false;
  const stride = 0;
  const offset = 0;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
  gl.vertexAttribPointer(
    programInfo.attribLocations.vertexColor,
    numComponents,
    type,
    normalize,
    stride,
    offset
  );
  gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);
}

//
// Draw the scene.
//
function drawScene(gl: WebGLRenderingContext, programInfo, buffers) {
  //webglUtils.clearCanvas(gl);

  const matrices = createPerspectiveMatrix(gl, programInfo);

  setPositionInformation(gl, programInfo, buffers);
  setColorInformation(gl, programInfo, buffers);

  // Tell WebGL to use our program when drawing
  gl.useProgram(programInfo.program);

  // Set the shader uniforms
  gl.uniformMatrix4fv(
    programInfo.uniformLocations.projectionMatrix,
    false,
    matrices.projectionMatrix
  );
  gl.uniformMatrix4fv(
    programInfo.uniformLocations.modelViewMatrix,
    false,
    matrices.modelViewMatrix
  );

  const offset = 0;
  const vertexCount = 102;
  gl.drawArrays(gl.TRIANGLE_FAN, offset, vertexCount);
}

function loadCustomData(): any {
  // define vertices to be rendered in the custom style layer
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

  return [uniSouthEast, uniNorthEast, uniSouthWest, uniNorthWest];
}

export function addWebglCircle(map: mapboxgl.Map): void {
  let shaderProgram: WebGLProgram;
  let programInfo: {};
  let buffers: any;

  const vertices = loadCustomData();

  const glCircleLayer: CustomLayerInterface = {
    id: "colorCircle",
    type: "custom",

    onAdd: (map: mapboxgl.Map, gl: WebGLRenderingContext) => {
      const vertexSource = getCircleVertexSource();
      const fragmentSource = getCircleFragmentSource();
      // create a vertex and a fragment shader
      const vertexShader = webglUtils.createShader(gl, gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = webglUtils.createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

      // link the two shaders into a WebGL program
      shaderProgram = webglUtils.createProgram(gl, vertexShader, fragmentShader);

      // Collect all the info needed to use the shader program.
      // Look up which attributes our shader program is using
      // for aVertexPosition, aVevrtexColor and also
      // look up uniform locations.
      programInfo = {
        program: shaderProgram,
        attribLocations: {
          vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
          vertexColor: gl.getAttribLocation(shaderProgram, "aVertexColor"),
        },
        uniformLocations: {
          projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
          modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
        },
      };

      //buffers = initBuffers(gl, vertices[0]);
    },

    render: function (gl: WebGLRenderingContext, matrix: number[]): void {
      vertices.forEach((element: mapboxgl.MercatorCoordinate) => {
        buffers = initBuffers(gl, element);
        drawScene(gl, programInfo, buffers);
      });
    },
  };

  map.addLayer(glCircleLayer);
}

//Alternative funktion für circle in fragment shader:
/*
function main() {
  const gl = document.querySelector("canvas").getContext("webgl");
  const ext = gl.getExtension("ANGLE_instanced_arrays");
  if (!ext) {
    return alert("need ANGLE_instanced_arrays");
  }
  twgl.addExtensionsToContext(gl);

  const vs = `
  attribute float id;
  attribute vec4 position;
  attribute vec2 texcoord;
  
  uniform float time;
  
  varying vec2 v_texcoord;
  varying vec4 v_color;
  
  void main() {
    float o = id + time;
    gl_Position = position + vec4(
        vec2(
             fract(o * 0.1373),
             fract(o * 0.5127)) * 2.0 - 1.0,
        0, 0);
        
    v_texcoord = texcoord;
    v_color = vec4(fract(vec3(id) * vec3(0.127, 0.373, 0.513)), 1);
  }`;

  const fs = `
  precision mediump float;
  varying vec2 v_texcoord;
  varying vec4 v_color;
  void main() {
    gl_FragColor = mix(
       v_color, 
       vec4(0), 
       step(1.0, length(v_texcoord.xy * 2. - 1.)));
  }
  `;

  // compile shaders, link program, look up locations
  const programInfo = twgl.createProgramInfo(gl, [vs, fs]);

  const maxCount = 250000;
  const ids = new Float32Array(maxCount);
  for (let i = 0; i < ids.length; ++i) {
    ids[i] = i;
  }
  const x = (16 / 300) * 2;
  const y = (16 / 150) * 2;

  const bufferInfo = twgl.createBufferInfoFromArrays(gl, {
    position: {
      numComponents: 2,
      data: [-x, -y, x, -y, -x, y, -x, y, x, -y, x, y],
    },
    texcoord: [0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0],
    id: {
      numComponents: 1,
      data: ids,
      divisor: 1,
    },
  });
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);

  const fpsElem = document.querySelector("#fps");
  const countElem = document.querySelector("#count");

  let count;
  function getCount() {
    count = Math.min(maxCount, parseInt(countElem.value));
  }

  countElem.addEventListener("input", getCount);
  getCount();

  const maxHistory = 60;
  const fpsHistory = new Array(maxHistory).fill(0);
  let historyNdx = 0;
  let historyTotal = 0;

  let then = 0;
  function render(now) {
    const deltaTime = now - then;
    then = now;

    historyTotal += deltaTime - fpsHistory[historyNdx];
    fpsHistory[historyNdx] = deltaTime;
    historyNdx = (historyNdx + 1) % maxHistory;

    fpsElem.textContent = (1000 / (historyTotal / maxHistory)).toFixed(1);

    gl.useProgram(programInfo.program);
    twgl.setUniforms(programInfo, { time: now * 0.001 });
    ext.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, count);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}
*/
