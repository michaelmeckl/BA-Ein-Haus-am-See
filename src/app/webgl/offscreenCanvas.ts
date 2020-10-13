//Example for offscreen canvas:
//TODO use the worker.ts file to implement this

//on the main thread:
function createOffscreenCanvas(): void {
  const canvas = document.getElementById("myCanvas");
  if (!canvas) {
    return;
  }

  if (!("transferControlToOffscreen" in canvas)) {
    throw new Error("webgl in worker unsupported");
  }

  const offscreen = canvas.transferControlToOffscreen();
  const worker = new Worker("worker.js");
  worker.postMessage({ canvas: offscreen }, [offscreen]);
}

// on the worker thread (worker.js)

function createContext(canvas) {
  var gl = canvas.getContext("webgl");
  //...
}

onmessage = function (e) {
  if (e.data.canvas) {
    createContext(e.data.canvas);
  }
};
