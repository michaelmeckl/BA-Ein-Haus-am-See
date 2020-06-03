import mapboxgl from "mapbox-gl";

async function fetchAccessToken(url: string): Promise<string | void> {
  const token = await fetch(url, {
    method: "GET",
    cache: "no-cache",
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

function setupMap(accessToken: string): mapboxgl.Map {
  if (!mapboxgl.supported()) {
    throw new Error("Your browser does not support Mapbox GL!");
  }

  //const t2 = performance.now();
  console.time("load map");

  mapboxgl.accessToken = accessToken;

  const lat = 49.008;
  const lng = 12.1;
  const coordinates: [number, number] = [lng, lat];
  //const mapStyle = "mapbox://styles/michaelmeckl/ckajo8dpn22r41imzu1my2ekh";
  const mapStyle = "mapbox://styles/mapbox/streets-v11";
  const defaultZoom = 12;

  const map = new mapboxgl.Map({
    container: "map", // container id
    style: mapStyle, // stylesheet location
    center: coordinates, // starting position [lng, lat]
    zoom: defaultZoom, // starting zoom
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
      maxWidth: "none",
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

  return map;
}

async function test(): Promise<void> {
  console.log("NOT IMPLEMENTED:\nFetching data from osm ...");
}

/*
function filter(feature, layer): boolean {
  const isPolygon =
    feature.geometry &&
    feature.geometry.type !== undefined &&
    feature.geometry.type === "Polygon";

  if (isPolygon) {
    feature.geometry.type = "Point";
    //TODO: layer
    const polygonCenter = L.latLngBounds(
      feature.geometry.coordinates[0]
    ).getCenter();

    feature.geometry.coordinates = [polygonCenter.lat, polygonCenter.lng];
  }
  return true;
}

function onEachFeature(feature, layer) {
  var popupContent = "";
  var objectUrl = "http://overpass-api.de/api/interpreter?data=[out:json];" + feature.properties.type + "%28" + feature.properties.id + "%29;out;";
  $.get(objectUrl, function (objectDataAsJson) {
    popupContent = popupContent + "<dt>@id</dt><dd>" + feature.properties.type + "/" + feature.properties.id + "</dd>";
    var keys = Object.keys(objectDataAsJson.elements[0].tags);
    keys.forEach(function (key) {
      popupContent = popupContent + "<dt>" + key + "</dt><dd>" + objectDataAsJson.elements[0].tags[key] + "</dd>";
    });
    popupContent = popupContent + "</dl>"
    layer.bindPopup(popupContent);
  });
  */

/**
   * TODO: Falls jemand das Beispiel als Basis für ein eigenes Projekt nutzen möchte, dann sollte man sich zunächst
   *  um folgende Punkte kümmern:
- Löschen der vorhandenen Treffer bei erneuerter Abfrage
- Funktion onEachFeature() anpassen, sodass Treffer-Daten erst nach Anklicken geladen werden (nicht sofort)
- Laden von Daten über die Overpass API dem Anwender anzeigen, z.B. mit einem Spinner oder Ladebalken
- Fehlerbehandlung, falls die Overpass API einen Timeout wegen zu großer Datenmenge erzeugt
   */

async function fetchOsmData(mapBounds: string, query: string): Promise<void> {
  try {
    console.log("sending request!");
    const params = new URLSearchParams({
      bounds: mapBounds,
      osmQuery: query,
    });
    const url = "/osmRequest?" + params;

    console.log("url:" + url);

    const response = await fetch(url, {
      method: "GET",
    });

    //console.log(response);

    if (!response.ok) {
      throw new Error(
        `Request failed! Status ${response.status} (${response.statusText})`
      );
    }

    const answer = await response.text();
    //console.log("Answer:", answer);

    //TODO: zu map hinzufügen!
  } catch (error) {
    console.error(error);
  }
}

function setupUI(map: mapboxgl.Map): void {
  const getDataButton = document.querySelector("#getOSM");
  if (getDataButton) {
    getDataButton.addEventListener("click", test);
  }

  const queryInput = document.querySelector("#query-input") as HTMLInputElement;
  const queryButton = document.querySelector("#query-button");
  if (queryButton && queryInput) {
    queryButton.addEventListener("click", () => {
      // get input
      const query = queryInput.value;

      //get current bounding box, in order:
      //southern-most latitude, western-most longitude, northern-most latitude, eastern-most longitude
      //ganz Regensburg: 12.028,48.966,12.192,49.076
      //kleinerer Teil: 12.06075,48.98390,12.14537,49.03052
      // prettier-ignore
      const bounds = `${map.getBounds().getSouth()},${map.getBounds().getWest()},${map.getBounds().getNorth()},${map.getBounds().getEast()}`;

      // request data from osm
      fetchOsmData(bounds, query);
    });

    // add it as a separate layer / source? to the map
    /*
    var resultLayer = L.geoJson(resultAsGeojson, {
      style: function (feature) {
        return {color: "#ff0000"};
      }
      filter: function (feature, layer) {
              var isPolygon = (feature.geometry) && (feature.geometry.type !== undefined) && (feature.geometry.type === "Polygon");
              if (isPolygon) {
                feature.geometry.type = "Point";
                var polygonCenter = L.latLngBounds(feature.geometry.coordinates[0]).getCenter();
                feature.geometry.coordinates = [ polygonCenter.lat, polygonCenter.lng ];
              }
              return true;
            },
      onEachFeature: function (feature, layer) {
        var popupContent = "";
        var objectUrl = "http://overpass-api.de/api/interpreter?data=[out:json];" + feature.properties.type + "%28" + feature.properties.id + "%29;out;";
        $.get(objectUrl, function (objectDataAsJson) {
          popupContent = popupContent + "<dt>@id</dt><dd>" + feature.properties.type + "/" + feature.properties.id + "</dd>";
          var keys = Object.keys(objectDataAsJson.elements[0].tags);
          keys.forEach(function (key) {
            popupContent = popupContent + "<dt>" + key + "</dt><dd>" + objectDataAsJson.elements[0].tags[key] + "</dd>";
          });
          popupContent = popupContent + "</dl>"
          layer.bindPopup(popupContent);
        });
    }).addTo(map);
    */
  }
}

async function init(): Promise<void> {
  try {
    const token = await fetchAccessToken("/token");
    if (!token) {
      throw new Error("Map couldn't be loaded! Invalid Mapbox Token:" + token);
    }

    const t0 = performance.now();
    const map = setupMap(token);
    const t1 = performance.now();
    console.log("SetupMap took " + (t1 - t0) + " milliseconds.");

    setupUI(map);
  } catch (error) {
    console.log(error);
  }
}

init();
