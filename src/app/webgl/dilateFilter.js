import * as twgl from "twgl.js";
import {
    map,
} from "../map/mapboxConfig";
import {
    getDilateFS,
    getVSForDilateAndGaussBlur,
} from "./shaders";

const renderCanvas = document.createElement("canvas");
let glProgram;
const sourceTextureSize = [0, 0];

let renderImageCoordinatesBuffer;
let renderImageTexureCoordinatesBuffer;

const textures = [];
const framebuffers = [];

let sourceTextureImage;
let sourceTexture;

function initialSetup(gl) {
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
        getDilateFS(),
    ]);
}

function setupSourceTexture(gl) {
    sourceTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceTextureImage);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    //gl.bindTexture(gl.TEXTURE_2D, null); // is this call needed? jvm

    sourceTextureSize[0] = sourceTextureImage.width;
    sourceTextureSize[1] = sourceTextureImage.height;
};

function setupFrameBuffers(gl) {
    for (let ii = 0; ii < 2; ++ii) {
        // create a texture for the framebuffer
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // do this now at end? or not needed for intermediates? jvm
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sourceTextureImage.width, sourceTextureImage.height, 0,
            gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        textures.push(texture);

        // create a framebuffer
        const fbo = gl.createFramebuffer();
        framebuffers.push(fbo);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

        // attach texture to frame buffer
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }
}

function render(gl) {
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

    // (debug - run once. uncomment these lines and set "last" to -1)
    //gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    //gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const last = 2;
    let i;
    for (i = 0; i < last; ++i) {
        // set the frame buffer to render into
        if (i < last - 1) {
            // render into one of the texture framebuffers
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[i % 2]);
        } else {
            // use the canvas frame buffer for last render
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        //gl.viewport(0, 0, renderCanvas.width, renderCanvas.height); is this needed for the intermediate results?

        // the primitive, triggers the fragment shader
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // switch the source texture
        gl.bindTexture(gl.TEXTURE_2D, textures[i % 2]);
    }
}

export function createDilateFilter(texture) {
    sourceTextureImage = texture;
    const gl = renderCanvas.getContext("webgl2");
    if (!gl) {
        throw new Error("Couldn't get a webgl context for combining the overlays!");
    }

    initialSetup(gl);
    setupSourceTexture(gl);
    setupFrameBuffers(gl); // 2 extra framebuffers for intermediate results in iterative filters and pipelines
    renderCanvas.height = sourceTextureImage.height;
    renderCanvas.width = sourceTextureImage.width;
    render(gl);
    return renderCanvas;
}