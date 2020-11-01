/* eslint-disable quotes */

class TagCollection {
  /*
  createTag(osmName: string) {
    const tag: OsmTag = {
      key: osmName,
      values: ["supermarket", ""],
      selected: false,
      distance: 15,
      wanted: false,
    };
    return tag;
  }*/

  //* die case namen könnten noch extrahiert werden, z.B. in ein enum oder einen type für mehr type-safety
  getQueryForCategory(categoryName: string): string {
    switch (categoryName) {
      case "Bar":
        return 'nwr["amenity"~"^pub|bar|biergarten$"]; nwr["biergarten"="yes"];';

      case "Restaurant":
        return 'nwr["amenity"="restaurant"];';

      case "Cafe":
        return 'nwr["amenity"="cafe"];';

      case "Universität / OTH":
        //return 'nwr["building"="university"];'; // to get the buildings itself
        return 'nwr["amenity"~"^university|college$"];'; // to get the whole area

      case "Schule":
        return 'nwr["amenity"="school"];';

      case "Supermarkt":
        return 'nwr["shop"="supermarket"];';

      case "Einkaufszentrum":
        return 'nwr["shop"~"^department_store|mall$"];';

      case "Parkplatz":
        return 'nwr["amenity"="parking"];';

      case "Bushaltestelle":
        return 'nwr["public_transport"="stop_position"]["bus"="yes"]; nwr["highway"="bus_stop"];';

      case "Bahnhof":
        return 'nwr["public_transport"="stop_position"]["railway"="stop"];';

      case "Autobahn":
        //return 'nwr["highway"~"^motorway|trunk|motorway_link$"];';  // Autobahn und größere Straßen / trunks
        return 'nwr["highway"~"^motorway|motorway_link$"];';

      case "Park":
        return 'nwr["leisure"~"^park|nature_reserve|village_green|recreation_ground$"];';

      // landuse=meadow für Wiesen auch verwenden ?

      case "Wald":
        return 'nwr["landuse"="forest"]; nwr["natural"="wood"];';

      case "Fluss":
        //return 'nwr["waterway"~"^river|stream|canal$"];'; // um zusätzlich noch kleine Bäche und Kanäle zu bekommen
        return 'nwr["waterway"="river"];';

      //* für Seen: natural=water & water=lake

      default:
        throw new Error("Unknown input value for osm tag! No suitable key was found!");
    }
  }

  //TODO: fetch everything that is marked as a building or apartment
  /* * apartments / houses:
    vllt landuse=residential mit name=* oder addr:flats ???
   */
  getAllHousesQuery(): string {
    /*waysWithTagYes = mI.getAllHouses("building", "yes");
    waysWithTagApartment = mI.getAllHouses("building", "apartments");
    waysWithTagHouse = mI.getAllHouses("building", "house");
    waysWithTagTerrace = mI.getAllHouses("building", "terrace");
    waysWithHouseNumbers = mI.getAllHouses("addr:housenumber", ".*");
    */

    return 'nwr["building"~"^apartments|dormitory|terrace|house$"];';
  }
}

export default new TagCollection();
