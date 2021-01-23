import { Database } from 'better-sqlite3';
import { LogService } from 'matrix-bot-sdk';
import { Bridge } from '../../bridging';
import { NotBridgedError } from '../../models/errors';

/**
 * This manages the bridge table in marco.db.
 */
export default class BridgeTable {
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
      'INSERT INTO bridging (id, room) VALUES (?,?)',
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
      'SELECT room FROM bridging WHERE id=?',
    ).get(id);
    const roomID: string | undefined = row?.room;

    if (roomID) {
      return new Bridge(id, roomID);
    }
    throw new NotBridgedError();
  }

  /**
   * This deletes a bridge establishment
   * @param {string} room Room ID
   * @returns {boolean} Whether it worked or not
   */
  public unBridge(room: string): boolean {
    const info = this.db.prepare(
      'DELETE FROM bridging WHERE room=?',
    ).run(room);

    return (info.changes > 0);
  }

  /**
   * This checks to see if a room is associated with a bridge ID already.
   * @param {string} room Room ID
   * @returns {boolean}
   */
  public isRoomBridged(room: string): boolean {
    const row = this.db.prepare(
      'SELECT id FROM bridging WHERE room=?',
    ).get(room);

    return (row !== undefined);
  }

  /**
   * This checks if the provided bridge ID is associated with a room already
   * @param {string} id Bridge identifier
   * @returns {boolean}
   */
  public isBridged(id: string): boolean {
    const row = this.db.prepare(
      'SELECT id FROM bridging WHERE id=?',
    ).get(id);

    return (row !== undefined);
  }

  /**
   * This sets up the bridge table
   */
  private setupBridgeTable() {
    LogService.info(
      'marco-db: bridging',
      'Setting up bridge table',
    );
    this.db.prepare(
      'CREATE TABLE IF NOT EXISTS bridging ('
      + 'id text primary key NOT NULL,'
      + 'room text NOT NULL'
      + ')',
    ).run();
  }
}
