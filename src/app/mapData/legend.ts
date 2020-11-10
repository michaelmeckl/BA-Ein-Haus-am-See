import { Config } from "../../shared/config";

/**
 * Legend with the current layers on the map and their corresponding colors.
 */
export default class Legend {
  private legendElement: HTMLDivElement;

  private legendContent = new Map<string, string>();

  constructor() {
    this.legendElement = document.querySelector("#legend") as HTMLDivElement;
  }

  private renderLegendItem(layer: string, color: string): void {
    const item = document.createElement("div");
    item.id = layer;

    const key = document.createElement("span");
    key.className = "legend-key";
    key.style.backgroundColor = color;

    const value = document.createElement("span");
    value.innerHTML = layer;
    item.appendChild(key);
    item.appendChild(value);

    this.legendElement.appendChild(item);
  }

  /**
   * Call this method to show the legend initially or after it was hidden.
   */
  show(layer: string, color: string): void {
    /*
    if (layerList.length !== colorList.length) {
      console.warn("Legend can't be shown! Layer and Color list must have equal length!");
      return;
    }
    */

    this.legendContent.set(layer, color);

    this.legendElement.classList.remove(Config.CSS_HIDDEN);

    this.renderLegendItem(layer, color);
    /*
    for (let i = 0; i < layerList.length; i++) {
      const layer = layerList[i];
      const color = colorList[i];
      this.renderLegendItem(layer, color);
    }
    */
  }

  hide(): void {
    this.legendElement.classList.add(Config.CSS_HIDDEN);

    //clear layers and colors
    this.legendContent.clear();
  }

  addItem(layer: string, color: string): void {
    this.legendContent.set(layer, color);
    this.renderLegendItem(layer, color);
  }

  /*
  showItem(layer: string, color: string): void {
    const id = layer;
    const el = document.querySelector(`#${id}`);
    el?.classList.remove(Config.CSS_HIDDEN);
  }

  hideItem(layer: string, color: string): void {
    const id = layer;
    const el = document.querySelector(`#${id}`);
    el?.classList.add(Config.CSS_HIDDEN);

    //TODO hide legend if this was the only one?
  }
  */

  removeItem(layer: string, color: string): boolean {
    //this.layers = this.layers.filter((l) => l !== layer);
    //this.colors = this.colors.filter((c) => c !== color);
    this.legendContent.delete(layer);

    const id = layer;
    const el = document.querySelector(`#${id}`);
    el?.remove();
    //this.legendElement.removeChild(el);

    if (this.legendContent.size === 0) {
      //this was the only/last item in the legend
      return true;
    }
    return false;
  }
}
