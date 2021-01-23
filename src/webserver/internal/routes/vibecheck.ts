import {
  Request,
  Response,
  Router,
} from 'express';
import { LogService } from 'matrix-bot-sdk';
import { v1 as uuid } from 'uuid';
import MainController from '../../../MainController';
import { BridgeErrors, ServerErrors } from '../../../models/errors';
import Route from '../route';

export default class VibeCheckRoute extends Route {
  constructor(main: MainController) {
    const router = Router();
    super(main, router);
  }

  public getRouter(): Router {
    this.router.get('/', this.vibeCheck.bind(this));
    return this.router;
  }

  /**
   * This intakes an HTTP request that has a bearer token. In that token
   * should determine whether or not it's bridged with a room. If it is
   * then we're vibing, otherwise not so much.
   * @param {Request} req The request object being read from
   * @param {Response} res The response object being sent to the requester
   */
  private vibeCheck(req: Request, res: Response) {
    const auth = req.header('Authorization');
    const id = uuid();

    LogService.info('WebInterface', `[Request ${id}]`);
    LogService.info(
      'WebInterface',
      `[Request ${id}]: Endpoint ${req.method} ${req.path}`,
    );

    try {
      res.setHeader('Content-Type', 'application/json');

      // Check if they provided an auth token
      if (!auth) {
        res.status(401);
        res.send(ServerErrors.noTokenError);
        res.end();
        return;
      }

      const token = auth.split(' ')[1];

      if (!token) {
        res.status(401);
        res.send(ServerErrors.noTokenError);
        res.end();
        return;
      }

      const bridge = this.main.bridges.getBridge(token);

      LogService.info('WebInterface', `[Request ${id}]: Authorized`);

      res.status(200);
      res.send({
        status: 'OK',
        bridge: bridge.room,
      });
      res.end();
    } catch (err) {
      if (err instanceof BridgeErrors.NotBridgedError) {
        LogService.warn(
          'WebInterface',
          `[Request ${id}]: Unauthorized`,
        );
        res.status(401);
        res.send(ServerErrors.invalidTokenError);
        res.end();
      } else {
        LogService.error(
          'marco:WebServer',
          err,
        );
        res.status(500);
        res.send(ServerErrors.serverError);
      }
    }

    LogService.info('WebInterface', `[Request ${id}]: Finished`);
  }
}
