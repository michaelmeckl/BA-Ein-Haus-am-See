import type { FilterLayer } from "./filterLayer";

class FilterManager {
  allFilterLayers: FilterLayer[] = []; //TODO use a set?

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

  //TODO remove map data in here? so everything is in one place?
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

  //TODO for schleife umdrehen?
  removeFilterLayer(name: string): void {
    for (let index = 0; index < this.allFilterLayers.length; index++) {
      const layer = this.allFilterLayers[index];
      if (layer.LayerName === name) {
        this.allFilterLayers.splice(index, 1);
      }
    }
  }
}

export default new FilterManager();
