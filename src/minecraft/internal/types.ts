/**
 * Mojang API response, request, and generic types
 * credit to wiki.vg
 * @link https://wiki.vg
 */

/**
 * When you request for the Profile + Skin / Cape endpoint there is a
 * base64 encoding in the response, and that base64 resolves to this
 * provided type.
 * @typedef Skin
 * @property {number} timestamp
 * @property {string} profileId Player's UUID
 * @property {string} playerName Player's name
 * @property {boolean} signatureRequired
 * @property {object} texture
 */
export type Skin = {
  timestamp: number;
  profileId: string;
  profileName: string;
  signatureRequired: boolean; // This is possibly undefined although I haven't
                              // seen a response that doesn't have it.
  textures: {
    SKIN?: {
      metadata?: {
        model: 'slim'
      }
      url: string
    },
    CAPE?: {
      url: string;
    }
  };
}

/**
 * This represents a name in the name history response. The changeToAt will
 * be undefined if it's their first ever username otherwise every change
 * will have that property
 * @typedef Name
 * @property {string} name
 * @property {number} changedToAt Unix timestamp
 */
export type Name = {
  name: string;
  changedToAt?: number;
};

/**
 * So this type definition is kinda weird basically it holds a base64
 * encoding that represents a player's skin + cape in the "value" property
 * when you decode it, it will result in JSON (See the Skin type definition)
 * @typedef Texture
 * @property {string} name This will usually just have the value "texture"
 * @property {string} value
 * @property {string | undefined}
 */
export type Texture = {
  name: string;
  value: string;
  signature?: string;
};

/**
 * These are all the response type definitions
 * @module Responses
 */
export module Responses {

  /**
   * Playername -> UUID Response
   * @link https://wiki.vg/Mojang_API#Username_-.3E_UUID_at_time
   * @typedef UUID
   * @property {string} id Their UUID
   * @property {string} username Their player name
   */
  export type UUID = {
    id: string;
    username: string;
  };

  /**
   * UUID -> Name history Response
   * @link https://wiki.vg/Mojang_API#UUID_-.3E_Name_history
   * @typedef NameHistory
   */
  export type NameHistory = Name[];

  /**
   * UUID -> Profile + Skin/Cape Response
   * @link https://wiki.vg/Mojang_API#UUID_-.3E_Profile_.2B_Skin.2FCape
   * @typedef Profile
   * @property {string} id The player's UUID
   * @property {string} name The player's name
   * @property {Texture[]} properties This will usually just be an array
   * with one Texture object in it.
   */
  export type Profile = {
    id: string;
    name: string;
    properties: Texture[];
  }
}
