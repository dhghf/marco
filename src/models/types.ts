import type { Player } from '../minecraft';

/**
 * Events coming FROM a Minecraft server
 * @module MCServerEvents
 */
export module MCServerEvents {
  export type Event = {
    player: Player;
  }

  /**
   * This represents a message coming from a player on Minecraft.
   * @type Message
   * @prop {Player} player The player that sent the message
   * @prop {string} message The body of the message
   */
  export interface MessageEvent extends Event {
    message: string;
  }

  /**
   * This represents a player joining the Minecraft server.
   * @type Join
   * @prop {Player} player The player that joined
   */
  export interface JoinEvent extends Event {
  }

  /**
   * This represents a player quitting the Minecraft server.
   * @type Quit
   * @prop {Player} player The player that quit
   */
  export interface QuitEvent extends Event {
  }

  /**
   * This represents a player getting kicked from the Minecraft server.
   * @type Kick
   * @prop {Player} player The player that was kicked
   * @prop {string} reason The kick reason
   */
  export interface KickEvent extends Event {
    reason: string;
  }
}

/**
 * Events coming FROM Matrix
 * @module MxEvents
 */
export module MxEvents {
  /**
   * This represents a Matrix user.
   * @type User
   * @prop {string} msid Full Matrix ID in the form @localpart:homeserver
   * @prop {string} displayName More readable name of Matrix user
   */
  export type User = {
    mxid: string;
    displayName: string;
  }

  /**
   * This represents an event from Matrix that Minecraft needs to handle.
   * It is extended depending on the type string.
   * @type Event
   * @prop {User} sender The Matrix user who originated the event
   * @prop {string} type An identifier to determine the type of event
   */
  export interface Event {
    sender: User;
    type: string;
  }

  /**
   * A message event is one that usually ends up being send to broadcast to
   * Minecraft users.
   * It is further extended depending on the type string.
   * @type MessageEvent
   * @prop {string} body Message body
   */
  export interface MessageEvent extends Event {
    body: string;
  }

  /**
   * A normal text message send from a Matrix user.
   * @type TextMessageEvent
   */
  export interface TextMessageEvent extends MessageEvent {
    type: 'message.text';
  }

  /**
   * An emote message send from a Matrix user.
   * @type EmoteMessageEvent
   */
  export interface EmoteMessageEvent extends MessageEvent {
    type: 'message.emote';
  }

  /**
   * An announcement message send from a sufficiently privileged Matrix user.
   * @type AnnounceMessageEvent
   */
  export interface AnnounceMessageEvent extends MessageEvent {
    type: 'message.announce';
  }

  export type PossibleEvents = Event
    | MessageEvent
    | TextMessageEvent
    | EmoteMessageEvent
    | AnnounceMessageEvent

  /**
   * A player event is one that relates to a specific player.
   * It is further extended depending on the type string.
   * @type PlayerEvent
   * @prop {Player} player The player this event relates to
   */
  export interface PlayerEvent extends Event {
    player: Player;
  }

  /**
   * A player has been kicked from the room by a Matrix user.
   * The Minecraft server may wish to kick the player from the server too.
   * @type KickPlayerEvent
   * @prop {string} reason The optional reason for the kicking
   */
  export interface KickPlayerEvent extends PlayerEvent {
    type: 'player.kick';
    reason?: string;
  }

  /**
   * A player has been banned from the room by a Matrix user.
   * The Minecraft server may wish to ban the player from the server too.
   * @type BanPlayerEvent
   * @prop {string} reason The optional reason for the banning
   */
  export interface BanPlayerEvent extends PlayerEvent {
    type: 'player.ban';
    reason?: string;
  }

  /**
   * A player has been unbanned from the room by a Matrix user.
   * The Minecraft server may wish to unban the player from the server too.
   * @type UnbanPlayerEvent
   */
  export interface UnbanPlayerEvent extends PlayerEvent {
    type: 'player.unban';
  }
}
