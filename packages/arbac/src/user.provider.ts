/* eslint-disable @typescript-eslint/promise-function-async */
import { Injectable } from 'moost'

/**
 * Base class for providing user data required for ARBAC (Advanced Role-Based Access Control) evaluations.
 *
 * This class must be extended to define how user data is retrieved in the application.
 *
 * @template TUserAttrs - The type representing user attributes relevant to access control.
 */
@Injectable()
export class ArbacUserProvider<TUserAttrs extends object> {
  /**
   * Retrieves the unique identifier of the user.
   *
   * @returns {string | Promise<string>} The user ID, or a rejected promise if not implemented.
   * @throws {Error} If the method is not overridden by a subclass.
   */
  getUserId(): string | Promise<string> {
    return Promise.reject(new Error('ArbacUserProvider class must be extended'))
  }

  /**
   * Retrieves the roles assigned to a user based on their ID.
   *
   * @param {string} id - The user ID.
   * @returns {string[] | Promise<string[]>} An array of role identifiers, or a rejected promise if not implemented.
   * @throws {Error} If the method is not overridden by a subclass.
   */
  getRoles(id: string): string[] | Promise<string[]> {
    return Promise.reject(new Error('ArbacUserProvider class must be extended'))
  }

  /**
   * Retrieves the attributes associated with a user based on their ID.
   *
   * @param {string} id - The user ID.
   * @returns {TUserAttrs | Promise<TUserAttrs>} The user attributes, or a rejected promise if not implemented.
   * @throws {Error} If the method is not overridden by a subclass.
   */
  getAttrs(id: string): TUserAttrs | Promise<TUserAttrs> {
    return Promise.reject(new Error('ArbacUserProvider class must be extended'))
  }
}
