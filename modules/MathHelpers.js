export function smoothstep( min, max, value ) {
    var x = Math.max( 0, Math.min( 1, ( value - min ) / ( max - min ) ) );
    return x * x * ( 3 - 2 * x );
}

export function remap( x, preMin, preMax, postMin, postMax ) {
    return ( x - preMin ) / ( preMax - preMin ) * ( postMax - postMin ) + postMin
}

export function clamp( x, min, max ) { return Math.min( max, Math.max( min, x ) ) }

