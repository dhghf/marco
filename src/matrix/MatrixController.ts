import * as matrix from 'matrix-bot-sdk';
import { LogService } from 'matrix-bot-sdk';
import RegManager from './internal/RegManager';
import { Config } from '../Config';
import type Main from '../MainController';
import { Bridge } from '../bridging';
import CmdManager from './internal/CmdManager';
import MsgProcessor from './internal/MsgProcessor';
import type { MxEvents, MCServerEvents as MCEvents } from '../models/types';
import { PlayerManager } from '../minecraft';

export type MxMessage = {
  sender: string;
  room: string;
  body?: string;
  event: MxEvents.Event;
}

/**
 * The MatrixManager class has everything to do with Matrix's appservice
 * API and a couple utilities such as checking if a room exists. It's
 * responsible for keeping an appservice user in sync with their
 * corresponding Minecraft player by communicating with the PlayerManager.
 * It also stores new room messages in the newMxMessages for the Minecraft
 * server to retrieve periodically.
 */
export default class MatrixController {
  // Interfaces with Matrix
  public readonly appservice: matrix.Appservice;

  private readonly main: Main;

  // Collects new messages for Minecraft servers
  private readonly newMxMessages: Map<string, MxEvents.PossibleEvents[]>

  // Handles commands given by Matrix users
  private readonly cmdManager: CmdManager;

  // Converts matrix messages into McMessages
  private readonly msgProcessor: MsgProcessor;

  constructor(config: Config, marco: Main) {
    const registration = RegManager.getRegistration(config);

    this.main = marco;
    this.msgProcessor = new MsgProcessor(this);
    this.appservice = new matrix.Appservice({
      registration,
      bindAddress: config.appservice.bindAddress,
      homeserverName: config.appservice.homeserverName,
      homeserverUrl: config.appservice.homeserverURL,
      port: config.appservice.port,
    });
    this.cmdManager = new CmdManager(this.appservice, this.main, config);
    this.newMxMessages = new Map();
  }

  /**
   * This begins the appservice, it's important to call this method first
   * before anything else.
   * @returns {Promise<void>}
   */
  public async start(): Promise<void> {
    matrix.AutojoinRoomsMixin.setupOnAppservice(this.appservice);

    this.appservice.on('room.message', this.onMxMessage.bind(this));
    this.appservice.on('room.leave', this.onMxLeave.bind(this));
    this.appservice.on('query.user', this.onQueryUser.bind(this));

    await this.appservice.begin();
  }

  /**
   * This intakes a Minecraft chat message and relays it the provided bridged
   * room.
   * @param {Bridge} bridge
   * @param {MCEvents.Message} mcMessage
   * @returns {Promise<void>}
   */
  public async sendMessage(
    bridge: Bridge,
    mcMessage: MCEvents.MessageEvent,
  ): Promise<void> {
    // The player UUID is the Matrix appservice user's Matrix ID
    const uuid = await mcMessage.player.getUUID();
    // This is the representing Matrix user
    const intent = this.appservice.getIntentForSuffix(uuid);

    try {
      await intent.ensureRegistered();
      // Keep the player name, skin in sync with their profile data on Matrix
      await PlayerManager.sync(intent, mcMessage.player);

      // Finally send the message to the room, half of these steps are
      // skipped to this if everything has already been completed before
      // (such as inviting, joining, and syncing unless the player updated a
      // certain detail that we keep synced)
    } catch (err) {
      let errMessage = 'An error occurred while sending a message to a bridged room.\n';
      if (err instanceof Error) {
        errMessage += ` - message: ${err.message}\n`;
        errMessage += ` - stack:\n${err.stack}`;
      } else {
        errMessage += ` - error: ${err}`;
      }
      LogService.error('marco-matrix', errMessage);
    } finally {
      // what matters most is that the message gets to the room.
      await intent.sendText(
        bridge.room,
        mcMessage.message,
      );
    }
  }

