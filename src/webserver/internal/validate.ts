import {
  NextFunction, Router, Request, Response,
} from 'express';
import { LogService } from 'matrix-bot-sdk';

import * as Errors from './errors';

export function fail(res: Response, error: object): void {
  res.status(400);
  res.send(error);
  res.end();
}

function errorHandler(req: Request, err: any): void {
  // @ts-ignore
  const { id } = req;
  if (err instanceof Error) {
    LogService.error(
      'marco-webserver',
      `Request ${id}`,
      err.message,
    );
  } else {
    LogService.error(
      'marco-webserver',
      `Request ${id}`,
      err,
    );
  }
}

export function validatePost(router: Router, endpoint: string, callback: Function) {
  // this checks to make sure Polo is calling the endpoint properly
  router.post(endpoint, ((req, res, next) => {
    try {
      callback(req, res, next);
    } catch (err) {
      errorHandler(req, err);
    }
  }));
}

export function handlePostAsync(router: Router, endpoint: string, callback: Function) {
  // this checks to make sure Polo is calling the endpoint properly
  router.post(endpoint, (async (req, res) => {
    try {
      await callback(req, res);
    } catch (err) {
      errorHandler(req, err);
    }
  }));
}

export function handleGet(router: Router, endpoint: string, callback: Function) {
  // this checks to make sure Polo is calling the endpoint properly
  router.get(endpoint, ((req, res) => {
    try {
      callback(req, res);
    } catch (err) {
      errorHandler(req, err);
    }
  }));
}

/**
 * This checks the body of the request to make sure everything checks up
 * correctly.
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export function checkPlayerIntegrity(req: Request, res: Response, next: NextFunction) {
  // @ts-ignore
  const reqID = req.id;
  const { body } = req;

  LogService.info(
    'WebInterface',
    `[Request ${reqID}]: Checking Body Integrity`,
  );

  // Check if body is defined
  if (body === undefined) {
    fail(res, Errors.noBodyError);
    return;
  }

  // Check player
  const { player } = body;
  if (player === undefined) {
    fail(res, Errors.noPlayerError);
    return;
  } if (!(typeof player === 'object')) {
    fail(res, Errors.playerTypeError);
    return;
  }

  // Check <player>.name
  const { name } = player;
  if (name === undefined) {
    fail(res, Errors.noPlayerNameError);
    return;
  } if (!(typeof name === 'string')) {
    fail(res, Errors.playerNameTypeError);
    return;
  }

  LogService.debug(
    'WebInterface',
    `[Request ${reqID}]: Player name "${name}"`,
  );

  // Check <player>.uuid
  const { uuid } = player;
  if (uuid === undefined) {
    fail(res, Errors.noPlayerIdError);
  } else if (!(typeof uuid === 'string')) {
    fail(res, Errors.playerIdTypeError);
    return;
  }

  LogService.debug(
    'WebInterface',
    `[Request ${reqID}]: Player UUID "${uuid}"`,
  );

  LogService.info(
    'WebInterface',
    `[Request ${reqID}]: Integrity Check Passed`,
  );

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
