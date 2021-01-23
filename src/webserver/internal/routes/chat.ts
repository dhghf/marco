import { LogService } from 'matrix-bot-sdk';
import {
  NextFunction,
  Request,
  Response,
  Router,
} from 'express';
import Main from '../../../MainController';
import Route from '../route';
import {
  MCServerEvents as MCEvents,
} from '../../../models/types';
import Integrity from '../integrity';
import { ServerErrors } from '../../../models/errors';

/**
 * Check the integrity of each request
 */
class ChatIntegrity extends Integrity {
  /**
   * Check the integrity of requests hitting POST /chat before they get
   * processed
   * @param {Request} req The request to check
   * @param {Response} res Response object to use if there is an error
   * @param {NextFunction} next Next callback function, called if everything is
   * okay
   */
  public static submit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    // @ts-ignore
    const reqID = req.id;
    const { body } = req.body;

    LogService.info(
      'WebInterface',
      `[Request ${reqID}]: Checking Chat Body Integrity`,
    );

    // Check message
    const { message } = body;
    if (message === undefined) {
      super.fail(res, ServerErrors.noMessageError);
    } else if (!(typeof message === 'string')) {
      super.fail(res, ServerErrors.messageTypeError);
    }

    LogService.debug(
      'WebInterface',
      `[Request ${reqID}]: Message "${message}"`,
    );

    /**
     * If the integrity passed this is what the body should look like:
     * {
     *   "message": "The body of the message",
     *   "player" "player UUID or name"
     * }
     */
    next();
  }
}

export default class ChatRoute extends Route {
  constructor(main: Main) {
    const router = Router();
    super(main, router);
  }

  public getRouter(): Router {
    this.router.get('/', this.retrieve.bind(this));
    this.router.post('/', ChatIntegrity.submit);
    this.router.post('/', this.submit.bind(this));
    return this.router;
  }

  /**
   * GET /chat
   * @param {Request} req
   * @param {Response} res
   */
  private async retrieve(req: Request, res: Response): Promise<void> {
    // @ts-ignore
    const { bridge } = req;
    // @ts-ignore
    const { id } = req;
    const events = this.main.getNewMxMessages(bridge);
    const chat = {
      events,
    };

    res.status(200);
    res.send(chat);
    res.end();
    LogService.info(
      'WebInterface',
      `[Request ${id}]: Finished.`,
    );
  }

  /**
   * POST /chat/
   * The plugin will call this endpoint when there's a new message in the
   * Minecraft chat
   * Example body:
   * {
   *   "message": <player message string>,
   *   "player": <player identifier string>
   * }
   * @param {Request} req
   * @param {Response} res
   * @returns {Promise<void>}
   */
  private async submit(req: Request, res: Response): Promise<void> {
    // @ts-ignore
    const { bridge } = req;
    // @ts-ignore
    const { id } = req;
    const { body } = req;
    const { message } = body;
    const playerID: string = body.player;
    const player = await this.main.players.getPlayer(playerID);
    const mcMessage: MCEvents.MessageEvent = {
      message,
      player,
    };

    await this.main.sendToMatrix(bridge, mcMessage);
    res.status(200);
    res.end();
    LogService.info(
      'WebInterface',
      `[Request ${id}]: Finished`,
    );
  }
}
