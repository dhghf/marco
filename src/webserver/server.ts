import type {
  NextFunction, Request, Response, Router,
} from 'express';
import { LogService } from 'matrix-bot-sdk';
import { v1 as uuid } from 'uuid';
import type { Config } from '../Config';
import type Main from '../MainController';
import { BridgeErrors, ServerErrors } from '../models/errors';
import ChatRoute from './internal/routes/chat';
import PlayerRoute from './internal/routes/player';
import VibeCheckRoute from './internal/routes/vibecheck';

export default class WebServer {
  private readonly main: Main

  private readonly config: Config;

  public constructor(config: Config, main: Main) {
    this.main = main;
    this.config = config;
  }

  /**
   * This starts the webserver
   * @param {Router} app Router to extend off of
   */
  public start(app: Router) {
    const chatRoute = new ChatRoute(this.main);
    const playerRoute = new PlayerRoute(this.main);
    const vibeCheck = new VibeCheckRoute(this.main);

    // Vibe check for checking client to server integrity, if it passes the
    // checkAuth method then everything is good
    app.get('/vibecheck', vibeCheck.getRouter());

    // Chat endpoint for getting messages and posting minecraft chat messages
    app.use('/chat', chatRoute.getRouter());

    // Player endpoint for posting minecraft player events
    app.use('/player', playerRoute.getRouter());

    // Check all authorization headers at these endpoints
    app.use('/chat', this.checkAuth.bind(this));
    app.use('/events', this.checkAuth.bind(this));
    app.use('/player', this.checkAuth.bind(this));
  }

  /**
   * Every request needs to be authorized
   * @param {Request} req The request object being read from
   * @param {Response} res The response object being sent to the requester
   * @param {NextFunction} next This is called if the checkAuth passes
   */
  private checkAuth(req: Request, res: Response, next: NextFunction) {
    // This represents the identifier for the request being made (for
    // logging purposes)
    const id = uuid();

    LogService.info('WebInterface', `[Request ${id}]`);
    LogService.info(
      'WebInterface',
      `[Request ${id}]: Endpoint ${req.method} ${req.path}`,
    );

    const auth = req.header('Authorization');

    // Let's see if they actually provided an authorization header
    if (auth === undefined) {
      res.status(401);
      res.end();
      return;
    }
    // split = ['Bearer', <access token>]
    const split = auth.split(' ');

    // Make sure they provided "Bearer <access token>"
    if (split.length < 2) {
      res.status(401);
      res.end();
      return;
    }

    // This is the token they provided in the authorization header
    const token = split[1];

    try {
      // The BrideManager associates tokens with rooms and if this is a
      // valid token it will result in a Bridge type otherwise it will
      // throw a NotBridgedError
      const bridge = this.main.bridges.getBridge(token);

      LogService.info(
        'WebInterface',
        `[Request ${id}]: Authorized`,
      );

      // @ts-ignore
      req.bridge = bridge;
      // @ts-ignore
      req.id = id;

      next();
    } catch (err) {
      if (err instanceof BridgeErrors.NotBridgedError) {
        res.status(401);
        res.send(ServerErrors.invalidTokenError);
        res.end();
      } else {
        res.status(500);
        res.send(ServerErrors.serverError);
        res.end();
      }
    }
  }
}
