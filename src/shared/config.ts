/**
 * Immutable configuration constants for client and server.
 */
export const Config = {
  // The token should be saved in an .env - file for production and made accessible over something like dotenv,
  // but for the sake of simplicity it is declared as const config variable here.
  MAPBOX_TOKEN:
    "pk.eyJ1IjoibWljaGFlbG1lY2tsIiwiYSI6ImNrYWNyMnd1bjA5aHAycnByamgzZHd6bTEifQ.33Midnjfp-CccC19KMMJSQ",
  SERVER_PORT: 8000,
  CSS_HIDDEN: "hidden",
} as const;
