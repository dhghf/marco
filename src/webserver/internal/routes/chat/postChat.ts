import { NextFunction, Request, Response } from "express";
import * as Errors from "../../errors";
import { Marco, McMessage } from "../../../../Marco";
import { Bridge } from "../../../../common/Bridge";
import { LogService } from "matrix-bot-sdk";


/**
 * POST /chat/
 * Polo will call this endpoint when there's a new message in the Minecraft
 * chat
 * Example body:
 * {
 *   "body": <player message string>,
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
  const marco: Marco = req['marco'];
  // @ts-ignore
  const bridge: Bridge = req['bridge'];
  // @ts-ignore
  const id: string = req['id'];
  const body = req.body;
  const message: string = body['body'];
  const playerRaw: { name: string, uuid: string } = body.player;
  const player = await marco.players.getPlayer(playerRaw.name, playerRaw.uuid);
  const mcMessage: McMessage = {
    room: bridge.room,
    body: message,
    player
  }


  await marco.onMcChat(mcMessage);
  res.status(200);
  res.end();
  LogService.info(
    'marco-webserver',
    `Request ${id}`,
    'finished.'
  );
}

/**
 * This checks the body of the request to make sure everything checks up
 * correctly.
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export function checkIntegrity(req: Request, res: Response, next: NextFunction) {
  const body = req.body;

  // Check if body is defined
  if (body == undefined) {
    fail(res, Errors.noBodyError);
    return;
  }

  // Check message
  const message = body['body'];
  if (message == undefined) {
    fail(res, Errors.noMessageError);
    return;
  } else if (!(typeof message == 'string')) {
    fail(res, Errors.messageTypeError);
    return;
  }

  // Check player
  const player = body['player'];
  if (player == undefined) {
    fail(res, Errors.noPlayerError);
    return;
  } else if (!(typeof player == 'object')) {
    fail(res, Errors.playerTypeError);
    return;
  }

  // Check <player>.name
  const name = player.name;
  if (name == undefined) {
    fail(res, Errors.noPlayerNameError);
    return;
  } else if (!(typeof name == 'string')) {
    fail(res, Errors.playerNameTypeError);
    return;
  }

  // Check <player>.uuid
  const uuid = player.uuid;
  if (uuid == undefined) {
    fail(res, Errors.noPlayerIdError);
  } else if (!(typeof uuid == 'string')) {
    fail(res, Errors.playerIdTypeError);
    return;
  }

  /**
   * If the integrity passed this is what the body should look like:
   * {
   *   "body": "The body of the message",
   *   "player" {
   *     "name": "player name",
   *     "uuid": "player uuid"
   *   }
   * }
   */
  next();
}

function fail(res: Response, error: object): void {
  res.status(400);
  res.send(error);
  res.end();
}