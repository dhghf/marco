import { LogService } from 'matrix-bot-sdk';
import { Request, Response, Router } from 'express';
import Main from '../../../MainController';
import Route from '../route';
import {
  MCServerEvents as MCEvents,
} from '../../../models/types';

export default class ChatRoute extends Route {
  constructor(main: Main) {
    const router = Router();
    super(main, router);
  }

  public getRouter(): Router {
    this.router.get('/', this.retrieve.bind(this));
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
