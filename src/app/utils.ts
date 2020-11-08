const SNACKBAR_DEFAULT_DURATION = 2000; // 2 seconds

export const enum SnackbarType {
  SUCCESS = "#14bd5a",
  ERROR = "#b61919",
  WARNING = "#f5a81b",
  INFO = "cornflowerblue",
  DEFAULT = "darkviolet",
}

const snackbar = document.querySelector("#snackbar") as HTMLDivElement;

export function hideSnackbar(): void {
  snackbar.className = snackbar.className.replace("show", "");
}

export function showSnackbar(
  message: string,
  type: SnackbarType = SnackbarType.DEFAULT,
  duration = SNACKBAR_DEFAULT_DURATION,
  hideManually = false // if true the snackbar has to be hidden manually and the duration is ignored
): void {
  //set the snackbar's message and color
  snackbar.textContent = message;
  snackbar.style.backgroundColor = type;
  //show it
  snackbar.className = "show";

  if (!hideManually) {
    // hide the snackbar after the given duration
    setTimeout(() => {
      hideSnackbar();
    }, duration);
  }
}

export function getTagForLayer(layerID: string): string {
  //const regex = /[=~]/;
  return layerID.split("-")[0]; //the first part of the layer id is the tag name (e.g. "Restaurant")
}
