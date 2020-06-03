// custom type declaration for https://github.com/perliedman/query-overpass
declare module "query-overpass" {
  export default function queryOverpass(
    query: string,
    callback: (
      error: Error,
      data: import("geojson").GeoJsonObject
    ) => import("geojson").GeoJsonObject | Error | void,
    options?: {}
  ): import("geojson").GeoJsonObject | Error;
}