  /**
   * This intakes a Minecraft join event and relays it the provided bridged
   * room.
   * @param {Bridge} bridge
   * @param {MCEvents.Join} mcJoin
   * @returns {Promise<void>}
   */
  public async sendJoin(
    bridge: Bridge,
    mcJoin: MCEvents.JoinEvent,
  ): Promise<void> {
    // The player UUID is the Matrix appservice user's Matrix ID
    const uuid = await mcJoin.player.getUUID();
    // This is the representing Matrix user
    const intent = this.appservice.getIntentForSuffix(uuid);

    try {
      await intent.ensureRegistered();
      // Keep the player name, skin in sync with their profile data on Matrix
      await PlayerManager.sync(intent, mcJoin.player);

      // Finally send the message to the room, half of these steps are
      // skipped to this if everything has already been completed before
      // (such as inviting, joining, and syncing unless the player updated a
      // certain detail that we keep synced)
    } catch (err) {
      let errMessage = 'An error occurred while joining a bridged room.\n';
      if (err instanceof Error) {
        errMessage += ` - message: ${err.message}\n`;
        errMessage += ` - stack:\n${err.stack}`;
      } else {
        errMessage += ` - error: ${err}`;
      }
      LogService.error('marco-matrix', errMessage);
    } finally {
      // what matters most is that the room is joined.
      await intent.joinRoom(
        bridge.room,
      );
    }
  }

  /**
   * This intakes a Minecraft quit event and relays it the provided bridged
   * room.
   * @param {Bridge} bridge
   * @param {MCEvents.Quit} mcQuit
   * @returns {Promise<void>}
   */
  public async sendQuit(
    bridge: Bridge,
    mcQuit: MCEvents.QuitEvent,
  ): Promise<void> {
    // The player UUID is the Matrix appservice user's Matrix ID
    const uuid = await mcQuit.player.getUUID();
    // This is the representing Matrix user
    const intent = this.appservice.getIntentForSuffix(uuid);

    try {
      await intent.ensureRegistered();
      // We don't bother keeping the player name, skin in sync with their
      // profile data on Matrix right now, since the player is leaving

      // Finally send the event to the room, half of these steps are
      // skipped to this if everything has already been completed before
      // (such as inviting & joining)
    } catch (err) {
      let errMessage = 'An error occurred while leaving a bridged room.\n';
      if (err instanceof Error) {
        errMessage += ` - message: ${err.message}\n`;
        errMessage += ` - stack:\n${err.stack}`;
      } else {
        errMessage += ` - error: ${err}`;
      }
      LogService.error('marco-matrix', errMessage);
    } finally {
      // what matters most is that the room is left.
      await intent.leaveRoom(
        bridge.room,
      );
    }
  }

  /**
   * This intakes a Minecraft kick event and relays it the provided bridged
   * room.
   * @param {Bridge} bridge
   * @param {MCEvents.Kick} mcKick
   * @returns {Promise<void>}
   */
  public async sendKick(
    bridge: Bridge,
    mcKick: MCEvents.KickEvent,
  ): Promise<void> {
    // The player UUID is the Matrix appservice user's Matrix ID
    const uuid = await mcKick.player.getUUID();
    // This is the representing Matrix bot user
    const client = this.appservice.botClient;

    // Perform the kick
    client.kickUser(
      this.appservice.getUserIdForSuffix(uuid),
      bridge.room,
      mcKick.reason,
    );
  }

  /**
   * This returns all the new room messages of a given bridge since the
   * last time requested.
   * @param {Bridge} bridge
   * @returns {MxEvents.Event[]}
   */
  public getNewMxMessages(bridge: Bridge): MxEvents.PossibleEvents[] {
    let newMxMessages = this.newMxMessages.get(bridge.room);

    if (!newMxMessages) {
      newMxMessages = [];
      this.newMxMessages.set(bridge.room, newMxMessages);
    }

    return newMxMessages.splice(0, newMxMessages.length);
  }

  /**
   * This stores all the new Matrix room messages
   * @param {MxMessage} message
   */
  public addNewMxMessage(message: MxMessage) {
    const newMxMessages = this.newMxMessages.get(message.room) || [];

    if (!this.appservice.isNamespacedUser(message.sender)) newMxMessages.push(message.event);

    this.newMxMessages.set(message.room, newMxMessages);
  }

