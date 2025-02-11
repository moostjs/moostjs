import { Arbac } from '@prostojs/arbac'
import { Injectable } from 'moost'

/**
 * A DI-enabled extension of the `Arbac` class for use within MoostJS.
 *
 * This class allows ARBAC (Advanced Role-Based Access Control) to be easily injected
 * into MoostJS services and controllers using its dependency injection system.
 *
 * @template TUserAttrs - The type representing user attributes relevant to access control.
 * @template TScope - The type representing access control scopes.
 */
@Injectable()
export class MoostArbac<TUserAttrs extends object, TScope extends object> extends Arbac<
  TUserAttrs,
  TScope
> {}
