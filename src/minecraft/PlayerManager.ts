import { Player } from "./internal/Player";
import type { Intent } from "matrix-bot-sdk";
import { LogService } from "matrix-bot-sdk";


type MarcoProfile = {
  skin: string;
}

/**
 * The PlayerManager class handles interaction with the Mojang API to get
 * all the player details of a certain player on Minecraft. It even goes to
 * the extent of cropping the head out of a player's skin to keep their
 * Matrix puppet in sync
 */
export class PlayerManager {
  private readonly players: Map<string, Player>;

  constructor() {
    this.players = new Map();
  }

  /**
   * This gets a Player object which represents a Minecraft player this
   * will allow us to get all the details we need about a certain player.
   * For more details see the Player class.
   * NOTE: At least one argument must be provided.
   * @example

   let player = getPlayer(null, "5bce3068e4f3489fb66b5723b2a7cdb1");
   // OR
   player = getPlayer("dhmci");

   * @param {?string} name Player's name
   * @param {?string} uuid Player's UUID
   * @param {?string} displayName Player's display name (nick)
   * @param {?string} texture Player's base64 encoded texture (skin)
   * @returns {Promise<void>}
   * @throws {Error} if both parameters are undefined
   */
  public async getPlayer(name?: string, uuid?: string, displayName?: string, texture?: string): Promise<Player> {
    let player = this.players.get(uuid || '');

    if (player) {
      if (displayName)
        player.setDisplayName(displayName);
      if (texture)
        player.setTexture(texture);
      return player;
    } else if (!name && !uuid)
      throw new Error('Both parameters can not be undefined');
    else {
      player = new Player(name, uuid, displayName, texture);
      uuid = await player.getUUID();
      this.players.set(uuid, player);
      return player;
    }
  }

  /**
   * This syncs details of a Minecraft player and Matrix appservice user to
   * make sure they look the same.
   * @param {Intent} intent The Matrix version of the provided player
   * @param {Player} player The player being mimicked
   * @returns {Promise<void>}
   */
  public async sync(intent: Intent, player: Player): Promise<void> {
    const mxProfile = await intent.underlyingClient.getUserProfile(
      intent.userId
    );
    const playerDisplayName = await player.getDisplayName();
    const mxName: string | undefined = mxProfile['displayname'];
    let storedSkin;
    try {
      let marcoProfile: MarcoProfile = await intent.underlyingClient.getAccountData(
        "dev.dhdf.marco"
      );
      storedSkin = marcoProfile.skin || '';
    } catch (err) {
      storedSkin = '';
    }

    LogService.debug(
      'marco-PlayerManager',
      `Player's current displayName:\n${playerDisplayName}\n` +
      `Player's matrix displayName:\n${mxName}\n` +
      `Difference? ${mxName == playerDisplayName ? 'no' : 'yes'}`
    );

    // Sync display name with in-game player name
    if (mxName != playerDisplayName) {
      await intent.underlyingClient.setDisplayName(playerDisplayName);
    }

    // Sync their Matrix's avatar with their in-game skin ...

    // This is a base64 encoding representation of the player's texture. It
    // can be a skin, cape, or both. We can use this base64 encoding to see
    // if they've updated their skin.
    const currentSkin = await player.getSkinURL();

    LogService.debug(
      'marco-PlayerManager',
      `Player's current skin:\n${currentSkin}\n` +
      `Player's stored skin:\n${storedSkin}\n` +
      `Difference? ${storedSkin == currentSkin ? 'no' : 'yes'}`
    );

    if (storedSkin != currentSkin) {
      // This will get the skin and crop the head out (see getHead method)
      const head = await player.getHead();
      // This will get sent to the Intent's account data so we can use it
      // to see if their base64 encoding has updated in the future
      const marcoProfile: MarcoProfile = {
        skin: currentSkin
      };

      // This represents their new Matrix-content-url (mxc) which can be
      // used to set their Matrix user's avatar
      const playerName = await player.getName();
      const mxUrl = await intent.underlyingClient.uploadContent(
        head,
        'image/png', // All skins are in PNG format
        playerName + '-head.png'
      );
      await intent.underlyingClient.setAvatarUrl(mxUrl)
      await intent.underlyingClient.setAccountData(
        "dev.dhdf.marco",
        marcoProfile
      );
    }
  }
}

