/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Feature, FeatureCollection, GeoJsonProperties } from "geojson";
import mapboxgl, { LngLatLike, LngLat } from "mapbox-gl";
import { map } from "./mapboxConfig";
import distance from "@turf/distance";
import * as turfHelpers from "@turf/helpers";
import { fetchOsmData, fetchOsmDataFromClientVersion } from "../network/networkUtils";
import osmTagCollection from "../osmModel/osmTagCollection";
import geojsonCoords from "@mapbox/geojson-coords";

const houses = {
  type: "FeatureCollection",
  features: [] as Feature<any, GeoJsonProperties>[],
};

const housesQuery = osmTagCollection.getAllHousesQuery();

/**
 * Assign a unique id to each house. You'll use this `id`
 * later to associate each point on the map with a listing
 * in the sidebar.
 */
function assignID(): void {
  houses.features.forEach((house: Feature<any, GeoJsonProperties>, i: number) => {
    //house.properties = Object.assign(house.properties, { id: i});
    if (house.properties) {
      house.properties.id = i;
    }
  });
}

/**
 * Use Mapbox GL JS's `flyTo` to move the camera smoothly to
 * a given center point.
 **/
function flyToHouse(currentFeature: Feature<any, GeoJsonProperties>): void {
  const flattenedCoords = geojsonCoords(currentFeature);
  map.flyTo({
    center: flattenedCoords[0], //TODO
    zoom: 15,
  });
}

/**
 * Create a Mapbox GL JS `Popup`.
 **/
function createPopUp(currentFeature: Feature<any, GeoJsonProperties>): void {
  const props = currentFeature.properties;
  if (!props) {
    return;
  }

  const popUps = document.getElementsByClassName("mapboxgl-popup");
  if (popUps[0]) {
    popUps[0].remove();
  }

  const flattenedCoords = geojsonCoords(currentFeature);
  const address = props["addr:street"] + props["addr:housenumber"] || "Adresse unbekannt";
  const name = props.name || "Name unbekannt";

  const popup = new mapboxgl.Popup({ closeOnClick: true })
    .setLngLat(flattenedCoords[0])
    .setHTML(`<h3>${name}</h3><p>${address}</p>`)
    .addTo(map);
}

/**
 * Add a marker to the map for every listing.
 **/
function addMarkers(): void {
  /* For each feature in the houses GeoJSON object above: */
  houses.features.forEach(function (marker) {
    if (!marker.properties) {
      return;
    }

    /* Create a div element for the marker. */
    const el = document.createElement("div");
    /* Assign a unique `id` to the marker. */
    el.id = "marker-" + marker.properties.id;
    /* Assign the `marker` class to each marker for styling. */
    el.className = "marker";

    const flattenedCoords = geojsonCoords(marker);
    /**
     * Create a marker using the div element
     * defined above and add it to the map.
     **/
    //TODO at the moment simply the first point is taken if it is a linestring or polygon
    new mapboxgl.Marker(el, { offset: [0, -23] }).setLngLat(flattenedCoords[0]).addTo(map);

    /**
     * Listen to the element and when it is clicked, do three things:
     * 1. Fly to the point
     * 2. Close all other popups and display popup for clicked house
     * 3. Highlight listing in sidebar (and remove highlight for all other listings)
     **/
    el.addEventListener("click", (e) => {
      /* Fly to the point */
      flyToHouse(marker);
      /* Close all other popups and display popup for clicked house */
      createPopUp(marker);
      /* Highlight listing in sidebar */
      const activeItem = document.getElementsByClassName("active");
      e.stopPropagation();
      if (activeItem[0]) {
        activeItem[0].classList.remove("active");
      }
      const listing = document.getElementById("listing-" + marker?.properties?.id);
      listing?.classList.add("active");
    });
  });
}

/**
 * Add a listing for each location to the sidebar.
 **/
