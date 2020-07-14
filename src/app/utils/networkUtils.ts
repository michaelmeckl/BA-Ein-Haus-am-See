import Benchmark from "../../shared/benchmarking";

//TODO:
//- Laden von Daten über die Overpass API dem Anwender anzeigen, z.B. mit einem Ladebalken oder einer snackbar
//- Fehlerbehandlung, falls die Overpass API einen Timeout wegen zu großer Datenmenge erzeugt

//TODO: use a webworker instead to load data async? better ux?
export async function fetchOsmData(mapBounds: string, query: string): Promise<string | null> {
  try {
    console.log("sending request!");
    Benchmark.startMeasure("Request client side");
    const params = new URLSearchParams({
      bounds: mapBounds,
      osmQuery: query,
    });
    const url = "http://localhost:8000/osmRequest?" + params;

    const response = await fetch(url, {
      method: "GET",
    });
    console.log(Benchmark.stopMeasure("Request client side"));

    console.log(response);

    if (!response.ok) {
      throw new Error(`Request failed! Status ${response.status} (${response.statusText})`);
    }

    Benchmark.startMeasure("Get Json from response");
    const osmData = await response.json();
    console.log(Benchmark.stopMeasure("Get Json from response"));
    return osmData;
  } catch (error) {
    console.error(error);
    return null;
  }
}
