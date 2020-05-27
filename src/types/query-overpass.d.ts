// types for https://github.com/perliedman/query-overpass
declare module "query-overpass" {
  export default function queryOverpass(
    query: string,
    callback: (error: Error, data: GeoJson) => void,
    options?: {}
  ): void;
}
