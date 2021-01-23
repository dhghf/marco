import { Appservice } from 'matrix-bot-sdk';
import Main from '../../MainController';
import { BridgeErrors } from '../../models/errors';
import { Config } from '../../Config';
import {
  MxEvents as MXEvents,
} from '../../models/types';

/**
 * This class handles all the commands on the Matrix side a user can use
 * "!minecraft" to interact with the bot and establish a bridge.
 */
export default class CmdManager {
  public static readonly prefix = '!minecraft';

  private static readonly help =
    'Command List:\n'
    // see <CmdBridge>.handleBridge method
    + ' - bridge <room ID>: This will provide an access token to give a'
    + ' Minecraft server to send and retrieve messages in the room with.\n'
    // see <CmdBridge>.handleUnbridge method
    + ' - unbridge [<room ID>]: This will forcefully invalidate any tokens'
    + ' corresponding with this room\n'
    + ' - announce <...announcement>: This will send an announcement as'
    + ' "Server". Send this command in a bridged room.'

  private readonly appservice: Appservice;

  private readonly main: Main;

  private readonly config: Config;

  constructor(appservice: Appservice, main: Main, config: Config) {
    this.appservice = appservice;
    this.main = main;
    this.config = config;
  }

  /**
   * This handles m.room.message events that involve commands
   * @param {string} room Room ID
   * @param {string} sender
   * @param {string} body Text-body of the command
   */
  public async onMxMessage(room: string, sender: string, body: string) {
    // args = ["!minecraft", "bridge" || "unbridge" || undefined]
    const args = body.split(' ');
    const client = this.appservice.botClient;
    const announcement = body.substr(
      CmdManager.prefix.length + ' announce'.length,
    );

    switch (args[1]) {
      case 'bridge':
        await this.bridge(room, sender, args);
        break;
      case 'unbridge':
        await this.unbridge(room, sender, args);
        break;
      case 'announce':
        await this.announce(room, sender, announcement);
        break;
      default:
        await client.sendNotice(room, CmdManager.help);
    }
  }

  /**
   * This checks if the user is appropriately whitelisted
   * @param {string} user User to check
   * @returns {boolean} true if whitelisted or whitelist disabled
   */
  private checkWhitelist(user: string): boolean {
    return !this.config.appservice.userWhitelist
           || this.config.appservice.userWhitelist.length === 0
           || this.config.appservice.userWhitelist.includes(user);
  }

  /**
   * This checks if the user has a power level greater than state_default
   * @param {string} room Room checking from
   * @param {string} target Room to check
   * @param {string} user User checking
   * @returns {Promise<boolean>}
   */
  private async checkPrivilege(room: string, target: string, user: string): Promise<boolean> {
    const client = this.appservice.botClient;
    const powerLevels = await client.getRoomStateEvent(
      target,
      'm.room.power_levels',
      '',
    );
    const stateEventPower: number = powerLevels.state_default || 50;
    const senderPower: number = powerLevels.users[user] || 0;
    const hasPerms = (senderPower >= stateEventPower);

    if (!hasPerms) {
      await client.sendNotice(
        room,
        `You need a higher power level (<${stateEventPower})`,
      );
    }

    return hasPerms;
  }

  /**
   * This handles bridging errors
   * @param {string} room Room to talk in
   * @param {any} err Error to talk about
   */
  private async bridgeError(room: string, err: any) {
    const client = this.appservice.botClient;

    if (err instanceof BridgeErrors.BridgedAlreadyError) {
      await client.sendNotice(
        room,
        'This room is already bridged to a server.',
      );
    } else if (err instanceof Error) {
      if (err.message === 'Invalid room ID or alias') {
        await client.sendNotice(
          room,
          CmdManager.help,
        );
      } else {
        await client.sendNotice(
          room,
          `Something went wrong: ${err.message}`,
        );
      }
    } else if (err instanceof Object
               && err.body instanceof Object
               && typeof err.body.error === 'string') {
      // The error string from the Matrix server may be in there containing
      // useful feedback
      await client.sendNotice(
        room,
        `Something went wrong: ${err.body.error}`,
      );
    } else {
      await client.sendNotice(
        room,
        'Something went wrong',
      );
    }
  }

  /**
   * Makes an announcement as the Server in Minecraft.
   * @param {string} room Room ID
   * @param {string} sender User ID
   * @param {string} body Body of the announcement
   */
  private async announce(room: string, sender: string, body: string) {
    const client = this.appservice.botClient;
    const hasPerms = await this.checkPrivilege(room, room, sender);

    if (!hasPerms) {
      return;
    }

    const isBridged = await this.main.bridges.isRoomBridged(room);

    if (isBridged) {
      this.main.sendToMinecraft({
        room,
        sender,
        body: `[Server] ${body}`,
        event: <MXEvents.AnnounceMessageEvent> {
          sender: {
            mxid: sender,
            displayName: sender,
          },
          type: 'message.announce',
          body,
        } as MXEvents.Event,
      });
      await client.sendNotice(room, 'Sent!');
    } else {
      await client.sendNotice(room, "This room isn't bridged.");
    }
  }

  /**
   * Establishes a new bridge
   * @param {string} room
   * @param {string} sender
   * @param {string[]} args ["!minecraft", "bridge", "<room id>" || undefined]
   * @returns {Promise<void>}
   */
  private async bridge(room: string, sender: string, args: string[]) {
    const client = this.appservice.botClient;

    if (!this.checkWhitelist(sender)) {
      await client.sendNotice(room,
        'You are not whitelisted in the bridge config');
      return;
    }

    try {
      // Get the room they're referring to
      const target = await client.resolveRoom(args[2] || '');

      // Make sure the bot is present in the room, otherwise any privilege
      // check we do may use stale power levels.
      // We probably shouldn't just try joining in case the user isn't actually
      // allowed to start bridging there.
      // NOTE the matrix-bot-sdk's MatrixClient already has this cached, but
      // its private so we can't use it.
      const joinedRoomIds = await client.getJoinedRooms();
      if (joinedRoomIds.indexOf(target) === -1) {
        const userId = await client.getUserId();
        await client.sendNotice(room,
          'Bridge bot is not in that room. '
          + `Please invite ${userId} to the room and try again.`);
        return;
      }

      // See if the user has state_default perms
      const hasPerms = await this.checkPrivilege(room, target, sender);
      if (hasPerms) {
        const bridge = this.main.bridges.bridge(target);
        await client.sendNotice(
          room,
          'Bridged! Go-to the Minecraft server and execute'
          + `"/bridge <token>"\n${bridge.id}`,
        );
      }
    } catch (err) {
      await this.bridgeError(room, err);
    }
  }

  /**
   * Remove a bridge
   * @param {string} room
   * @param {string} sender
   * @param {string[]} args
   * ["!minecraft", "unbridge", "<room id>" || undefined]
   * @returns {Promise<void>}
   */
  private async unbridge(room: string, sender: string, args: string[]) {
    const client = this.appservice.botClient;

    try {
      // Get the room they're referring to
      const target = await client.resolveRoom(args[2] || room);

      // See if the user has state_default perms
      const hasPerms = await this.checkPrivilege(room, target, sender);

      if (hasPerms) {
        const unbridged = this.main.bridges.unbridge(target);

        if (unbridged) await client.sendNotice(room, 'Room has been unbridged.');
        else await client.sendNotice(room, 'The room was never bridged.');
      }
    } catch (err) {
      await this.bridgeError(room, err);
    }
  }
}
