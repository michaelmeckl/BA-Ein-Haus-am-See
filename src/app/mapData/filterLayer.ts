/* eslint-disable no-magic-numbers */
import type { Feature, GeoJsonProperties, Geometry, MultiPolygon, Polygon } from "geojson";
import { convertToPixelCoord } from "../map/mapboxUtils";

// every relevance has a specific weight
export enum FilterRelevance {
  notVeryImportant = 0.2, //= optional,
  important = 0.5,
  veryImportant = 0.8,
}

const defaultDistance = 300;

/**
 * This class holds all necessary information for one layer (= one specific osm filter).
 */
export class FilterLayer {
  private layerName: string;
  private distance: number;
  private relevanceValue: number;
  private wanted: boolean;

  private points: mapboxgl.Point[][] = [];
  private features: Feature<Polygon | MultiPolygon, GeoJsonProperties>[] = [];

  constructor(name?: string, distance?: number, relevance?: FilterRelevance, wanted?: boolean) {
    this.layerName = name || "";
    this.distance = distance || defaultDistance;
    this.relevanceValue = relevance || FilterRelevance.important;
    //* using || true is not possible here because if wanted were false this would always evaluate to true!
    this.wanted = wanted !== undefined ? wanted : true;
  }

  get LayerName(): string {
    return this.layerName;
  }

  set Distance(distance: number) {
    this.distance = distance;
  }
  get Distance(): number {
    return this.distance;
  }

  set Relevance(relevance: FilterRelevance) {
    this.relevanceValue = relevance;
  }
  get Relevance(): FilterRelevance {
    return this.relevanceValue;
  }

  set Wanted(wanted: boolean) {
    this.wanted = wanted;
  }
  get Wanted(): boolean {
    return this.wanted;
  }

  set Points(pointCoords: mapboxgl.Point[][]) {
    this.points = pointCoords;
  }
  get Points(): mapboxgl.Point[][] {
    return this.points;
  }

  set Features(features: Feature<Polygon | MultiPolygon, GeoJsonProperties>[]) {
    this.features = features;
  }
  get Features(): Feature<Polygon | MultiPolygon, GeoJsonProperties>[] {
    return this.features;
  }

  calculatePointCoordsForFeatures(): void {
    this.points.length = 0;

    for (let index = 0; index < this.features.length; index++) {
      const feature = this.features[index];
      const coords = feature.geometry.coordinates;

      // check if this is a multidimensional array (i.e. a multipolygon or a normal one)
      if (coords.length > 1) {
        console.log("Multipolygon: ", coords);
        //const flattened: mapboxgl.Point[] = [];
        for (const coordPart of coords) {
          //prettier-ignore
          this.Points.push(coordPart.map((coord: number[]) => convertToPixelCoord(coord)));
          //flattened.push(coordPart.map((coord: number[]) => convertToPixelCoord(coord)));
        }
        // this.Points.push(flattened);
      } else {
        console.log("Polygon");

        //prettier-ignore
        const pointData = coords[0].map((coord: number[]) => convertToPixelCoord(coord));
        this.Points.push(pointData);
      }
    }
  }
}
