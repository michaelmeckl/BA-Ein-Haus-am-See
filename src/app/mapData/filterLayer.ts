import type { Feature, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";

// every relevance has a specific weight
export enum FilterRelevance {
  notVeryImportant = 0.2, //= optional,
  important = 0.5,
  veryImportant = 0.8,
}
/*
//alternativ:
export const FilterRelevance = {
  notVeryImportant: 0.2, //= optional,
  important: 0.5,
  veryImportant: 0.8,
};
*/

const defaultDistance = 300;

export class FilterLayer {
  private layerName: string;
  private distance: number;
  private relevanceValue: number;
  private wanted: boolean;

  private points: mapboxgl.Point[] = [];
  private features: Feature<Polygon | MultiPolygon, GeoJsonProperties>[] = [];

  constructor(name?: string, distance?: number, relevance?: FilterRelevance, wanted?: boolean) {
    this.layerName = name || "";
    this.distance = distance || defaultDistance;
    this.relevanceValue = relevance || FilterRelevance.important;
    //* || true is not possible because if wanted were false this would always evaluate to true!
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

  set Points(pointCoords: mapboxgl.Point[]) {
    this.points = pointCoords;
  }
  get Points(): mapboxgl.Point[] {
    return this.points;
  }

  set Features(features: Feature<Polygon | MultiPolygon, GeoJsonProperties>[]) {
    this.features = features;
  }
  get Features(): Feature<Polygon | MultiPolygon, GeoJsonProperties>[] {
    return this.features;
  }
}
