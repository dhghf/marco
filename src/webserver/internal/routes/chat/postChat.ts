import { NextFunction, Request, Response } from "express";
import * as Errors from "../../errors";
import { fail } from "../../validate";
import { Main } from "../../../../Main";
import { Bridge } from "../../../../bridging";
import { LogService } from "matrix-bot-sdk";
import { MCEvents } from "../../../../minecraft";


/**
 * POST /chat/
 * Polo will call this endpoint when there's a new message in the Minecraft
 * chat
 * Example body:
 * {
 *   "message": <player message string>,
 *   "player": {
 *     "name": <player name string>,
 *     "uuid": <player uuid string>
 *   }
 * }
 * @param {Request} req
 * @param {Response} res
 * @returns {Promise<void>}
 */
export async function postChat(req: Request, res: Response): Promise<void> {
  // @ts-ignore
  const main: Main = req['main'];
  // @ts-ignore
  const bridge: Bridge = req['bridge'];
  // @ts-ignore
  const id: string = req['id'];
  const body = req.body;
  const message: string = body['message'];
  const playerRaw: { name: string, uuid: string, displayName?: string, texture?: string } = body.player;
  const player = await main.players.getPlayer(playerRaw.name, playerRaw.uuid, playerRaw.displayName, playerRaw.texture);
  const mcMessage: MCEvents.Message = {
    message,
    player
  }

  await main.sendToMatrix(bridge, mcMessage);
  res.status(200);
  res.end();
  LogService.info(
    'WebInterface',
    `[Request ${id}]: Finished`
  );
}

/**
 * This checks the body of the request to make sure everything checks up
 * correctly.
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export function checkChatIntegrity(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  const reqID = req['id'];
  const body = req.body;

  LogService.info(
    'WebInterface',
    `[Request ${reqID}]: Checking Chat Body Integrity`
  );

  // Check message
  const message = body['message'];
  if (message == undefined) {
    fail(res, Errors.noMessageError);
    return;
  } else if (!(typeof message == 'string')) {
    fail(res, Errors.messageTypeError);
    return;
  }

  LogService.debug(
    'WebInterface',
    `[Request ${reqID}]: Message "${message}"`
  )

  /**
   * If the integrity passed this is what the body should look like:
   * {
   *   "message": "The body of the message",
   *   "player" {
   *     "name": "player name",
   *     "uuid": "player uuid"
   *   }
   * }
   */
  next();
}