function buildLocationList(data: {
  type: string;
  features: Feature<any, GeoJsonProperties>[];
}): void {
  data.features.forEach((house) => {
    /**
     * Create a shortcut for `house.properties`,
     * which will be used several times below.
     **/
    const prop = house.properties;
    /* Add a new listing section to the sidebar. */
    const listings = document.querySelector("#location-listings");

    if (!listings || !prop) {
      return;
    }

    const listing = listings.appendChild(document.createElement("div"));
    /* Assign a unique `id` to the listing. */
    listing.id = "listing-" + prop.id;
    /* Assign the `item` class to each listing for styling. */
    listing.className = "item";

    /* Add the link to the individual listing created above. */
    const link = listing.appendChild(document.createElement("a"));
    link.href = "#";
    link.className = "title";
    link.id = "link-" + prop.id;
    link.innerHTML = prop.name ? prop.name : "Name unbekannt";

    /* Add details to the individual listing. */
    const details = listing.appendChild(document.createElement("div"));
    details.innerHTML = "Adresse: ";
    if (prop["addr:street"]) {
      details.innerHTML += `${prop["addr:street"]} ${prop["addr:housenumber"]}`;
    } else {
      details.innerHTML += "unbekannt";
    }

    //TODO prop.distance isn't implemented right now!
    if (prop.distance) {
      const roundedDistance = Math.round(prop.distance * 100) / 100;
      details.innerHTML += "<p><strong>" + roundedDistance + " kilometers away</strong></p>";
    }

    /**
     * Listen to the element and when it is clicked, do four things:
     * 1. Update the `currentFeature` to the house associated with the clicked link
     * 2. Fly to the point
     * 3. Close all other popups and display popup for clicked house
     * 4. Highlight listing in sidebar (and remove highlight for all other listings)
     **/
    link.addEventListener("click", function () {
      for (let i = 0; i < data.features.length; i++) {
        if (this.id === "link-" + data.features[i]?.properties?.id) {
          const clickedListing = data.features[i];
          flyToHouse(clickedListing);
          createPopUp(clickedListing);
        }
      }
      const activeItem = document.getElementsByClassName("active");
      if (activeItem[0]) {
        activeItem[0].classList.remove("active");
      }
      //@ts-expect-error
      this.parentNode?.classList.add("active");
    });
  });
}

function getBbox(
  sortedhouses: any,
  houseIdentifier: number,
  searchResult: mapboxgl.LngLat
): [[number, number], [number, number]] {
  const lats = [sortedhouses.features[houseIdentifier].geometry.coordinates[1], searchResult.lat];
  const lons = [sortedhouses.features[houseIdentifier].geometry.coordinates[0], searchResult.lng];
  const sortedLons = lons.sort(function (a, b) {
    if (a > b) {
      return 1;
    }
    if (a.distance < b.distance) {
      return -1;
    }
    return 0;
  });
  const sortedLats = lats.sort(function (a, b) {
    if (a > b) {
      return 1;
    }
    if (a.distance < b.distance) {
      return -1;
    }
    return 0;
  });
  return [
    [sortedLons[0], sortedLats[0]],
    [sortedLons[1], sortedLats[1]],
  ];
}

//TODO: this function is not used yet
//TODO -> needs to be called at first with a point from where to sort the distances !! (-> let user define??)
export function sortDistances(point: LngLat): void {
  console.log(point);
  const clickedPoint = turfHelpers.point(point.toArray());
  console.log(clickedPoint);

  //TODO
  /*
  geocoder.on('result', function (ev) {
    var searchResult = ev.result.geometry;

    var options = { units: 'miles' };
    houses.features.forEach(function (house) {
      Object.defineProperty(house.properties, 'distance', {
        value: turf.distance(searchResult, house.geometry, options),
        writable: true,
        enumerable: true,
        configurable: true
      });
    });
    */

  houses.features.forEach(function (house: any) {
    Object.defineProperty(house.properties, "distance", {
      //@ts-expect-error
      value: distance(clickedPoint, house.geometry, { units: "kilometers" }),
      //value: point.distanceTo(house.geometry.coordinates),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  });

  houses.features.sort(function (a: any, b: any) {
    if (a.properties.distance > b.properties.distance) {
      return 1;
    }
    if (a.properties.distance < b.properties.distance) {
      return -1;
    }
    return 0; // a must be equal to b
  });

  // then there needs to be a distance property on each geojson from the beginning to be sortable
  const listings = document.querySelector("#location-listings");
  while (listings?.firstChild) {
    listings.removeChild(listings.firstChild);
  }
  buildLocationList(houses);

  const bbox = getBbox(houses, 0, point);
  map.fitBounds(bbox, {
    padding: 100,
  });

  createPopUp(houses.features[0]);

  const activeListing = document.getElementById("listing-" + houses.features[0]?.properties?.id);
  activeListing?.classList.add("active");
}

//! alle Häuser, Apartments, Terraces und Wohnheime in Regensburg (z:12.82; 49.0122/12.09167) zu holen (ca. 2360 Elemente)
//! und dann auf der Karte anzuzeigen ist zu viel für ihn
//! ca. 1- 5 fps durchgehend danach :(
export async function loadLocations(): Promise<void> {
  assignID();

  const currBounds = map.getBounds();
  const southLat = currBounds.getSouth();
  const westLng = currBounds.getWest();
  const northLat = currBounds.getNorth();
  const eastLng = currBounds.getEast();

  //TODO maybe fetch all Houses in an city at the start in a webworker so they are loaded faster later on?
  const boundingBox = `${southLat},${westLng},${northLat},${eastLng}`;
  const houseData = await fetchOsmDataFromClientVersion(boundingBox, housesQuery);
  //console.log("HouseData: ", houseData);
  houses.features.push(...houseData?.features);

  if (houses.features.length > 0) {
    map.addSource("houses", {
      type: "geojson",
      data: houses as FeatureCollection,
    });

    buildLocationList(houses);
    addMarkers();
  } else {
    console.warn("Couldn't fetch house data from openstreetmap!");
  }
}
