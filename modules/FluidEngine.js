import { clamp } from "./MathHelpers"

export default class FluidEngine {

    constructor( size ) {
        this.size = size
        this.cellWidth = 1 / size

        this.sizePad = size + 2
        let areaPad = this.areaPad = this.sizePad ** 2

        this.vx = new Float32Array( areaPad )
        this.vy = new Float32Array( areaPad )
        this.vxPrev = new Float32Array( areaPad )
        this.vyPrev = new Float32Array( areaPad )
        this.density = new Float32Array( areaPad )
        this.densityPrev = new Float32Array( areaPad )

        this.divergence = new Float32Array( areaPad )
        this.potential = new Float32Array( areaPad )
    }

    swapDensity() {
        let tmp = this.densityPrev
        this.densityPrev = this.density
        this.density = tmp
    }

    swapVx() {
        let tmp = this.vxPrev
        this.vxPrev = this.vx
        this.vx = tmp
    }

    swapVy() {
        let tmp = this.vyPrev
        this.vyPrev = this.vy
        this.vy = tmp
    }

    index( i, j ) {
        return i + this.sizePad * j
    }

    addSource( x, s, dt ) {
        for ( let i = 0; i < this.areaPad; i++ )
            x[ i ] += s[ i ] * dt
    }

    addSourceFromFunction( x, dt, sFn ) {
        for ( let j = 0; j <= this.sizePad; j++ ) {
            for ( let i = 0; i <= this.sizePad; i++ ) {
                let cellX = ( i - 1 ) / this.size - .5
                let cellY = ( j - 1 ) / this.size - .5
                x[ this.index( i, j ) ] += sFn( cellX, cellY, i, j ) * dt
            }
        }
    }

    densityStep( dt, diffusivity ) {
        this.diffuse( 0, this.density, this.densityPrev, diffusivity, dt )
        this.swapDensity()
        this.advect( 0, this.density, this.densityPrev, this.vx, this.vy, dt )
        this.swapDensity()
    }

    velocityStep( dt, viscosity ) {
        this.diffuse( 1, this.vx, this.vxPrev, viscosity, dt )
        this.swapVx()
        this.diffuse( 2, this.vy, this.vyPrev, viscosity, dt )
        this.swapVy()

        this.project( this.vx, this.vy, this.potential, this.divergence )
        this.swapVx()
        this.swapVy()

        this.advect( 1, this.vx, this.vxPrev, this.vxPrev, this.vyPrev, dt )
        this.advect( 2, this.vy, this.vyPrev, this.vxPrev, this.vyPrev, dt )
        this.project( this.vx, this.vy, this.potential, this.divergence )
    }

    diffuse( bound, x, xPrev, diffusivity, dt ) {
        const getX = ( i, j ) => x[ this.index( i, j ) ]
        const getXPrev = ( i, j ) => xPrev[ this.index( i, j ) ]

        let a = dt * diffusivity * this.size ** 2
        let s = 1 / ( 1 + 4 * a )

        for ( let solveIter = 0; solveIter < 20; solveIter++ ) {

            for ( let j = 1; j <= this.size; j++ ) {
                for ( let i = 1; i <= this.size; i++ ) {
                    x[ this.index( i, j ) ] = s * (
                        getXPrev( i, j )
                        + a * (
                            getX( i - 1, j ) + getX( i + 1, j ) +
                            getX( i, j - 1 ) + getX( i, j + 1 )
                        )
                    )
                }
            }

            this.setBound( bound, x )
        }
    }

    advect( bound, d, dPrev, vx, vy, dt ) {
        const setD = ( i, j, v ) => { d[ this.index( i, j ) ] = v }
        const getDPrev = ( i, j ) => dPrev[ this.index( i, j ) ]
        const getVx = ( i, j ) => vx[ this.index( i, j ) ]
        const getVy = ( i, j ) => vy[ this.index( i, j ) ]

        let N = this.size
        let dt0 = dt * N

        for ( let j = 1; j <= this.size; j++ ) {
            for ( let i = 1; i <= this.size; i++ ) {

                let x = clamp( i - dt0 * getVx( i, j ), .5, .5 + N )
                let y = clamp( j - dt0 * getVy( i, j ), .5, .5 + N )

                let i0 = Math.floor( x ), i1 = i0 + 1
                let j0 = Math.floor( y ), j1 = j0 + 1

                let s1 = x - i0, s0 = 1 - s1
                let t1 = y - j0, t0 = 1 - t1

                // Bilinear interpolate the density
                setD( i, j,
                    s0 * ( t0 * getDPrev( i0, j0 ) + t1 * getDPrev( i0, j1 ) ) +
                    s1 * ( t0 * getDPrev( i1, j0 ) + t1 * getDPrev( i1, j1 ) )
                )

            }
        }

        this.setBound( bound, d )

    }

