// Its own module so Vite splits the animation features (~20 kB gz) out of the entry chunk; they load after first paint.
export { domAnimation as default } from 'motion/react'
