import { NextFunction, Request, Response } from "express";
import { Main } from "../../../../Main";
import { Bridge } from "../../../../bridging";
import { LogService } from "matrix-bot-sdk";
import { MCEvents } from "../../../../minecraft";
import { fail } from "../../validate";
import * as Errors from "../../errors";


/**
 * POST /player/kick
 * Polo will call this endpoint when a user gets kicked from the Minecraft server
 * Example body:
 * {
 *   "reason": <kick reason>,
 *   "player": {
 *     "name": <player name string>,
 *     "uuid": <player uuid string>
 *   }
 * }
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
export async function postKick(req: Request, res: Response): Promise<void> {
  // @ts-ignore
  const main: Main = req['main'];
  // @ts-ignore
  const bridge: Bridge = req['bridge'];
  // @ts-ignore
  const id: string = req['id'];
  const body = req.body;
  const reason: string = body['reason'];
  const playerRaw: { name: string, uuid: string, displayName?: string, texture?: string } = body.player;
  const player = await main.players.getPlayer(playerRaw.name, playerRaw.uuid, playerRaw.displayName, playerRaw.texture);
  const mcKick: MCEvents.Kick = {
    reason,
    player
  }

  await main.kickToMatrix(bridge, mcKick);
  res.status(200);
  res.end();
  LogService.info(
    'marco-webserver',
    `Request ${id}`,
    '- Finished.'
  );
}

/**
 * This checks the body of the request to make sure everything checks up
 * correctly.
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export function checkKickIntegrity(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  const reqID = req['id'];
  const body = req.body;

  LogService.info(
    'WebInterface',
    `[Request ${reqID}]: Checking Kick Body Integrity`
  );

  // Check reason
  const reason = body['reason'];
  if (reason == undefined) {
    fail(res, Errors.noReasonError);
    return;
  } else if (!(typeof reason == 'string')) {
    fail(res, Errors.reasonTypeError);
    return;
  }

  LogService.debug(
    'WebInterface',
    `[Request ${reqID}]: Reason "${reason}"`
  )

  /**
   * If the integrity passed this is what the body should look like:
   * {
   *   "reason": "The reason for the kick",
   *   "player" {
   *     "name": "player name",
   *     "uuid": "player uuid"
   *   }
   * }
   */
  next();
}
