const SNACKBAR_DEFAULT_DURATION = 3000; // 3 seconds

export const enum SnackbarType {
  SUCCESS = "#14bd5a",
  ERROR = "#b61919",
  INFO = "cornflowerblue",
  DEFAULT = "darkviolet",
}

export function showSnackbar(
  message: string,
  type: SnackbarType = SnackbarType.DEFAULT,
  duration = SNACKBAR_DEFAULT_DURATION
): void {
  const snackbar = document.querySelector("#snackbar") as HTMLDivElement;
  if (!snackbar) {
    console.warn("Snackbar Div wasn't found!");
    return;
  }

  //set the snackbar's message and color and show it
  snackbar.textContent = message;
  snackbar.style.backgroundColor = type;
  snackbar.className = "show";

  // hide the snackbar after the given duration
  setTimeout(function () {
    snackbar.className = snackbar.className.replace("show", "");
  }, duration);
}
