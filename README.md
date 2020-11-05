# Overview

This repository contains the code for my bachelor thesis"Ein Haus am See im Browser - Interaktives Finden von geeigneten Orten" at the University of Regensburg. The developed website shows an interactive map provided by Mapbox GL that allows the user to specify several criteria and highlights suitable regions on the map based on these preferences. The website is meant as an early tool that could be used when searching for places or areas (e.g. when moving to a new city) that fulfill certain requirements as existing websites and tools don't support this type of local search well.

Made with Mapbox GL & OpenStreetMap.

## Requirements
The application needs a redis instance as well as the docker version of the Overpass-API running locally to work so these need to be setup before running the application. The docker version of the overpass api can be installed from Dockerhub (**Link TODO**). For detailed instructions on how to set this up, see **TODO wiktorn dockerhub**. The application assumes the Redis Instance is available at port **TODO** and the local Overpass API runs at **TODO**. You can of course change this in the code itself.


## Build Instructions

If the requirements are fullfilled you can run the application locally by executing the following commands in the root folder:

```
npm install
npm start
```

If everything worked well you can visit the website in your browser at <http://localhost:8000>. Note that the application uses WebGL and some other newer web technologies that may not be supported in all browsers (certainly not in IE). The application was only tested in current versions of Google Chrome and Firefox so I recommend using one of these.

## Demo

**TODO add screenshot and / or GIF**

## License

The project is licensed under the MIT License.
