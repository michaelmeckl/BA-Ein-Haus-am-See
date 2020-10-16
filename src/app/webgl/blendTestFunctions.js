// alpha blending of 2 images in proportion 50-50
function blendTwoImages() {
    const img1 = document.getElementById("img1");
    const img2 = document.getElementById("img2");
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    const width = img1.width;
    const height = img1.height;
    canvas.width = width;
    canvas.height = height;

    let pixels = 4 * width * height;
    context.drawImage(img1, 0, 0);
    const image1 = context.getImageData(0, 0, width, height);
    const imageData1 = image1.data;
    context.drawImage(img2, 0, 0);
    const image2 = context.getImageData(0, 0, width, height);
    const imageData2 = image2.data;
    while (pixels--) {
        imageData1[pixels] = imageData1[pixels] * 0.5 + imageData2[pixels] * 0.5;
    }
    image1.data = imageData1;
    context.putImageData(image1, 0, 0);
}

// Ablauf für Textures in WebGL:

/*
// see https://stackoverflow.com/questions/11595694/how-can-i-use-the-multiply-blend-mode-on-a-canvas-in-real-time:

1.Let your visible canvas be a WebGL canvas.
2.Create two textures; call them "source" and "destination".
3.Render your invisible-canvas content to the "source" texture; this can be done either using WebGL drawing operations directly (using no extra canvas) or by uploading your 2D invisible canvas's contents to the texture (this is a built-in operation):

    var sourceTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas)
    // ...also set texture filters — see any WebGL tutorial...

4. Render the other content to be multiplied to the "destination" texture.

5.Finally, targeting the actual visible canvas, use a fragment shader to multiply the "source" and "destination" textures. The techniques here are those used for post-processing effects — I recommend looking up such a tutorial or simple example. Briefly, to apply a fragment shader to the entire canvas, you draw a full-screen quad - geometry that covers the entire viewport. The vertex shader is trivial, and the fragment shader would be like:

    varying vec2 texCoord;
    uniform sampler2D sourceTexture;
    uniform sampler2D destTexture;
    void main(void) {
        gl_FragColor = texture2D(sourceTexture, texCoord) * texture2D(destTexture, texCoord);
    }
*/