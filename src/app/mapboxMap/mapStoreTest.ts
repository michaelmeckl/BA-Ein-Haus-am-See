import type { FeatureCollection } from "geojson";
import mapboxgl, { LngLatLike, LngLat } from "mapbox-gl";
import { map } from "./mapboxConfig";
import distance from "@turf/distance";
import * as turfHelpers from "@turf/helpers";

const stores = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-77.034084142948, 38.909671288923],
      },
      properties: {
        phoneFormatted: "(202) 234-7336",
        phone: "2022347336",
        address: "1471 P St NW",
        city: "Washington DC",
        country: "United States",
        crossStreet: "at 15th St NW",
        postalCode: "20005",
        state: "D.C.",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-77.049766, 38.900772],
      },
      properties: {
        phoneFormatted: "(202) 507-8357",
        phone: "2025078357",
        address: "2221 I St NW",
        city: "Washington DC",
        country: "United States",
        crossStreet: "at 22nd St NW",
        postalCode: "20037",
        state: "D.C.",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-77.043929, 38.910525],
      },
      properties: {
        phoneFormatted: "(202) 387-9338",
        phone: "2023879338",
        address: "1512 Connecticut Ave NW",
        city: "Washington DC",
        country: "United States",
        crossStreet: "at Dupont Circle",
        postalCode: "20036",
        state: "D.C.",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-77.0672, 38.90516896],
      },
      properties: {
        phoneFormatted: "(202) 337-9338",
        phone: "2023379338",
        address: "3333 M St NW",
        city: "Washington DC",
        country: "United States",
        crossStreet: "at 34th St NW",
        postalCode: "20007",
        state: "D.C.",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-77.002583742142, 38.887041080933],
      },
      properties: {
        phoneFormatted: "(202) 547-9338",
        phone: "2025479338",
        address: "221 Pennsylvania Ave SE",
        city: "Washington DC",
        country: "United States",
        crossStreet: "btwn 2nd & 3rd Sts. SE",
        postalCode: "20003",
        state: "D.C.",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-76.933492720127, 38.99225245786],
      },
      properties: {
        address: "8204 Baltimore Ave",
        city: "College Park",
        country: "United States",
        postalCode: "20740",
        state: "MD",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-77.097083330154, 38.980979],
      },
      properties: {
        phoneFormatted: "(301) 654-7336",
        phone: "3016547336",
        address: "4831 Bethesda Ave",
        cc: "US",
        city: "Bethesda",
        country: "United States",
        postalCode: "20814",
        state: "MD",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-77.359425054188, 38.958058116661],
      },
      properties: {
        phoneFormatted: "(571) 203-0082",
        phone: "5712030082",
        address: "11935 Democracy Dr",
        city: "Reston",
        country: "United States",
        crossStreet: "btw Explorer & Library",
        postalCode: "20190",
        state: "VA",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-77.10853099823, 38.880100922392],
      },
      properties: {
        phoneFormatted: "(703) 522-2016",
        phone: "7035222016",
        address: "4075 Wilson Blvd",
        city: "Arlington",
        country: "United States",
        crossStreet: "at N Randolph St.",
        postalCode: "22203",
        state: "VA",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-75.28784, 40.008008],
      },
      properties: {
        phoneFormatted: "(610) 642-9400",
        phone: "6106429400",
        address: "68 Coulter Ave",
        city: "Ardmore",
        country: "United States",
        postalCode: "19003",
        state: "PA",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-75.20121216774, 39.954030175164],
      },
      properties: {
        phoneFormatted: "(215) 386-1365",
        phone: "2153861365",
        address: "3925 Walnut St",
        city: "Philadelphia",
        country: "United States",
        postalCode: "19104",
        state: "PA",
      },
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [-77.043959498405, 38.903883387232],
      },
      properties: {
        phoneFormatted: "(202) 331-3355",
        phone: "2023313355",
        address: "1901 L St. NW",
        city: "Washington DC",
        country: "United States",
        crossStreet: "at 19th St",
        postalCode: "20036",
        state: "D.C.",
      },
    },
  ],
};

/**
 * Assign a unique id to each store. You'll use this `id`
 * later to associate each point on the map with a listing
 * in the sidebar.
 */
function assignID() {
  stores.features.forEach(function (store, i) {
    store.properties.id = i;
  });
}

/**
 * Use Mapbox GL JS's `flyTo` to move the camera smoothly
 * a given center point.
 **/
function flyToStore(currentFeature) {
  map.flyTo({
    center: currentFeature.geometry.coordinates,
    zoom: 15,
  });
}

/**
 * Create a Mapbox GL JS `Popup`.
 **/
function createPopUp(currentFeature) {
  const popUps = document.getElementsByClassName("mapboxgl-popup");
  if (popUps[0]) {
    popUps[0].remove();
  }
  const popup = new mapboxgl.Popup({ closeOnClick: false })
    .setLngLat(currentFeature.geometry.coordinates)
    .setHTML("<h3>Sweetgreen</h3>" + "<h4>" + currentFeature.properties.address + "</h4>")
    .addTo(map);
}

