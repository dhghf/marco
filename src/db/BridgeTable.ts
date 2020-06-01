import { Bridge } from "../common/Bridge";
import { NotBridgedError } from "../common/errors";
import { Database } from "better-sqlite3";
import { LogService } from "matrix-bot-sdk";


/**
 * This manages the bridge table in marco.db.
 */
export class BridgeTable {
  private readonly db: Database

  constructor(db: Database) {
    this.db = db;
    this.setupBridgeTable();
  }

  /**
   * This establishes a new bridge
   * @param {string} id Bridge identifier
   * @param {string} room Room ID
   * @returns {boolean} Whether or not it worked
   */
  public setBridge(id: string, room: string): boolean {
    const info = this.db.prepare(
      'INSERT INTO bridges (id, room) VALUES (?,?)'
    ).run(id, room);

    return (info.changes > 0);
  }

  /**
   * This gets a bridge establishment
   * @param {string} id Bridge identifier
   * @returns {Bridge}
   * @throws {NotBridgedError} If the ID provided is not associated with
   * anything
   */
  public getBridge(id: string): Bridge {
    const row = this.db.prepare(
      'SELECT room FROM bridges WHERE id=?'
    ).get(id);
    const roomID: string | undefined = row?.room;

    if (roomID) {
      return new Bridge(id, roomID);
    } else {
      throw new NotBridgedError();
    }
  }

  /**
   * This deletes a bridge establishment
   * @param {string} id Bridge identifier
   * @returns {boolean} Whether it worked or not
   */
  public unBridge(id: string): boolean {
    const info = this.db.prepare(
      'DELETE FROM bridges WHERE id=?'
    ).run(id);

    return (info.changes > 0);
  }

  /**
   * This checks to see if a room is associated with a bridge ID already.
   * @param {string} room Room ID
   * @returns {boolean}
   */
  public isRoomBridged(room: string): boolean {
    const row = this.db.prepare(
      'SELECT id FROM bridges WHERE room=?'
    ).get(room);

    return (row != undefined);
  }

  /**
   * This checks if the provided bridge ID is associated with a room already
   * @param {string} id Bridge identifier
   * @returns {boolean}
   */
  public isBridged(id: string): boolean {
    const row = this.db.prepare(
      'SELECT id FROM bridges WHERE id=?'
    ).get(id);

    return (row != undefined);
  }

  /**
   * This sets up the bridge table
   */
  private setupBridgeTable() {
    LogService.info(
      'marco-db: bridges',
      'Setting up bridge table'
    );
    this.db.prepare(
      'CREATE TABLE IF NOT EXISTS bridges (' +
      'id TEXT PRIMARY KEY NOT NULL,' +
      'room TEXT NOT NULL UNIQUE' +
      ')'
    ).run();
  }
}
