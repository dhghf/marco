import { LogService } from 'matrix-bot-sdk';
import express, {
  NextFunction,
  Router,
  Request,
  Response,
} from 'express';
import Route from '../route';
import { MCServerEvents as MCEvents } from '../../../models/types';
import Integrity from '../integrity';
import { ServerErrors } from '../../../models/errors';
import MainController from '../../../MainController';
import { Player } from '../../../minecraft';

class PlayerIntegrity extends Integrity {
  private readonly main: MainController;

  constructor(main: MainController) {
    super();
    this.main = main;
  }

  public async all(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { body } = req;

    const playerID = body.player;
    if (playerID === undefined) {
      Integrity.fail(res, ServerErrors.noPlayerError);
      return;
    }

    if (!(typeof playerID === 'string')) {
      Integrity.fail(res, ServerErrors.playerTypeError);
      return;
    }

    try {
      const player = await this.main.players.getPlayer(playerID);

      // @ts-ignore
      req.player = player;

      next();
    } catch (err) {
      Integrity.fail(res, ServerErrors.noPlayerIdError);
    }
  }

  public static kick(req: Request, res: Response, next: NextFunction): void {
    // @ts-ignore
    const reqID = req.id;
    const { body } = req;

    LogService.info(
      'WebInterface',
      `[Request ${reqID}]: Checking Kick Body Integrity`,
    );

    // Check reason
    const { reason } = body;
    if (reason === undefined) {
      Integrity.fail(res, ServerErrors.noReasonError);
      return;
    }

    if (!(typeof reason === 'string')) {
      Integrity.fail(res, ServerErrors.reasonTypeError);
      return;
    }

    LogService.debug(
      'WebInterface',
      `[Request ${reqID}]: Reason "${reason}"`,
    );

    /**
     * If the integrity passed this is what the body should look like:
     * {
     *   "reason": "The reason for the kick",
     *   "player" "player UUID or name"
     * }
     */
    next();
  }
}

export default class PlayerRoute extends Route {
  private readonly integrity: PlayerIntegrity;

  constructor(main: MainController) {
    const router = Router();
    super(main, router);
    this.integrity = new PlayerIntegrity(main);
  }

  public getRouter(): Router {
    this.router.use('/', express.json());
    this.router.use('/', (_, res, next) => {
      res.setHeader('Content-Type', 'application/json');
      next();
    });

    this.router.use('/', this.integrity.all.bind(this.integrity));
    this.router.post('/join', this.join.bind(this));
    this.router.post('/quit', this.quit.bind(this));
    this.router.post('/kick', PlayerIntegrity.kick);
    this.router.post('/kick', this.kick.bind(this));

    return this.router;
  }

  /**
   * POST /player/join
   * The plugin will call this endpoint when a user joins the Minecraft server
   * Example body:
   * {
   *   "player": <player identifier string>
   * }
   * @param {Request} req
   * @param {Response} res
   * @returns {Promise<void>}
   */
  private async join(req: Request, res: Response): Promise<void> {
    // @ts-ignore
    const { bridge } = req;
    // @ts-ignore
    const { id } = req;
    // @ts-ignore
    const player: Player = req;
    const mcJoin: MCEvents.JoinEvent = {
      player,
    };

    await this.main.joinToMatrix(bridge, mcJoin);
    res.status(200);
    res.end();
    LogService.info(
      'marco-webserver',
      `Request ${id}`,
      '- Finished.',
    );
  }

  /**
   * POST /player/kick
   * Polo will call this endpoint when a user gets kicked from the Minecraft server
   * Example body:
   * {
   *   "reason": <kick reason string>,
   *   "player": <player identifier string>
   * }
   * @param {Request} req
   * @param {Response} res
   * @returns {Promise<void>}
   */
  private async kick(req: Request, res: Response): Promise<void> {
    // @ts-ignore
    const { bridge } = req;
    // @ts-ignore
    const { id } = req;
    // @ts-ignore
    const player: Player = req;
    const { body } = req;
    const { reason } = body;
    const mcKick: MCEvents.KickEvent = {
      reason,
      player,
    };

    await this.main.kickToMatrix(bridge, mcKick);
    res.status(200);
    res.end();
    LogService.info(
      'marco-webserver',
      `Request ${id}`,
      '- Finished.',
    );
  }

  /**
   * POST /player/quit
   * Polo will call this endpoint when a user quits the Minecraft server
   * Example body:
   * {
   *   "player": <player identifier string>
   * }
   * @param {Request} req
   * @param {Response} res
   * @returns {Promise<void>}
   */
  private async quit(req: Request, res: Response): Promise<void> {
    // @ts-ignore
    const { bridge } = req;
    // @ts-ignore
    const player: Player = req;
    // @ts-ignore
    const { id } = req;
    const mcQuit: MCEvents.QuitEvent = {
      player,
    };

    await this.main.quitToMatrix(bridge, mcQuit);
    res.status(200);
    res.end();
    LogService.info(
      'marco-webserver',
      `Request ${id}`,
      '- Finished.',
    );
  }
}
