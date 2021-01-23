import { Request, Response } from "express";
import { Main } from "../../../../Main";
import { Bridge } from "../../../../bridging";
import { LogService } from "matrix-bot-sdk";
import { MCEvents } from "../../../../minecraft";


/**
 * POST /player/join
 * Polo will call this endpoint when a user joins the Minecraft server
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
export async function postJoin(req: Request, res: Response): Promise<void> {
  // @ts-ignore
  const main: Main = req['main'];
  // @ts-ignore
  const bridge: Bridge = req['bridge'];
  // @ts-ignore
  const id: string = req['id'];
  const body = req.body;
  const playerRaw: { name: string, uuid: string, displayName?: string, texture?: string } = body.player;
  const player = await main.players.getPlayer(playerRaw.name, playerRaw.uuid, playerRaw.displayName, playerRaw.texture);
  const mcJoin: MCEvents.Join = {
    player
  }

  await main.joinToMatrix(bridge, mcJoin);
  res.status(200);
  res.end();
  LogService.info(
    'marco-webserver',
    `Request ${id}`,
    '- Finished.'
  );
}
