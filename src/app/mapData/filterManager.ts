import Benchmark from "../../shared/benchmarking";
import type { FilterLayer } from "./filterLayer";

class FilterManager {
  allFilterLayers: FilterLayer[] = [];

  activeFilters: Set<string> = new Set();

  constructor() {
    /*
    console.warn(
      "DEVELOPMENT: You should only see this warning once at the beginning. If this shows up more than once there's a problem!"
    );
    */
  }

  addFilter(filterLayer: FilterLayer): void {
    this.allFilterLayers.push(filterLayer);
    this.activeFilters.add(filterLayer.LayerName);
  }

  removeFilter(filter: string): void {
    this.removeFilterLayer(filter);
    this.activeFilters.delete(filter);
  }

  getFilterLayer(name: string): FilterLayer | null {
    for (let index = 0; index < this.allFilterLayers.length; index++) {
      const layer = this.allFilterLayers[index];
      if (layer.LayerName === name) {
        return layer;
      }
    }
    return null;
  }

  private removeFilterLayer(name: string): void {
    for (let index = 0; index < this.allFilterLayers.length; index++) {
      const layer = this.allFilterLayers[index];
      if (layer.LayerName === name) {
        this.allFilterLayers.splice(index, 1);
      }
    }
  }

  /**
   * ! Has to be called on every overlay update to recalculate the geojson polygons in point/screen coords.
   * ! Otherwise they would not be in sync with the map!!
   */
  recalculateScreenCoords(): void {
    Benchmark.startMeasure("recalculate all Screen Coords");
    this.allFilterLayers.forEach((filterLayer) => {
      filterLayer.calculatePointCoordsForFeatures();
    });
    Benchmark.stopMeasure("recalculate all Screen Coords");
  }

  /**
   * Reset all Filter layers.
   */
  clearAllFilters(): void {
    this.allFilterLayers.length = 0;
    this.activeFilters.clear();
  }
}

export default new FilterManager();