    project( vx, vy, p, div ) {
        const IX = ( i, j ) => this.index( i, j )

        let N = this.size
        let h = 1 / N

        // Calculate divergence of velocity field
        for ( let j = 1; j <= this.size; j++ ) {
            for ( let i = 1; i <= this.size; i++ ) {
                div[ IX( i, j ) ] = (
                    ( vx[ IX( i + 1, j ) ] - vx[ IX( i - 1, j ) ] ) +
                    ( vy[ IX( i, j + 1 ) ] - vy[ IX( i, j - 1 ) ] )
                ) * ( .5 / h )
            }
        }
        this.setBound( 0, div )
        this.setBound( 0, p )

        // Find potential function whose gradient has same divergence as velocity field by Gauss-Seidel.
        for ( let solveIter = 0; solveIter < 20; solveIter++ ) {

            for ( let j = 1; j <= this.size; j++ ) {
                for ( let i = 1; i <= this.size; i++ ) {
                    p[ IX( i, j ) ] = ( -1 / 4 ) * (
                        h ** 2 * div[ IX( i, j ) ]
                        - (
                            p[ IX( i - 1, j ) ] +
                            p[ IX( i + 1, j ) ] +
                            p[ IX( i, j - 1 ) ] +
                            p[ IX( i, j + 1 ) ]
                        )
                    )
                }
            }

            this.setBound( 0, p )
        }

        // Remove potential flow from velocity field.
        for ( let j = 1; j <= this.size; j++ ) {
            for ( let i = 1; i <= this.size; i++ ) {
                vx[ IX( i, j ) ] -= ( .5 / h ) * ( p[ IX( i + 1, j ) ] - p[ IX( i - 1, j ) ] )
                vy[ IX( i, j ) ] -= ( .5 / h ) * ( p[ IX( i, j + 1 ) ] - p[ IX( i, j - 1 ) ] )
            }
        }

        this.setBound( 1, vx )
        this.setBound( 2, vy )
    }

    setBound( bound, x ) {

        const setX = ( i, j, v ) => { x[ this.index( i, j ) ] = v }
        const getX = ( i, j ) => x[ this.index( i, j ) ]

        let N = this.size

        // Closed on all sides:
        // for ( let i = 1; i <= this.size; i++ ) {
        //     setX( 0, i, bound == 1 ? -getX( 1, i ) : getX( 1, i ) )
        //     setX( N + 1, i, bound == 1 ? -getX( N, i ) : getX( N, i ) )
        //     setX( i, 0, bound == 2 ? -getX( i, 1 ) : getX( i, 1 ) )
        //     setX( i, N + 1, bound == 2 ? -getX( i, N ) : getX( i, N ) )
        // }

        // Wrap around:
        for ( let i = 1; i <= this.size; i++ ) {
            let average = ( getX( 1, i ) + getX( N, i ) ) / 2
            setX( 0, i, average )
            setX( N + 1, i, average )

            average = ( getX( i, 1 ) + getX( i, N ) ) / 2
            setX( i, 0, average )
            setX( i, N, average )
        }

        // Set corners to average of their neighbors.
        setX( 0, 0, .5 * ( getX( 1, 0 ) + getX( 0, 1 ) ) )
        setX( 0, N + 1, .5 * ( getX( 1, N + 1 ) + getX( 0, N ) ) )
        setX( N + 1, 0, .5 * ( getX( N, 0 ) + getX( N + 1, 1 ) ) )
        setX( N + 1, N + 1, .5 * ( getX( N, N + 1 ) + getX( N + 1, N ) ) )

    }
}