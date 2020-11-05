import { map } from "./mapboxConfig";
import MapboxFPS = require("../vendors/MapboxFPS");
import FrameRateControl from "../vendors/mapbox-gl-framerate";

/**
 * This class is used to control performance measuring for the mapbox map.
 */
export class PerformanceMeasurer {
  //TODO
  startMeasuring(): void {
    //1.
    const fpsControl = new MapboxFPS.FPSControl();
    map.addControl(fpsControl, "bottom-right");
    /*
    //* logs a small report all 5 seconds to the console
    setInterval(function () {
      const report = fpsControl.measurer.getMeasurementsReport();
      console.log("Report:", report);
    }, 5000); // alle 5 Sekunden
    */

    //2.
    const fps: any = new FrameRateControl({});
    map.addControl(fps);
  }
}
