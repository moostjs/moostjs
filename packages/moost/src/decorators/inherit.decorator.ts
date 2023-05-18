import { getMoostMate } from '../metadata'

/**
 * ## Inherit
 * ### @Decorator
 * Inherit metadata from super class
 * @returns 
 */
export const Inherit = () => getMoostMate().decorate('inherit', true)
