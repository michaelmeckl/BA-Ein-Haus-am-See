/**
 * Immutable configuration constants for client and server.
 */
export const Config = {
  PUBLIC_MAPBOX_TOKEN:
    "pk.eyJ1IjoibWljaGFlbG1lY2tsIiwiYSI6ImNrYWNyMnd1bjA5aHAycnByamgzZHd6bTEifQ.33Midnjfp-CccC19KMMJSQ",
  SERVER_PORT: 8000,
  REDIS_PORT: 6379,
  OVERPASS_PORT: 12347,
  CSS_HIDDEN: "hidden",
  CSS_BTN_DISABLED: "button-disabled",
} as const;
