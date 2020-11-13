/* eslint-disable quotes */

export const enum TagNames {
  Bar = "Bar",
  Restaurant = "Restaurant",
  Cafe = "Cafe",
  University = "Universität und Hochschule",
  School = "Schule",
  Supermarket = "Supermarkt",
  Mall = "Einkaufszentrum",
  Parking = "Parkplatz",
  BusStop = "Bushaltestelle",
  RailwayStation = "Bahnhof",
  Highway = "Autobahn",
  Parks = "Parks und Grünflächen",
  Forest = "Wald",
  River = "Fluss",
}

class TagCollection {
  getQueryForCategory(categoryName: string): string {
    switch (categoryName) {
      case TagNames.Bar:
        // nwr is shorthand for query instead of 3 separate ones (nwr = node, way, relation)
        return 'nwr["amenity"~"^pub|bar|biergarten$"]; nwr["biergarten"="yes"];';

      case TagNames.Restaurant:
        return 'nwr["amenity"="restaurant"];';

      case TagNames.Cafe:
        return 'nwr["amenity"="cafe"];';

      case TagNames.University:
        //return 'nwr["building"="university"];'; // to get the buildings itself
        return 'nwr["amenity"~"^university|college$"];'; // to get the whole area

      case TagNames.School:
        return 'nwr["amenity"="school"];';

      case TagNames.Supermarket:
        return 'nwr["shop"="supermarket"];';

      case TagNames.Mall:
        return 'nwr["shop"~"^department_store|mall$"];';

      case TagNames.Parking:
        return 'nwr["amenity"="parking"];';

      case TagNames.BusStop:
        return 'nwr["public_transport"="stop_position"]["bus"="yes"]; nwr["highway"="bus_stop"];';

      case TagNames.RailwayStation:
        return 'nwr["public_transport"="stop_position"]["railway"="stop"];';

      //TODO auch bundesstraßen hier nehmen?
      case TagNames.Highway:
        //return 'nwr["highway"~"^motorway|trunk|motorway_link$"];';  // Autobahn und größere Straßen / trunks
        return 'nwr["highway"~"^motorway|motorway_link$"];';

      case TagNames.Parks:
        //return 'nwr["leisure"~"^park|nature_reserve|village_green|recreation_ground$"];';
        return 'nwr["leisure"~"^park|nature_reserve|village_green$"];';

      // landuse=meadow für Wiesen auch verwenden ?

      case TagNames.Forest:
        return 'nwr["landuse"="forest"]; nwr["natural"="wood"];';

      case TagNames.River:
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
  //TODO run this query only at a certain zoom level (e.g. > 14) to improve performance??
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
