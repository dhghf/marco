import { Request, Response } from "express";
import { Main } from "../../../../Main";
import { Bridge } from "../../../../bridging";
import { LogService } from "matrix-bot-sdk";
import { MCEvents } from "../../../../minecraft";


/**
 * POST /player/quit
 * Polo will call this endpoint when a user quits the Minecraft server
 * Example body:
 * {
 *   "player": {
 *     "name": <player name string>,
 *     "uuid": <player uuid string>
 *   }
 * }
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
export async function postQuit(req: Request, res: Response): Promise<void> {
  // @ts-ignore
  const main: Main = req['main'];
  // @ts-ignore
  const bridge: Bridge = req['bridge'];
  // @ts-ignore
  const id: string = req['id'];
  const body = req.body;
  const playerRaw: { name: string, uuid: string, displayName?: string, texture?: string } = body.player;
  const player = await main.players.getPlayer(playerRaw.name, playerRaw.uuid, playerRaw.displayName, playerRaw.texture);
  const mcQuit: MCEvents.Quit = {
    player
  }

  await main.quitToMatrix(bridge, mcQuit);
  res.status(200);
  res.end();
  LogService.info(
    'marco-webserver',
    `Request ${id}`,
    '- Finished.'
  );
}
