import mapboxgl from "mapbox-gl";

async function fetchAccessToken(url: string): Promise<string | void> {
  const token = await fetch(url, {
    method: "GET",
    cache: "no-cache"
  })
    .then((response) => response.text())
    .then((data) => {
      return data;
    })
    .catch((err) => {
      console.log("Fetch problem: " + err.message);
    });

  return token;
}

function setupMap(accessToken: string): void {
  //const t2 = performance.now();
  console.time("load map");

  mapboxgl.accessToken = accessToken;

  const lat = 49.008;
  const lng = 12.1;
  const coordinates: [number, number] = [lng, lat];
  const mapStyle = "mapbox://styles/michaelmeckl/ckajo8dpn22r41imzu1my2ekh";
  //const mapStyle = "mapbox://styles/mapbox/streets-v11";
  const defaultZoom = 12;

  const map = new mapboxgl.Map({
    container: "map", // container id
    style: mapStyle, // stylesheet location
    center: coordinates, // starting position [lng, lat]
    zoom: defaultZoom // starting zoom
  });

  /*
  // set the initial view bounds, in this case the USA
  map.fitBounds([
      [-133.2421875, 16.972741],
      [-47.63671875, 52.696361]
  ]);
  */

  //set cursor style to mouse pointer
  map.getCanvas().style.cursor = "default";

  // Add map controls
  map.addControl(new mapboxgl.NavigationControl());

  map.on("load", async () => {
    //const t3 = performance.now();
    //console.log("Loading map took " + (t3 - t2) + " milliseconds.");
    console.timeEnd("load map");

    console.log("Map is loaded!");
    const marker = new mapboxgl.Marker().setLngLat(coordinates).addTo(map);
  });

  map.on("click", function (e) {
    console.log("Click:", e);

    const popup = new mapboxgl.Popup({
      offset: [0, -30],
      closeOnMove: true,
      maxWidth: "none"
    })
      /*
      .setLngLat(feature.geometry.coordinates)
      .setHTML('<h3>' + feature.properties.title + '</h3><p>' + feature.properties.description +
          '</p>')
      */
      .setLngLat(coordinates)
      .setHTML(
        "<h1>Universität Regensburg</h1><p>Beschreibungstext für Uni</p>"
      )
      .addTo(map);
  });
}

async function test(): Promise<void> {
  console.log("Fetching data from osm ...");

  /*
  //TODO: direkt hier auf api zugreifen oder über umweg auf server??
  const geodata = await fetch("/amenity/restaurant", {
      method: "POST",
      cache: "no-cache"
  });*/
}

function setupUI(): void {
  const getDataButton = document.querySelector("#getOSM");
  if (getDataButton) {
    getDataButton.addEventListener("click", test);
  }
}

async function init(): Promise<void> {
  try {
    const token = await fetchAccessToken("/token");
    if (!token) {
      throw new Error("Map couldn't be loaded! Invalid Mapbox Token:" + token);
    }

    const t0 = performance.now();
    setupMap(token);
    const t1 = performance.now();
    console.log("SetupMap took " + (t1 - t0) + " milliseconds.");

    setupUI();
  } catch (error) {
    console.log(error);
  }
}

init();
