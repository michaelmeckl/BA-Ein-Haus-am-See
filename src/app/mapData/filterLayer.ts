import type { Feature, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";

// every relevance has a specific weight
export const enum FilterRelevance {
  notVeryImportant = 0.2, //= optional,
  important = 0.5,
  veryImportant = 0.8,
}

/*
export const enum FilterPolarity {
  desired,
  undesired,
}
*/

const defaultDistance = 500;

export class FilterLayer {
  private layerName: string;
  private distance: number;
  private relevance: FilterRelevance;
  private wanted: boolean;

  private points: mapboxgl.Point[] = [];
  private features: Feature<Polygon | MultiPolygon, GeoJsonProperties>[] = [];

  constructor(name?: string, distance?: number, relevance?: FilterRelevance, wanted?: boolean) {
    this.layerName = name || "";
    this.distance = distance || defaultDistance;
    this.relevance = relevance || FilterRelevance.important;
    this.wanted = wanted || true;
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
    this.relevance = relevance;
  }
  get Relevance(): FilterRelevance {
    return this.relevance;
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
