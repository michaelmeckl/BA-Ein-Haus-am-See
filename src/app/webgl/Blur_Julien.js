/**
 * Das sind die wichtigsten Funktionen und Canvas-Operationen für Juliens - Blur. Vielleicht hilfreich.
 */

_convertDistanceToPixels = function (zoom, mapCenter) {
    var actMetersPerPixel = GlobalMapTiles.LatToRes(zoom, mapCenter.lat);
    return 1 / actMetersPerPixel * this.distance;
};

/**
 * Zum Zeichnen der Kreise ohne Blur-Filter
 */
_getDrawnViewportCanvas = function (ftColl, zoom, requiredTilesInfo) {
    var tileSize = this.tileSize;
    var viewportCanvas = $('<canvas/>').get(0);
    viewportCanvas.height = requiredTilesInfo.rows * tileSize;
    viewportCanvas.width = requiredTilesInfo.cols * tileSize;

    var ctx = viewportCanvas.getContext('2d');
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, viewportCanvas.width, viewportCanvas.height);

    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'white';

    // Eine logische (oder arithmetische) Verschiebung um n (Bitpositionen) nach links ist äquivalent 
    // zu einer Multiplikation mit 2^{n}
    var z2 = (1 << zoom);

    var features = (ftColl.features) ? ftColl.features : ftColl;
    // if (!features)  console.log(ftColl);

    for (var featureNum = 0; featureNum < features.length; featureNum++) {

        var feature = features[featureNum];
        var geom = feature.geometry;
        var type = geom.type;


        ctx.beginPath();

        for (var i = 0; i < geom.coordinates.length; i++) {
            var coords = geom.coordinates;

            if (type === 'Point') {
                coords = this._convertCoords(coords, requiredTilesInfo.minX, requiredTilesInfo.minY, z2);
                ctx.arc(coords[0], coords[1], 2, 0, 2 * Math.PI);
                continue;
            }

            if (type === 'Polygon') {
                coords = coords[i];
            }

            for (var j = 0; j < coords.length; j++) {
                var p = coords[j];
                p = this._convertCoords(p, requiredTilesInfo.minX, requiredTilesInfo.minY, z2);
                if (j) ctx.lineTo(p[0], p[1]);
                else ctx.moveTo(p[0], p[1]);
            }
        }

        if (type === 'Polygon' || type === 'Point') ctx.fill('evenodd');

        ctx.stroke();
    }

    return viewportCanvas;
};

/**
 * Blur-Funktion
 */
_blurCanvas = function (viewportCanvas, size) {
    var ctx = viewportCanvas.getContext("2d");
    var imgData = ctx.getImageData(0, 0, viewportCanvas.width, viewportCanvas.height);

    var redChannel = [];

    for (var i = 0; i < imgData.data.length; i += 4) {
        redChannel.push(imgData.data[i]);
    }

    var blurredRedChannel = [];

    console.time('fastgaussblur');
    FastGaussBlur.apply(redChannel, blurredRedChannel, viewportCanvas.width, viewportCanvas.height, size);
    console.timeEnd('fastgaussblur');

    for (var i = 0; i < imgData.data.length; i += 4) {
        var colorValue = blurredRedChannel[i / 4];
        imgData.data[i] = colorValue;
        imgData.data[i + 1] = colorValue;
        imgData.data[i + 2] = colorValue;
    }

    ctx.putImageData(imgData, 0, 0);
};

//starting point
function blur() {
    console.time('draw Canvas');
    var viewportCanvas = that._getDrawnViewportCanvas(bufferedFtColl, zoom, requiredTilesInfo);
    console.timeEnd('draw Canvas');

    let blur = true;

    if (blur) {
        console.time('calc filterSize');
        var filterSize = that._convertDistanceToPixels(zoom, mapCenter, mapBounds);
        console.timeEnd('calc filterSize');

        console.time('blur viewport');
        that._blurCanvas(viewportCanvas, filterSize / 3);
        console.timeEnd('blur viewport');
    }

}