/**
 * Add a marker to the map for every store listing.
 **/
function addMarkers() {
  /* For each feature in the GeoJSON object above: */
  stores.features.forEach(function (marker) {
    /* Create a div element for the marker. */
    const el = document.createElement("div");
    /* Assign a unique `id` to the marker. */
    el.id = "marker-" + marker.properties.id;
    /* Assign the `marker` class to each marker for styling. */
    el.className = "marker";

    /**
     * Create a marker using the div element
     * defined above and add it to the map.
     **/
    new mapboxgl.Marker(el, { offset: [0, -23] }).setLngLat(marker.geometry.coordinates).addTo(map);

    /**
     * Listen to the element and when it is clicked, do three things:
     * 1. Fly to the point
     * 2. Close all other popups and display popup for clicked store
     * 3. Highlight listing in sidebar (and remove highlight for all other listings)
     **/
    el.addEventListener("click", function (e) {
      /* Fly to the point */
      flyToStore(marker);
      /* Close all other popups and display popup for clicked store */
      createPopUp(marker);
      /* Highlight listing in sidebar */
      const activeItem = document.getElementsByClassName("active");
      e.stopPropagation();
      if (activeItem[0]) {
        activeItem[0].classList.remove("active");
      }
      const listing = document.getElementById("listing-" + marker.properties.id);
      listing.classList.add("active");
    });
  });
}

/**
 * Add a listing for each store to the sidebar.
 **/
function buildLocationList(data) {
  data.features.forEach(function (store, i) {
    /**
     * Create a shortcut for `store.properties`,
     * which will be used several times below.
     **/
    const prop = store.properties;

    /* Add a new listing section to the sidebar. */
    const listings = document.getElementById("listings");
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
    link.innerHTML = prop.address;

    /* Add details to the individual listing. */
    const details = listing.appendChild(document.createElement("div"));
    details.innerHTML = prop.city;
    if (prop.phone) {
      details.innerHTML += " · " + prop.phoneFormatted;
    }

    if (prop.distance) {
      const roundedDistance = Math.round(prop.distance * 100) / 100;
      details.innerHTML += "<p><strong>" + roundedDistance + " kilometers away</strong></p>";
    }

    /**
     * Listen to the element and when it is clicked, do four things:
     * 1. Update the `currentFeature` to the store associated with the clicked link
     * 2. Fly to the point
     * 3. Close all other popups and display popup for clicked store
     * 4. Highlight listing in sidebar (and remove highlight for all other listings)
     **/
    link.addEventListener("click", function (e) {
      for (let i = 0; i < data.features.length; i++) {
        if (this.id === "link-" + data.features[i].properties.id) {
          const clickedListing = data.features[i];
          flyToStore(clickedListing);
          createPopUp(clickedListing);
        }
      }
      const activeItem = document.getElementsByClassName("active");
      if (activeItem[0]) {
        activeItem[0].classList.remove("active");
      }
      this.parentNode?.classList.add("active");
    });
  });
}

function getBbox(sortedStores, storeIdentifier, searchResult) {
  const lats = [sortedStores.features[storeIdentifier].geometry.coordinates[1], searchResult.y];
  const lons = [sortedStores.features[storeIdentifier].geometry.coordinates[0], searchResult.x];
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

export function sortDistances(point: LngLat): void {
  console.log(point);
  const clickedPoint = turfHelpers.point(point);
  console.log(clickedPoint);

  const options = { units: "kilometers" };
  stores.features.forEach(function (store) {
    Object.defineProperty(store.properties, "distance", {
      //value: distance(clickedPoint, store.geometry, options),
      value: point.distanceTo(store.geometry.coordinates),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  });

  stores.features.sort(function (a, b) {
    if (a.properties.distance > b.properties.distance) {
      return 1;
    }
    if (a.properties.distance < b.properties.distance) {
      return -1;
    }
    return 0; // a must be equal to b
  });

  //TODO wouldn't sort be enough? instead of rebuilding everything?
  // then there needs to be a distance property on each geojson from the beginning to be sortable
  const listings = document.getElementById("listings");
  while (listings?.firstChild) {
    listings.removeChild(listings.firstChild);
  }
  buildLocationList(stores);

  const bbox = getBbox(stores, 0, point);
  map.fitBounds(bbox, {
    padding: 100,
  });

  createPopUp(stores.features[0]);

  const activeListing = document.getElementById("listing-" + stores.features[0].properties.id);
  activeListing?.classList.add("active");
}

export function loadSidebar(): void {
  assignID();

  map.addSource("places", {
    type: "geojson",
    data: stores as FeatureCollection,
  });

  buildLocationList(stores);
  addMarkers();
}
