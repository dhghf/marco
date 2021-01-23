import { LogService } from 'matrix-bot-sdk';
import express, {
  Router,
  Request,
  Response,
} from 'express';
import { Bridge } from '../../../bridging';
import Main from '../../../MainController';
import Route from '../route';
import { MCServerEvents as MCEvents } from '../../../models/types';

export default class PlayerRoute extends Route {
  constructor(main: Main) {
    const router = Router();
    super(main, router);
  }

  public getRouter(): Router {
    this.router.use('/', express.json());
    this.router.use('/', (_, res, next) => {
      res.setHeader('Content-Type', 'application/json');
      next();
    });

    this.router.post('/join', this.join.bind(this));
    this.router.post('/quit', this.quit.bind(this));
    this.router.post('/kick', this.kick.bind(this));

    return this.router;
  }

  /**
   * POST /player/join
   * Polo will call this endpoint when a user joins the Minecraft server
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
    const { body } = req;
    const playerID: string = body.player;
    const player = await this.main.players.getPlayer(playerID);
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
    const { bridge }: Bridge = req;
    // @ts-ignore
    const { id }: string = req;
    const { body } = req;
    const { reason } = body;
    const playerID: string = body.player;
    const player = await this.main.players.getPlayer(playerID);
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
    const { bridge }: Bridge = req;
    // @ts-ignore
    const { id }: string = req;
    const { body } = req;
    const playerID: string = body.player;
    const player = await this.main.players.getPlayer(playerID);
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
