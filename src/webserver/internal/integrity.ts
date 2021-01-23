import {
  Response,
} from 'express';

export default class Integrity {
  public static fail(res: Response, error: any): void {
    res.status(400);
    res.send(error);
    res.end();
  }
}
