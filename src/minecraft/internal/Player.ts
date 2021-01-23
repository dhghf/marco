import got from 'got';
import sharp from "sharp";
import { Responses, Skin, Texture } from './types';
import * as Endpoints from "./endpoints";


/**
 * This class represents a player in Minecraft. It interacts with the
 * Mojang API (credit to wiki.vg for mapping out all the endpoints) to get
 * all the attributes in all the accessor methods.
 */
export class Player {
  private name: string | null;
  private uuid: string | null;
  private displayName?: string;
  private texture?: string;

  public constructor(name?: string, uuid?: string, displayName?: string, texture?: string) {
    this.name = name || null;
    this.uuid = uuid || null;
    this.displayName = displayName;
    this.texture = texture;
  }

  public setDisplayName(displayName: string) {
    this.displayName = displayName;
  }

  public setTexture(texture: string) {
    this.texture = texture;
  }

  /**
   * This decodes the base64 encoding which represents the player's
   * texture, this can include a cape, skin, both, or neither.
   * @param {Texture} texture
   * @returns {Skin}
   */
  public static parseTexture(texture: Texture): Skin {
    let decoded = Buffer.from(texture.value, 'base64')
      .toString('utf-8');
    return JSON.parse(decoded);
  }

  /**
   * Retrieves the UUID of this player, this method should always be called
   * when trying to access the UUID property.
   * Playername -> UUID
   * @link https://wiki.vg/Mojang_API#Username_-.3E_UUID_at_time
   * @returns {Promise<string>}
   */
  public async getUUID(): Promise<string> {
    if (this.uuid != null)
      return this.uuid;
    else {
      const name = await this.getName();
      const target = Endpoints.get.uuid.replace(/({playername})/g, name);
      const res = await got(target);
      const body = JSON.parse(res.body) as Responses.UUID;

      this.uuid = body.id;
      return body.id;
    }
  }

  /**
   * This gets the playername assigned to the UUID.
   * @returns {Promise<string>}
   */
  public async getName(): Promise<string> {
    if (this.name != null)
      return this.name;
    else {
      const profile = await this.getProfile();

      this.name = profile.name;

      return profile.name;
    }
  }

  /**
   * This gets the display name chosen by the player.
   * @returns {Promise<String>}
   */
  public async getDisplayName(): Promise<string> {
    if (this.displayName != null)
      return this.displayName;
    else
      return this.getName();
  }

  /**
   * Retrieves the name history of this player
   * UUID -> Name history
   * @link https://wiki.vg/Mojang_API#UUID_-.3E_Name_history
   * @returns {Promise<NameHistory>}
   */
  public async getNameHistory(): Promise<Responses.NameHistory> {
    const uuid = await this.getUUID();
    const target = Endpoints.get.nameHistory.replace(/({uuid})/g, uuid);
    const res = await got(target);
    const body = JSON.parse(res.body) as Responses.NameHistory;

    return body;
  }

  /**
   * This gets the player's profile
   * GET UUID -> Profile + Skin/Cape
   * @link https://wiki.vg/Mojang_API#UUID_-.3E_Profile_.2B_Skin.2FCape
   * @returns {Promise<Profile>}
   */
  public async getProfile(): Promise<Responses.Profile> {
    const uuid = await this.getUUID();
    const name = await this.getName();
    const target = Endpoints.get.profile.replace(/({uuid})/g, uuid);

    // If we already have the texture, we can construct the profile without
    // resorting to the Mojang API
    if (this.texture) {
      return {
        'id': uuid,
        'name': name,
        'properties':  [ {
          "name" : "textures",
          "value" : this.texture
        } ]
      };
    }

    try {
      const res = await got(target);
      const body = JSON.parse(res.body) as Responses.Profile;
      return body;
    } catch (err) {
      const texture: Skin = {
        'timestamp' : 0,
        'profileId' : uuid,
        'profileName' : name,
        'signatureRequired' : false,
        'textures' : {
          "SKIN" : {
            // Steve
            "url" : "http://textures.minecraft.net/texture/1a4af718455d4aab528e7a61f86fa25e6a369d1768dcb13f7df319a713eb810b"
          }
        }
      };

      return {
        'id': uuid,
        'name': name,
        'properties':  [ {
          "name" : "textures",
          "value" : new Buffer(JSON.stringify(texture)).toString('base64')
        } ]
      };
    }
  }

  /**
   * This decodes the base64 encoding representing the player's skin, cape,
   * or both. It then gets the file from that link and returns it into a Buffer
   * @returns {Promise<Buffer>}
   * @throws {Error} if there is no custom skin
   */
  public async getSkin(): Promise<Buffer> {
    const profile = await this.getProfile();

    if (profile.properties.length >= 1) {
      let texture = profile.properties[0];
      let parsed = Player.parseTexture(texture);

      if (parsed.textures.SKIN) {
        const target = new URL(parsed.textures.SKIN.url);

        target.protocol = 'https';

        const res = await got(target.toString(), { body: 'buffer' });
        return Buffer.from(res.body);
      } else {
        throw new Error('No custom skin');
      }
    } else {
      throw new Error('No custom skin');
    }
  }

  /**
   * This method crops the head out of the skin into a buffer
   * @returns {Promise<Buffer>}
   */
  public async getHead(): Promise<Buffer> {
    const skin = await this.getSkin();
    let image = sharp(skin);
    let head = image
      .extract({
        top: 8,
        left: 8,
        width: 8,
        height: 8,
      }).resize(200, 200, {
        kernel: sharp.kernel.nearest,
      });

    return new Promise((resolve, reject) => {
      head.toBuffer(((err, buffer) => {
        if (err)
          reject(err);
        else {
          resolve(buffer);
        }
      }));
    });
  }

  /**
   * Gets the URL of the player's skin
   * @returns {Promise<string>}
   * @throws {Error} if there is no custom skin
   */
  public async getSkinURL(): Promise<string> {
    let profile = await this.getProfile();

    if (profile.properties.length >= 1) {
      let texture = profile.properties[0];
      let parsed = Player.parseTexture(texture);

      if (parsed.textures.SKIN) {
        return parsed.textures.SKIN.url;
      } else {
        throw new Error('No custom skin');
      }
    } else {
      throw new Error('No custom skin');
    }
  }
}
