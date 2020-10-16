/**
 *  One-dimensional Box-Blur for one channel
 *	Source: http://blog.ivank.net/fastest-gaussian-blur.html
 *
 */
(function(window) { 
	'use strict';
		
	var FastGaussBlur = {

		apply: function (scl, tcl, w, h, r) {
		    var bxs = this._boxesForGauss(r, 3);
		    this._boxBlur_4 (scl, tcl, w, h, (bxs[0]-1)/2);
		    this._boxBlur_4 (tcl, scl, w, h, (bxs[1]-1)/2);
		    this._boxBlur_4 (scl, tcl, w, h, (bxs[2]-1)/2);
		},

		_boxesForGauss: function (sigma, n) {  // standard deviation, number of boxes
		    var wIdeal = Math.sqrt((12*sigma*sigma/n)+1);  // Ideal averaging filter width 
		    var wl = Math.floor(wIdeal);  if(wl%2==0) wl--;
		    var wu = wl+2;
						
		    var mIdeal = (12*sigma*sigma - n*wl*wl - 4*n*wl - 3*n)/(-4*wl - 4);
		    var m = Math.round(mIdeal);
		    // var sigmaActual = Math.sqrt( (m*wl*wl + (n-m)*wu*wu - n)/12 );
						
		    var sizes = [];  for(var i=0; i<n; i++) sizes.push(i<m?wl:wu);
		    return sizes;
		},

		_boxBlur_4: function (scl, tcl, w, h, r) {
		    for(var i=0; i<scl.length; i++) tcl[i] = scl[i];
		    this._boxBlurH_4(tcl, scl, w, h, r);
		    this._boxBlurT_4(scl, tcl, w, h, r);
		},

		_boxBlurH_4: function (scl, tcl, w, h, r) {
		    var iarr = 1 / (r+r+1);
		    for(var i=0; i<h; i++) {
		        var ti = i*w, li = ti, ri = ti+r;
		        var fv = scl[ti], lv = scl[ti+w-1], val = (r+1)*fv;
		        for(var j=0; j<r; j++) val += scl[ti+j];
		        for(var j=0  ; j<=r ; j++) { val += scl[ri++] - fv       ;   tcl[ti++] = Math.round(val*iarr); }
		        for(var j=r+1; j<w-r; j++) { val += scl[ri++] - scl[li++];   tcl[ti++] = Math.round(val*iarr); }
		        for(var j=w-r; j<w  ; j++) { val += lv        - scl[li++];   tcl[ti++] = Math.round(val*iarr); }
			}
		},

		_boxBlurT_4: function (scl, tcl, w, h, r) {
		    var iarr = 1 / (r+r+1);
		    for(var i=0; i<w; i++) {
		        var ti = i, li = ti, ri = ti+r*w;
		        var fv = scl[ti], lv = scl[ti+w*(h-1)], val = (r+1)*fv;
		        for(var j=0; j<r; j++) val += scl[ti+j*w];
		        for(var j=0  ; j<=r ; j++) { val += scl[ri] - fv     ;  tcl[ti] = Math.round(val*iarr);  ri+=w; ti+=w; }
		        for(var j=r+1; j<h-r; j++) { val += scl[ri] - scl[li];  tcl[ti] = Math.round(val*iarr);  li+=w; ri+=w; ti+=w; }
		        for(var j=h-r; j<h  ; j++) { val += lv      - scl[li];  tcl[ti] = Math.round(val*iarr);  li+=w; ti+=w; }
		    }
		}
	}

	window.FastGaussBlur = FastGaussBlur;

})(window);


