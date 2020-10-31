/* eslint-disable quotes */
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

  EDUCATION: {
    kindergarten: ["kindergarten"],
    school: ["school"],
    university: ["university"],
  },

  SPORTS: {
    swimming: ["swimming_pool", "water_park"],
    fitness: ["gym", "sports_centre"],
    tennis: ["tennis"],
    soccer: ["soccer"],
    boxing: ["boxing"],
    dancing: ["dance"],
  },

  GASTRONOMY: {
    restaurant: ["restaurant"],
    cafe: ["cafe"],
    pub: ["pub"],
  },

  MEDICINE: {
    doctor: ["doctors"],
    hospital: ["hospital"],
    pharmacy: ["pharmacy"],
  },

  CHILDREN: {
    playground: ["playground"],
    livingstreet: ["living_street"],
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

  getQuery(displayName: string): string {
    switch (displayName) {
      case "Bar":
        return 'nwr["amenity"~"^pub|bar|biergarten$"]; nwr["biergarten"="yes"];';

      case "Restaurant":
        return 'nwr["amenity"="restaurant"];';

      case "Cafe":
        return 'nwr["amenity"="cafe"];';

      case "University":
        //return 'nwr["building"="university"];'; // to get the buildings
        return 'nwr["amenity"="university"];'; // to get the whole campus area

      case "Supermarket":
        return 'nwr["shop"="supermarket"];';

      case "Bus stop":
        return 'nwr["public_transport"="stop_position"]["bus"="yes"];';

      case "Highway":
        return 'nwr["highway"~"^motorway|trunk|motorway_link$"];';

      case "Railway station":
        return 'nwr["public_transport"="stop_position"]["railway"="stop"];';

      case "Park":
        return 'nwr["leisure"~"^park|nature_reserve$"];';

      case "River":
        return 'nwr["waterway"~"^river|stream$"];'; //TODO vllt water=* oder waterway=* um alles zu bekommen??

      //TODO die osm tags und modelle nochmal genauer anschauen!
      //* für Seen: natural=water+water=lake,
      //* vgl. https://wiki.openstreetmap.org/wiki/Waterways

      default:
        throw new Error("Unknown input value! Key couldn't be found!");
    }
  }

  //TODO
  /**
   * *amenity:
   *  für Bar: 
  nwr["amenity"~"^pub|bar|biergarten$"]({{bbox}});
  nwr["biergarten"="yes"]({{bbox}});
   * 
   * Autobahn / große Straße:
  highway=motorway
  und highway	motorway_link
  vllt auch noch highway=trunk für die ebene nach autobahn ()
   * 
   * * Wasser:
   waterway=river und waterway=stream (vllt auch noch waterway=canal?)
   Seen: natural=water+water=lake
   *
   * * Education:
   amenity=college
   amenity=university
   amenity=school
   amenity=kindergarten
   * * Öffentliche Verkehrsmittel:
   * Bushaltestelle: 
   nwr["public_transport"="stop_position"]["bus"="yes"]({{bbox}});
   * Busbahnhof
   amenity=bus_station
   oder: public_transport=station
   * Bahnhofhaltestelle:
    nwr["public_transport"="stop_position"]["railway"="stop"]({{bbox}});
   *
   * * Parkplätze:
   amenity=parking
   und für Straßenrand: parking:lane=*
   * * im Grünen:
   leisure=park
   leisure=nature_reserve
   
    * Andere:
   landuse=forest
   landuse=meadow ???
   */

  getKeyType(val: string): string {
    switch (val) {
      case "Bar": // oder club, ...
      case "Restaurant":
      case "Cafe":
        return "amenity";

      case "University":
        return "amenity"; // could be amenity too if we want the whole campus

      case "Supermarket":
        return "shop";

      case "Park": // oder leisure	nature_reserve
        return "leisure";

      case "River":
        return "waterway"; //TODO vllt water=* oder waterway=* um alles zu bekommen??

      //TODO die osm tags und modelle nochmal genauer anschauen!
      //* für Seen: natural=water+water=lake,
      //* vgl. https://wiki.openstreetmap.org/wiki/Waterways

      default:
        throw new Error("Unknown input value! Key couldn't be found!");
    }
  }

  //TODO fetch everything that is marked as a building or apartment
  /* * apartments / houses:
    vllt landuse=residential mit name=* oder addr:flats ???
   */
  getAllHousesQuery(): string {
    /*
    waysWithAllHousesTags = new ArrayList<Integer>();

    waysWithTagYes = mI.getAllHouses("building", "yes");
    waysWithTagApartment = mI.getAllHouses("building", "apartments");
    waysWithTagHouse = mI.getAllHouses("building", "house");
    waysWithTagTerrace = mI.getAllHouses("building", "terrace");
    waysWithHouseNumbers = mI.getAllHouses("addr:housenumber", ".*");

    waysWithAllHousesTags.add(waysWithTagYes, ...);
    */

    return 'nwr["building"~"^apartments|dormitory|terrace|house$"];';
  }
}

export default new TagCollection();