  /**
   * This gets the m.room.member state event of a provided Matrix ID and room
   * @param {string} room The room to retrieve the profile data from
   * @param {string} user The user being retrieved
   * @returns {Promise<any>}
   */
  public async getRoomMember(room: string, user: string): Promise<any> {
    return this.appservice.botClient.getRoomStateEvent(
      room,
      'm.room.member',
      user,
    );
  }

  /**
   * This gets the Minecraft player UUID corresponding to the provided Matrix ID
   * @param {string} user The user being retrieved
   * @returns {string}
   */
  public getPlayerUUID(user: string): string | undefined {
    return this.appservice.getSuffixForUserId(user);
  }

  /**
   * This intakes m.room.message events. It first sees if it's a !minecraft
   * command if it is then it gives it to CmdManager.onMxMessage, otherwise
   * it checks if the message is coming from a bridged room if it is then
   * it process the message and sends it to Main.sendToMinecraft.
   * @param {string} room Room Matrix ID
   * @param {any} event m.room.message event
   */
  private async onMxMessage(room: string, event: any): Promise<void> {
    // Check if the event hasn't already been redacted
    const { content } = event;
    if (!content || !content.body) {
      return;
    }
    const { body } = content;
    const { msgtype } = content;
    const isBridged = this.main.bridges.isRoomBridged(room);

    // Handle command-related messages
    if (msgtype === 'm.text' && body.startsWith(CmdManager.prefix)) {
      await this.cmdManager.onMxMessage(room, event.sender, content.body);
      return;
    }

    // If it isn't a command then check if the m.room.message was sent in a
    // bridged room
    if (!isBridged) {
      return;
    }

    // Handle m.text message
    if (msgtype === 'm.text') {
      const message = await this.msgProcessor.buildTextMsg(room, event);

      // Give it to Main to handle
      this.main.sendToMinecraft(message);

      // Handle m.emote message
    } else if (msgtype === 'm.emote') {
      const message = await this.msgProcessor.buildEmoteMsg(room, event);

      // Give it to Main to handle
      this.main.sendToMinecraft(message);
    }
  }

  /**
   * This intakes m.room.member state events due to leaving, kicking, banning &
   * unbanning. It checks if the member change is a kick, a ban, or an unban.
   * If it is then it processes the state change and sends it to
   * Main.something.
   * @param {string} room Room Matrix ID
   * @param {any} event m.room.member state event
   */
  private async onMxLeave(room: string, event: any): Promise<void> {
    // Check if the m.room.member state event was sent in a bridged room
    const isBridged = this.main.bridges.isRoomBridged(room);
    if (!isBridged) return;

    // Check it relates to one of our Minecraft users
    const stateKey: string = event.state_key;
    if (!this.appservice.isNamespacedUser(stateKey)) return;

    const { content } = event;
    const oldContent: any | undefined = event.prev_content || {};
    const { membership } = content;
    const oldMembership: string = oldContent.membership || 'leave';

    if (membership === 'ban') {
      const message = await this.msgProcessor.buildBanMsg(room, event);

      // Give it to Main to handle
      this.main.sendToMinecraft(message);
    } else if (oldMembership === 'ban') {
      const message = await this.msgProcessor.buildUnbanMsg(room, event);

      // Give it to Main to handle
      this.main.sendToMinecraft(message);
    } else if (membership === 'leave' && oldMembership === 'join') {
      const message = await this.msgProcessor.buildKickMsg(room, event);

      // Give it to Main to handle
      this.main.sendToMinecraft(message);
    }
  }

  /**
   * This queries a Minecraft user that doesn't exist, allowing the appservice
   * to arrange for it to be created.
   * @param {string} user User Matrix ID
   * @param {createUser} Function Callback to create the new user
   */
  // eslint-disable-next-line class-methods-use-this
  private async onQueryUser(
    _user: string,
    // eslint-disable-next-line no-unused-vars
    createUser: (x: boolean) => void,
  ): Promise<void> {
    // Refuse to automatically create arbitrary new users for now
    createUser(false);
  }
}
