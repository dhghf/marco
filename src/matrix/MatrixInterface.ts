import * as matrix from "matrix-bot-sdk";
import { LogService } from "matrix-bot-sdk";
import { ProfileCache, MatrixProfile } from "matrix-bot-sdk";
import { RegManager } from "./internal/RegManager";
import { Config } from "../Config";
import type { Main } from "../Main";
import { Bridge } from "../bridging";
import { CmdManager } from "./internal/CmdManager";
import { MsgProcessor } from "./internal/MsgProcessor";
import type { MxEvents, MCEvents } from "../minecraft";


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
export class MatrixInterface {
  // Interfaces with Matrix
  public readonly appservice: matrix.Appservice;
  private readonly main: Main;
  // Collects new messages for Minecraft servers
  private readonly newMxMessages: Map<string, MxEvents.Event[]>
  // Handles commands given by Matrix users
  private readonly cmdManager: CmdManager;
  // Converts matrix messages into McMessages
  private readonly msgProcessor: MsgProcessor;

  private readonly profileCache: ProfileCache;


  constructor(config: Config, marco: Main) {
    let registration = RegManager.getRegistration(config);

    this.main = marco;
    this.msgProcessor = new MsgProcessor(this, config);
    this.appservice = new matrix.Appservice({
      registration,
      bindAddress: config.appservice.bindAddress,
      homeserverName: config.appservice.homeserverName,
      homeserverUrl: config.appservice.homeserverURL,
      port: config.appservice.port
    });
    this.cmdManager = new CmdManager(this.appservice, this.main, config);
    this.newMxMessages = new Map();
    this.profileCache = new ProfileCache(128, 30*1000*1000, this.appservice.botClient);
    this.profileCache.watchWithAppservice(this.appservice);
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
   * Escape plain text for use in HTML.
   * This replace &, <, >, ', and " with the corresponding HTML entities.
   * @param {string} text The plain text to escape
   * @returns {string} HTML escaped version of plain text
   */
  public htmlEscape(text: string): string
  {
    const replacement: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return text.replace(/[&<>"']/g, function(ent: string): string {
      return replacement[ent] || ent;
    });
  }

  /**
   * This intakes a Minecraft chat message and formats it as a matrix message.
   * Implemented with help from https://minecraft.gamepedia.com/Formatting_codes
   * @param {MCEvents.Message} mcMessage
   * @returns {any} Matrix m.room.message content
   */
  public formatMcMessage(mcMessage: MCEvents.Message): any {
    let content: {msgtype:string,body:string,format?:string,formatted_body?:string} = {
      msgtype: "m.text",
      body: mcMessage.message,
    };
    // Interpret and strip any Minecraft formatting codes from the body,
    // producing corresponding Matrix HTML for it if necessary.
    let useFormatting: boolean = false;
    let formatted = '';
    let body = '';
    let tags: string[] = [];
    let pendingTags: string[] = [];
    let pendingTagsStr: string = '';
    const regex = /(\u00a7(.))?([^\u00a7]*)/g;
    const matches = content.body.matchAll(regex);
    for (const match of matches) {
      let fmt = match[2];
      const lit = match[3];
      if (fmt) {
        let colourCode;
        let htmlTag;
        let reset: boolean = false;
        fmt = fmt.toLowerCase();
        switch (fmt) {
          // Colour codes
          case '0': case '1': case '2': case '3':
          case '4': case '5': case '6': case '7':
          case '8': case '9': {
            colourCode = fmt.charCodeAt(0) - '0'.charCodeAt(0);
            break;
          }
          case 'a': case 'b':
          case 'c': case 'd': case 'e': case 'f': {
            colourCode = 0xa + fmt.charCodeAt(0) - 'a'.charCodeAt(0);
            break;
          }

          // Formatting codes
          case 'l': htmlTag = 'b';      break; // bold
          case 'm': htmlTag = 'strike'; break; // strikethrough
          case 'n': htmlTag = 'u';      break; // underline
          case 'o': htmlTag = 'i';      break; // italic

          // Reset code
          case 'r': reset = true; break;
        }

        if (colourCode !== undefined) {
          let col = 0x000000;
          if (colourCode & 0x1) // blue
            col |= 0x0000AA;
          if (colourCode & 0x2) // green
            col |= 0x00AA00;
          if (colourCode & 0x4) // red
            col |= 0xAA0000;
          if (colourCode & 0x8) // light
            col |= 0x555555;
          if (colourCode == 6) // gold
            col |= 0xff0000;

          // Close any open tags (Java Edition only)
          while (tags.length) {
            let tag = tags.pop();
            formatted += `</${tag}>`
          }
          pendingTags = ['font'];
          pendingTagsStr = `<font color="#${col.toString(16).padStart(6, '0')}">`;
        } else if (htmlTag) {
          if (pendingTags.indexOf(htmlTag) == -1 ||
              tags.indexOf(htmlTag) == -1) {
            pendingTags.push(htmlTag);
            pendingTagsStr += `<${htmlTag}>`
          }
        } else if (reset) {
          // Close any open tags
          pendingTags = [];
          pendingTagsStr = '';
          while (tags.length) {
            let tag = tags.pop();
            formatted += `</${tag}>`
          }
        }
      }
      if (lit) {
        // Handle lazy tags
        formatted += pendingTagsStr;
        tags = tags.concat(pendingTags);
        pendingTags = [];
        pendingTagsStr = '';

        if (tags.length)
          useFormatting = true;
        formatted += this.htmlEscape(lit);
        body += lit;
      }
    }
    content.body = body;
    if (useFormatting) {
      // Close any open tags
      while (tags.length) {
        let tag = tags.pop();
        formatted += `</${tag}>`
      }
      content.format = 'org.matrix.custom.html';
      content.formatted_body = formatted;
    }
    return content;
  }

  /**
   * This intakes a Minecraft chat message and relays it the provided bridged
   * room.
   * @param {Bridge} bridge
   * @param {MCEvents.Message} mcMessage
   * @returns {Promise<void>}
   */
  public async sendMessage(bridge: Bridge, mcMessage: MCEvents.Message): Promise<void> {
    // The player UUID is the Matrix appservice user's Matrix ID
    const uuid = await mcMessage.player.getUUID();
    // This is the representing Matrix user
    const intent = this.appservice.getIntentForSuffix(uuid);

    try {
      await intent.ensureRegistered();
      // Keep the player name, skin in sync with their profile data on Matrix
      await this.main.players.sync(intent, mcMessage.player);

      // Finally send the message to the room, half of these steps are
      // skipped to this if everything has already been completed before
      // (such as inviting, joining, and syncing unless the player updated a
      // certain detail that we keep synced)
    } catch (err) {
      let errMessage = 'An error occurred while sending a message to a bridged room.\n'
      if (err instanceof Error) {
        errMessage += ` - message: ${err.message}\n`;
        errMessage += ` - stack:\n${err.stack}`;
      } else {
        errMessage += ' - error: ' + err;
      }
      LogService.error('marco-matrix', errMessage);
    } finally {
      // what matters most is that the message gets to the room.
      await intent.sendEvent(
        bridge.room,
        this.formatMcMessage(mcMessage)
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
  public async sendJoin(bridge: Bridge, mcJoin: MCEvents.Join): Promise<void> {
    // The player UUID is the Matrix appservice user's Matrix ID
    const uuid = await mcJoin.player.getUUID();
    // This is the representing Matrix user
    const intent = this.appservice.getIntentForSuffix(uuid);

    try {
      await intent.ensureRegistered();
      // Keep the player name, skin in sync with their profile data on Matrix
      await this.main.players.sync(intent, mcJoin.player);

      // Finally send the message to the room, half of these steps are
      // skipped to this if everything has already been completed before
      // (such as inviting, joining, and syncing unless the player updated a
      // certain detail that we keep synced)
    } catch (err) {
      let errMessage = 'An error occurred while joining a bridged room.\n'
      if (err instanceof Error) {
        errMessage += ` - message: ${err.message}\n`;
        errMessage += ` - stack:\n${err.stack}`;
      } else {
        errMessage += ' - error: ' + err;
      }
      LogService.error('marco-matrix', errMessage);
    } finally {
      // what matters most is that the room is joined.
      await intent.joinRoom(
        bridge.room
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
  public async sendQuit(bridge: Bridge, mcQuit: MCEvents.Quit): Promise<void> {
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
      let errMessage = 'An error occurred while leaving a bridged room.\n'
      if (err instanceof Error) {
        errMessage += ` - message: ${err.message}\n`;
        errMessage += ` - stack:\n${err.stack}`;
      } else {
        errMessage += ' - error: ' + err;
      }
      LogService.error('marco-matrix', errMessage);
    } finally {
      // what matters most is that the room is left.
      await intent.leaveRoom(
        bridge.room
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
  public async sendKick(bridge: Bridge, mcKick: MCEvents.Kick): Promise<void> {
    // The player UUID is the Matrix appservice user's Matrix ID
    const uuid = await mcKick.player.getUUID();
    // This is the representing Matrix bot user
    const client = this.appservice.botClient;

    // Perform the kick
    client.kickUser(this.appservice.getUserIdForSuffix(uuid), bridge.room, mcKick.reason);
  }

  /**
   * This returns all the new room messages of a given bridge since the
   * last time requested.
   * @param {Bridge} bridge
   * @returns {MxEvents.Event[]}
   */
  public getNewMxMessages(bridge: Bridge): MxEvents.Event[] {
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

    if (!this.appservice.isNamespacedUser(message.sender))
      newMxMessages.push(message.event);

    this.newMxMessages.set(message.room, newMxMessages);
  }

  /**
   * This gets the profile of a provided Matrix ID in a room
   * @param {string} user The user being retrieved
   * @param {string} roomId The room to retrieve the profile data from
   * @returns {Promise<any>}
   */
  public getUserProfile(user: string, roomId: string): Promise<MatrixProfile> {
    return this.profileCache.getUserProfile(user, roomId);
  }

  /**
   * This gets the Minecraft player UUID corresponding to the provided Matrix ID
   * @param {string} user The user being retrieved
   * @returns {string}
   */
  public getPlayerUUID(user: string): string | undefined {
    // The bot mxid looks a bit like a player mxid
    if (user == this.appservice.botUserId)
      return undefined;
    return this.appservice.getSuffixForUserId(user);
  }

  /**
   * This checks if the user has a power level sufficient for room notifications
   * @param {string} roomId Room to check
   * @param {string} userId User checking
   * @returns {Promise<boolean>}
   */
  public async checkRoomNotifyPrivilege(roomId: string, userId: string): Promise<boolean> {
    const client = this.appservice.botClient;
    const powerLevels = await client.getRoomStateEvent(roomId, 'm.room.power_levels', '');
    if (!powerLevels)
      return false;

    let requiredPower = 50;
    if (powerLevels['notifications'] && powerLevels['notifications']['room'])
      requiredPower = powerLevels['notifications']['room'];

    let userPower = 0;
    if (powerLevels['users'] && powerLevels['users'][userId])
      userPower = powerLevels['users'][userId];

    return userPower >= requiredPower;
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
    const content: any | undefined = event['content'];
    if (!content || !content['body'])
      return;
    const body = content['body'];
    const msgtype: string = content['msgtype'];
    const isBridged = this.main.bridges.isRoomBridged(room);

    // Handle command-related messages
    if (msgtype == 'm.text' && body.startsWith(CmdManager.prefix)) {
      await this.cmdManager.onMxMessage(room, event['sender'], content['body']);
      return;
    }

    // If it isn't a command then check if the m.room.message was sent in a
    // bridged room
    if (!isBridged)
      return;

    // Handle m.text message
    if (msgtype == 'm.text') {
      let message = await this.msgProcessor.buildTextMsg(room, event);

      // Give it to Main to handle
      this.main.sendToMinecraft(message);

      // Handle m.emote message
    } else if (msgtype == 'm.emote') {
      let message = await this.msgProcessor.buildEmoteMsg(room, event);

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
    if (!isBridged)
      return;

    // Check it relates to one of our Minecraft users
    const stateKey: string = event['state_key'];
    if (!this.appservice.isNamespacedUser(stateKey))
      return;

    const content: any | undefined = event['content'];
    const oldContent: any | undefined = event['prev_content'] || {};
    const membership: string = content['membership'];
    const oldMembership: string = oldContent['membership'] || "leave";
    const sender: string = event['sender'];

    if (membership == 'ban') {
      let message = await this.msgProcessor.buildBanMsg(room, event);

      // Give it to Main to handle
      this.main.sendToMinecraft(message);
    } else if (oldMembership == 'ban') {
      let message = await this.msgProcessor.buildUnbanMsg(room, event);

      // Give it to Main to handle
      this.main.sendToMinecraft(message);
    } else if (membership == 'leave' && oldMembership == 'join') {
      let message = await this.msgProcessor.buildKickMsg(room, event);

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
  private async onQueryUser(user: string, createUser: Function): Promise<void> {
    // Refuse to automatically create arbitrary new users for now
    createUser(false);
  }
}
