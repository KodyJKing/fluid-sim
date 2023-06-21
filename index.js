import FluidEngine from "./modules/FluidEngine"
import { clamp, remap, smoothstep } from "./modules/MathHelpers"

function main() {
    let fieldSpeed = 0.001
    let diffusivity = 1e-7
    let viscosity = 1e-6
    let noiseRate = 0.05

    let size = 126
    let engine = new FluidEngine( size )

    // engine.addSourceFromFunction( engine.density, 1, function ( x, y ) {
    //     return smoothstep( .3, .25, Math.hypot( x, y ) ) * ( Math.sin( Math.atan2( x, y ) * 20 ) * .5 + .5 )
    //     // return smoothstep( .3, .25, Math.abs( x ) + Math.abs( y ) )
    // } )
    // engine.addSourceFromFunction( engine.vx, 1, ( x, y ) => y * fieldSpeed )
    // engine.addSourceFromFunction( engine.vy, 1, ( x, y ) => -x * fieldSpeed )

    engine.densityPrev.set( engine.density )
    engine.vxPrev.set( engine.vx )
    engine.vyPrev.set( engine.vy )

    let prevTime = performance.now()
    let stepCount = 0
    function simulate() {
        let time = performance.now()
        let dt = clamp( time - prevTime, 8, 32 )

        // Add jet
        let sourceX = 0
        let sourceY = .45
        let sourceDensityRate = 0.2
        let sourceAcceleration = 0.0001 * ( Math.sin( time / 1000 / 10 ) * .5 + .5 )
        let jetAngle = Math.sin( -time / 1000 * 2 ) - Math.PI / 2
        let c = Math.cos( jetAngle )
        let s = Math.sin( jetAngle )
        // engine.addSourceFromFunction( engine.densityPrev, 1, ( x, y ) =>
        //     smoothstep( .025, .0125, Math.hypot( x - sourceX, y - sourceY ) ) * sourceDensityRate )
        engine.addSourceFromFunction( engine.vxPrev, 1, ( x, y ) =>
            smoothstep( .25, .125, Math.hypot( x - sourceX, y - sourceY ) ) * c * sourceAcceleration )
        engine.addSourceFromFunction( engine.vyPrev, 1, ( x, y ) =>
            smoothstep( .25, .125, Math.hypot( x - sourceX, y - sourceY ) ) * s * sourceAcceleration )

        engine.addSourceFromFunction( engine.densityPrev, 1, ( x, y ) =>
            Math.random() * noiseRate )
        // if ( stepCount++ % 10 == 0 )

        // Decay
        for ( let i = 0; i < engine.densityPrev.length; i++ ) {
            engine.densityPrev[ i ] *= .99
            engine.densityPrev[ i ] -= noiseRate / 2
            if ( engine.densityPrev[ i ] < 0 )
                engine.densityPrev[ i ] = 0
            engine.vxPrev[ i ] *= .99
            engine.vyPrev[ i ] *= .99
        }

        engine.densityStep( dt, diffusivity )
        engine.velocityStep( dt, viscosity )

        // let netDensity = 0
        // for ( let d of engine.density ) netDensity += d
        // console.log( netDensity )

        drawScalar( engine, engine.density, 0, 1, mainCanvas )
        // drawVelocity( engine, engine.vx, engine.vy, mainCanvas )

        requestAnimationFrame( simulate )
    }
    simulate()

}
main()

/**
 * 
 * @param {FluidEngine} engine 
 * @param {HTMLCanvasElement} canvas
 */
function drawScalar( engine, x, min, max, canvas ) {
    let ctx = canvas.getContext( "2d" )

    let patchWidth = canvas.width / engine.sizePad

    for ( let j = 0; j < engine.sizePad; j++ ) {
        for ( let i = 0; i < engine.sizePad; i++ ) {
            let xVal = x[ engine.index( i, j ) ]
            // let color = remap( xVal, min, max, 0, 255 )
            // ctx.fillStyle = `rgb(${ color },${ color },${ color })`
            let hue = remap( xVal, min, max, 0, 360 )
            ctx.fillStyle = `hsl(${ hue },100%, 37.5%)`
            ctx.fillRect( i * patchWidth, j * patchWidth, patchWidth, patchWidth )
        }
    }

}

/**
 * 
 * @param {FluidEngine} engine 
 * @param {HTMLCanvasElement} canvas
 */
function drawVelocity( engine, vx, vy, canvas ) {
    let ctx = canvas.getContext( "2d" )

    ctx.globalAlpha = 0.25

    let patchWidth = canvas.width / engine.sizePad

    for ( let j = 0; j < engine.sizePad; j++ ) {
        for ( let i = 0; i < engine.sizePad; i++ ) {
            const index = engine.index( i, j )
            let velX = vx[ index ]
            let velY = vy[ index ]
            const speed = Math.hypot( velX, velY )
            velX /= speed
            velY /= speed
            const c = smoothstep( 0, 1, speed * 2500 )
            const b = smoothstep( 0, 1, speed * 1000 ) * 255
            ctx.beginPath()
            ctx.moveTo( ( i + .5 ) * patchWidth, ( j + .5 ) * patchWidth )
            ctx.lineTo( ( i + .5 + velX * c ) * patchWidth, ( j + .5 + velY * c ) * patchWidth )
            // ctx.strokeStyle = "red"
            // ctx.strokeStyle = `rgb(${ b }, ${ 255 - b }, ${ 255 - b })`
            ctx.strokeStyle = `rgb(${ b }, ${ b }, ${ b })`
            ctx.stroke()
        }
    }

    ctx.globalAlpha = 1
}