/**
 * This class holds the details about an established bridge.
 * @property {string} id The current identifier is a JWT. Here is the body
 * of the token:
 * {
 *   "room": "Room ID",
 *   "uuid": "Token's identifier"
 * }
 * @property {string} room The room bridged
 */
export default class Bridge {
  public readonly id: string;

  public readonly room: string;

  constructor(id: string, room: string) {
    this.id = id;
    this.room = room;
  }
}
