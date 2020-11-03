import * as twgl from "twgl.js";
import {
    getGaussianBlurFS,
    getVSForDilateAndGaussBlur,
} from "./shaders";

const renderCanvas = document.createElement("canvas");
const sourceTextureSize = [0, 0];

let glProgram;

let renderImageCoordinatesBuffer;
let renderImageTexureCoordinatesBuffer;

let gl;

export function createGaussianBlurFilter() {
    gl = renderCanvas.getContext("webgl2");
    if (!gl) {
        throw new Error("Couldn't get a webgl context for combining the overlays!");
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0); // black, fully opaque
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL); // Near things obscure far things

    // buffers for the textured plane in normalized space
    renderImageCoordinatesBuffer = gl.createBuffer();
    renderImageTexureCoordinatesBuffer = gl.createBuffer();
    const renderImageVertices = [-1., -1., 0., 1., -1., 0., -1., 1., 0., 1., 1., 0.];
    gl.bindBuffer(gl.ARRAY_BUFFER, renderImageCoordinatesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(renderImageVertices), gl.STATIC_DRAW);

    const renderImageTextureCoordinates = [0, 0, 1, 0, 0, 1, 1, 1];
    gl.bindBuffer(gl.ARRAY_BUFFER, renderImageTexureCoordinatesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(renderImageTextureCoordinates), gl.STATIC_DRAW);

    // create and link program
    glProgram = twgl.createProgramFromSources(gl, [
        getVSForDilateAndGaussBlur(),
        getGaussianBlurFS(),
    ]);

    // the coordinate attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, renderImageCoordinatesBuffer);
    const coordinateLocation = gl.getAttribLocation(glProgram, "coordinate");
    gl.enableVertexAttribArray(coordinateLocation);
    gl.vertexAttribPointer(coordinateLocation, 3, gl.FLOAT, false, 0, 0);

    // the textureCoordinate attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, renderImageTexureCoordinatesBuffer);
    const textureCoordinateLocation = gl.getAttribLocation(glProgram, "textureCoordinate");
    gl.enableVertexAttribArray(textureCoordinateLocation);
    gl.vertexAttribPointer(textureCoordinateLocation, 2, gl.FLOAT, false, 0, 0);

}

function setupSourceTexture(gl, sourceTextureImage) {
    const sourceTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    //gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); //* premultiply is necessary for blurring?
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceTextureImage);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    //gl.bindTexture(gl.TEXTURE_2D, null);

    return sourceTexture;
}

function render(gl, sourceTexture) {
    gl.viewport(0, 0, renderCanvas.width, renderCanvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(glProgram);

    // set up the sourceTextureSize
    gl.uniform2f(gl.getUniformLocation(glProgram, "sourceTextureSize"), sourceTextureSize[0], sourceTextureSize[1]);

    // set up the sourceTexelSize
    gl.uniform2f(gl.getUniformLocation(glProgram, "sourceTexelSize"), 1.0 / sourceTextureSize[0], 1.0 / sourceTextureSize[1]);

    // the sourceTexture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.uniform1i(gl.getUniformLocation(glProgram, "sourceTextureSampler"), 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export function applyGaussianBlur(textures) {
    // all textures have the same size:
    sourceTextureSize[0] = textures[0].width;
    sourceTextureSize[1] = textures[0].height;
    renderCanvas.height = textures[0].height;
    renderCanvas.width = textures[0].width;

    // setup textures
    const textureArr = [];
    for (let ii = 0; ii < textures.length; ++ii) {
        const texture = setupSourceTexture(gl, textures[ii]);
        textureArr.push(texture);
    }

    textureArr.forEach(element => {
        render(gl, element);
    });

    return renderCanvas;
}