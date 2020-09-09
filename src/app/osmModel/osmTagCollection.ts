import type OsmTag from "./osmTag";

//TODO: anderes format? z.B. as a Map? or a Set?
const allTags = {
  SHOPPING: {
    supermarket: ["supermarket"],
    bakery: ["bakery"],
    butcher: ["butcher"],
    mall: ["mall"],
    kiosk: ["kiosk"],
  },

  NATURE: {
    park: ["park", "recreation_ground", "village_green"],
    wood: ["wood", "forrest"],
    water: [
      "river",
      "riverbank",
      "fairway",
      "water",
      "coastline",
      "bay",
      "stream",
      "canal",
      "drain",
      "ditch",
    ],
  },

  TRAFFIC: {
    bus: ["bus_stop", "bus_station"],
    train: ["train_station"],
    motorway: ["motorway"],
    subway: ["subway_entrance"],
    tram: ["tram_stop"],
  },
} as const; // as const makes this object immutable; see https://www.sitepoint.com/compile-time-immutability-in-typescript/#deeplyfreezingliteralexpressionswithconstassertions;

class TagCollection {
  constructor() {
    const tag: OsmTag = {
      key: "shop",
      values: ["supermarket", ""],
      selected: false,
      distance: 15,
      wanted: false,
    };
  }

  getTag(tag: string): string {
    throw Error("not implemented");
  }

  getKeyType(val: string): string {
    switch (val) {
      case "Bar": // oder club, ...
      case "Restaurant":
      case "Cafe":
        return "amenity";

      case "University":
        return "building"; // could be amenity too if we want the whole campus

      case "Supermarket":
        return "shop";

      case "Park": // oder leisure	nature_reserve
        return "leisure";

      case "River":
        return "waterway";

      default:
        throw new Error("Unknown input value! Key couldn't be found!");
    }
  }
}

export default new TagCollection();
