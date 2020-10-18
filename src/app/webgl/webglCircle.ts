import { mat4 } from "gl-matrix";
import mapboxgl, { CustomLayerInterface } from "mapbox-gl";
import * as webglUtils from "./webglUtils";

//! folgendes geht nicht, da webgl 2 und webgl2 wird von mapbox custom layer noch nicht unterstützt!
/*
// Create a vertex array object (attribute state)
vao = gl.createVertexArray();

// and make it the one we're currently working with
gl.bindVertexArray(vao);

// Turn on the attribute
gl.enableVertexAttribArray(positionAttributeLocation);

// in render
// Bind the attribute/buffer set we want.
// gl.bindVertexArray(vao);

*/

//! clear and resize nicht nötig in render bei custom layer, sonst schon!
/*
twgl.resizeCanvasToDisplaySize(gl.canvas);

// Tell WebGL how to convert from clip space to pixels
gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

// Clear the canvas
gl.clearColor(0, 0, 0, 0);
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
*/

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
function initBuffers(gl: WebGLRenderingContext, startingPositions: mapboxgl.MercatorCoordinate[]) {
  // Create a buffer for the square's positions.
  const positionBuffer = gl.createBuffer();

  // Select the positionBuffer as the one to apply buffer
  // operations to from here out.

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  const positions: any[] = [];
  for (const pos of startingPositions) {
    //positions.push(...[pos.x, pos.y]);
    const positions = [pos.x, pos.y];

    // use 100 points to draw the circle
    const totalPoints = 100;
    for (let i = 0; i <= totalPoints; i++) {
      positions.push(Math.cos((i * 2 * Math.PI) / totalPoints));
      positions.push(Math.sin((i * 2 * Math.PI) / totalPoints));
    }

    console.log(positions);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  }

  /*
  const positions = [startingPosition.x, startingPosition.y];

  // use 100 points to draw the circle
  const totalPoints = 100;
  for (let i = 0; i <= totalPoints; i++) {
    positions.push(Math.cos((i * 2 * Math.PI) / totalPoints));
    positions.push(Math.sin((i * 2 * Math.PI) / totalPoints));
  }
  */

  //console.log(positions);

  // Now pass the list of positions into WebGL to build the
  // shape. We do this by creating a Float32Array from the
  // JavaScript array, then use it to fill the current buffer.

  //gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

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

function createPerspectiveMatrix(gl: WebGLRenderingContext, programInfo: any): any {
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

function setPositionInformation(
  gl: WebGLRenderingContext,
  programInfo: { attribLocations: { vertexPosition: number } },
  buffers: { position: WebGLBuffer | null }
): void {
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

function setColorInformation(
  gl: WebGLRenderingContext,
  programInfo: { attribLocations: { vertexColor: number } },
  buffers: { color: WebGLBuffer | null }
): void {
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
function drawScene(gl: WebGLRenderingContext, programInfo: any, buffers: any) {
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
  const vertexCount = 816;
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
  console.log(vertices);

  const glCircleLayer: CustomLayerInterface = {
    id: "colorCircle",
    type: "custom",

    onAdd: (map: mapboxgl.Map, gl: WebGL2RenderingContext) => {
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

    render: function (gl: WebGL2RenderingContext, matrix: number[]): void {
      //TODO only draws one circle:
      // look at the windgl code, there are many things rendered at the same time

      /*
      vertices.forEach((element: mapboxgl.MercatorCoordinate) => {
        console.log("in for each: ", element);
        buffers = initBuffers(gl, element);
        drawScene(gl, programInfo, buffers);
      });
      */
      buffers = initBuffers(gl, vertices);
      drawScene(gl, programInfo, buffers);
    },
  };

  map.addLayer(glCircleLayer);
}

/*

function drawLoop(
  gl: WebGL2RenderingContext,
  objectsToDraw: any[],
  bufferInfo: twgl.BufferInfo
): void {
  // ------ Draw the objects --------
  objectsToDraw.forEach(function (object) {
    const programInfo = object.programInfo;

    gl.useProgram(programInfo.program);

    // Setup all the needed attributes.
    gl.bindVertexArray(object.vertexArray);

    // Set the uniforms.
    twgl.setUniforms(programInfo, object.uniforms);

    // Draw
    twgl.drawBufferInfo(gl, bufferInfo);
  });
}

export function setupCircles(): void {
  const canvas = document.querySelector("#test_canvas") as HTMLCanvasElement;
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }
  canvas.style.position = "relative";

  const vertices = loadCustomData();
  console.log(vertices);

  const vs = getCircleVertexSource();
  const fs = getCircleFragmentSource();

  // setup GLSL program
  const programinfo = twgl.createProgramInfo(gl, [vs, fs]);
  const program = programinfo.program;
  const uniformSetters = twgl.createUniformSetters(gl, program);
  const attribSetters = twgl.createAttributeSetters(gl, program);

  const positions: any[] = [];
  for (const pos of vertices) {
    positions.push(...[pos.x, pos.y]);

    // use 100 points to draw the circle
    const totalPoints = 100;
    for (let i = 0; i <= totalPoints; i++) {
      positions.push(Math.cos((i * 2 * Math.PI) / totalPoints));
      positions.push(Math.sin((i * 2 * Math.PI) / totalPoints));
    }
  }

  twgl.setAttributePrefix("a_");

  // a single triangle
  const arrays: twgl.Arrays = {
    position: { numComponents: 3, data: [0, -10, 0, 10, 10, 0, -10, 10, 0] },
    texcoord: { numComponents: 2, data: [0.5, 0, 1, 1, 0, 1] },
    normal: { numComponents: 3, data: [0, 0, 1, 0, 0, 1, 0, 0, 1] },
  };
  const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

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

  const sphereBufferInfo = primitives.createSphereBufferInfo(gl, 10, 12, 6);
  const cubeBufferInfo = primitives.createCubeBufferInfo(gl, 20);
  const coneBufferInfo = primitives.createTruncatedConeBufferInfo(
    gl,
    10,
    0,
    20,
    12,
    1,
    true,
    false
  );

  //const vao = twgl.createVAOFromBufferInfo(gl, attribSetters, bufferInfo) as WebGLVertexArrayObject;
  const vao = twgl.createVAOFromBufferInfo(gl, attribSetters, bufferInfo);

  const uniformsThatAreTheSameForAllObjects = {
    uniformMatrix: [-50, 30, 100],
  };

  const uniformsThatAreComputedForEachObject = {
    uniformProjectionMatrix: twgl.m4.identity(),
  };

  const objectsToDraw = [
    {
      programInfo: programInfo,
      bufferInfo: sphereBufferInfo,
      vertexArray: sphereVAO,
      uniforms: sphereUniforms,
    },
    {
      programInfo: programInfo,
      bufferInfo: cubeBufferInfo,
      vertexArray: cubeVAO,
      uniforms: cubeUniforms,
    },
    {
      programInfo: programInfo,
      bufferInfo: coneBufferInfo,
      vertexArray: coneVAO,
      uniforms: coneUniforms,
    },
  ];

  const textures: string | any[] = [];

  // Draw the scene.
  function drawScene(time: number) {
    if (!gl) {
      return;
    }

    // eslint-disable-next-line no-param-reassign
    time = 5 + time * 0.0001;

    twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.DEPTH_TEST);

    // Compute the projection matrix
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projectionMatrix = twgl.m4.perspective(fieldOfViewRadians, aspect, 1, 2000);

    // Compute the camera's matrix using look at.
    const cameraPosition = [0, 0, 100];
    const target = [0, 0, 0];
    const up = [0, 1, 0];
    const cameraMatrix = twgl.m4.lookAt(
      cameraPosition,
      target,
      up,
      uniformsThatAreTheSameForAllObjects.u_viewInverse
    );

    // Make a view matrix from the camera matrix.
    const viewMatrix = twgl.m4.inverse(cameraMatrix);

    const viewProjectionMatrix = twgl.m4.multiply(projectionMatrix, viewMatrix);

    gl.useProgram(program);

    // Setup all the needed attributes.
    gl.bindVertexArray(vao);

    // Set the uniforms that are the same for all objects.
    twgl.setUniforms(uniformSetters, uniformsThatAreTheSameForAllObjects);
    drawLoop(gl, objectsToDraw, bufferInfo);

    requestAnimationFrame(drawScene);
  }

  requestAnimationFrame(drawScene);
}
*/
