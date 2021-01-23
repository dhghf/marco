import connection, { Database } from 'better-sqlite3';
import BridgeTable from './tables/BridgeTable';
import type { Config } from '../Config';

/**
 * This is the database controller
 * @prop {BridgeTable} bridges This interfaces with the "bridges" table.
 */
export default class DBController {
  public readonly bridges: BridgeTable;

  private readonly db: Database

  constructor(config: Config) {
    this.db = connection(config.database.location);
    this.bridges = new BridgeTable(this.db);
  }
}
