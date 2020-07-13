declare module "mapbox-gl-utils";
/*
 {
  function init(map: mapboxgl.Map, mapboxgl?: mapboxgl);

  //add source
  function addGeoJSON(sourceName: string, geojson?: GeoJSON | string);
  //addVector, ...

  //add layer
  function addCircle(
    id: string,
    sourceName: string,
    properties?: {},
    beforeLayer?: string
  );

  //map.U.addGeoJSON('towns');
  //map.U.addCircle('small-towns', 'towns', { circleColor: 'green', filter: ['==', 'size', 'small']});

  function removeSource(sources: string[]);
  function removeLayers(layers: string[]);

  // Easier to remember way to turn layers on and off:
  function show(layerName: string);
  function hide(layerName: string);
  function toggle(layers: string[], isVisible: boolean);

  function setProperty(layerName: string, properties: {});
    //textSize: 12,
    //textColor: 'red'

  // Hide/show/toggle all the layers attached to this source
  function hideSource(sourceName: string);
  function showSource(sourceName: string);
  function toggleSource(sourceName: string, visibility: boolean);

  function setData(name: string, data: {});

  function onLoad(callback: () => void);
}
*/
