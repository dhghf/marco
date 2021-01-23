import MatrixController, { MxMessage } from '../MatrixController';
import { MxEvents } from '../../models/types';
import { Player } from '../../minecraft';

export default class MsgProcessor {
  private readonly matrix: MatrixController

  constructor(matrix: MatrixController) { this.matrix = matrix; }

  /**
   * This intakes an m.emote message type and builds to be ready to be sent
   * to a Minecraft chat. ie. "waves" -> " * <Dylan> waves"
   *
   * @param {string} room Corresponding room
   * @param {any} event m.room.message with typeof "m.emote"
   * @returns {Promise<string>}
   */
  public async buildEmoteMsg(room: string, event: any): Promise<MxMessage> {
    const { content } = event;
    const { sender } = event;
    const { body } = content;
    const roomMember = await this.matrix.getRoomMember(room, sender);
    const name: string = roomMember.displayname || sender;

    return {
      sender,
      room,
      body: ` * <${name}> ${body}`,
      event: <MxEvents.EmoteMessageEvent>{
        sender: {
          mxid: sender,
          displayName: name,
        },
        type: 'message.emote',
        body,
      } as MxEvents.Event,
    };
  }

  /**
   * This intakes an m.text message type and builds to be ready to be sent
   * to a Minecraft chat. ie. "Hello world" -> "<Dylan> Hello world"
   *
   * @param room
   * @param event
   * @returns {Promise<string>}
   */
  public async buildTextMsg(room: string, event: any): Promise<MxMessage> {
    const { content } = event;
    const { sender } = event;
    const { body } = content;
    const roomMember = await this.matrix.getRoomMember(room, sender);
    const name: string = roomMember.displayname || sender;

    return {
      sender,
      room,
      body: `<${name}> ${body}`,
      event: <MxEvents.TextMessageEvent>{
        sender: {
          mxid: sender,
          displayName: name,
        },
        type: 'message.text',
        body,
      } as MxEvents.Event,
    };
  }

  public async buildKickMsg(room: string, event: any): Promise<MxMessage> {
    const { content } = event;
    const { reason } = content;
    const prevContent = event.prev_content || {};
    const { sender } = event;
    const victim = event.state_key;

    const senderRoomMember = await this.matrix.getRoomMember(room, sender);
    const victimUUID: string | undefined = this.matrix.getPlayerUUID(victim);
    const senderName: string = senderRoomMember.displayname || sender;
    const victimName: string = prevContent.displayname || victimUUID;

    return {
      sender,
      room,
      event: <MxEvents.KickPlayerEvent>{
        sender: {
          mxid: sender,
          displayName: senderName,
        },
        type: 'player.kick',
        player: new Player(victimName, victimUUID),
        reason,
      } as MxEvents.Event,
    };
  }

  public async buildBanMsg(room: string, event: any): Promise<MxMessage> {
    const { content } = event;
    const { reason } = content;
    const prevContent = event.prev_content || {};
    const { sender } = event;
    const victim = event.state_key;

    const senderRoomMember = await this.matrix.getRoomMember(room, sender);
    const victimUUID: string | undefined = this.matrix.getPlayerUUID(victim);
    const senderName: string = senderRoomMember.displayname || sender;
    const victimName: string = prevContent.displayname || victimUUID;

    return {
      sender,
      room,
      event: <MxEvents.BanPlayerEvent>{
        sender: {
          mxid: sender,
          displayName: senderName,
        },
        type: 'player.ban',
        player: new Player(victimName, victimUUID),
        reason,
      } as MxEvents.Event,
    };
  }

  public async buildUnbanMsg(room: string, event: any): Promise<MxMessage> {
    const prevContent = event.prev_content;
    const { sender } = event;
    const victim = event.state_key;

    const senderRoomMember = await this.matrix.getRoomMember(room, sender);
    const victimUUID: string | undefined = this.matrix.getPlayerUUID(victim);
    const senderName: string = senderRoomMember.displayname || sender;
    const victimName: string = prevContent.displayname || victimUUID;

    return {
      sender,
      room,
      event: <MxEvents.UnbanPlayerEvent>{
        sender: {
          mxid: sender,
          displayName: senderName,
        },
        type: 'player.unban',
        player: new Player(victimName, victimUUID),
      } as MxEvents.Event,
    };
  }
}
