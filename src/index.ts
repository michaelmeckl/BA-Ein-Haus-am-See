/* eslint-env node */

import fs from "fs";
import express from "express";

const app = express();
const PORT = 8000;

function init(): void {
  app.use(express.static("src"));

  app.get("/", (req, res) => {
    res.send("Hello World!");
  });

  app.listen(PORT, (err) => {
    if (err) {
      return console.error(err);
    }
    return console.log(`Server is listening on ${PORT}`);
  });
}

init();
