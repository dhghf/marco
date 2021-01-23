import { MatrixProfile } from "matrix-bot-sdk";
import { MatrixInterface, MxMessage } from "../MatrixInterface";
import { MxEvents } from "../../minecraft";
import { Player } from "../../minecraft/internal/Player";
import { Config } from "../../Config";

export class MsgProcessor {
  constructor(private readonly matrix: MatrixInterface, private readonly config: Config)
  {
  }

  /**
   * Decode HTML entities into plain text.
   * This replace &amp;, &lt;, &gt;, &apos;, and &quot; with the corresponding
   * plain text characters.
   * @param {string} html HTML
   * @returns {string} The plain text equivalent
   */
  public htmlDecode(text: string): string
  {
    // FIXME Need more cases here??
    const replacement: { [key: string]: string } = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&apos;': "'",
      '&nbsp;': " ",
    };
    return text.replace(/&(\w+);/g, function(ent: string): string {
      return replacement[ent] || ent;
    });
  }

  /**
   * Parse an HTML colour code into a 24bit colour value.
   * @param {string} text HTML colour in the form "#rrggbb" or "#rgb"
   * @returns {number|null} parsed 24-bit colour value (0xRRGGBB)
   */
  public htmlColorTo24bit(text: string): number | null
  {
    // Validate
    const match = text.match(/^#([0-9a-fA-F]+)$/);
    if (!match)
      return null;

    // Should be 3 or 6 nibbles
    let hex = match[1];
    if (hex.length == 3) {
      // Expand to 6 nibbles
      hex = hex.charAt(0) + hex.charAt(0) 
          + hex.charAt(1) + hex.charAt(1)
          + hex.charAt(2) + hex.charAt(2);
    } else if (hex.length != 6) {
      return null;
    }

    // Parse
    const parsed = parseInt(hex, 16);
    if (isNaN(parsed))
      return null;

    return parsed;
  }

  public simplifyBodyJson(jsonPrep: MxEvents.BodyStructPrep) {
    let json = jsonPrep as MxEvents.BodyStruct;
    for (let i = 0; i < jsonPrep.content.length; ++i) {
      let item = jsonPrep.content[i];
      if (typeof item === "string") {
        if (i > 0) {
          let lastItem = jsonPrep.content[i-1];
          // Merge consecutive strings
          if (typeof lastItem === "string") {
            jsonPrep.content[i-1] = lastItem.concat(item);
            jsonPrep.content.splice(i, 1);
            --i;
            continue;
          }
        }
      } else {
        if (item._erase === false) {
          // Drop _erase:false tag
          delete item._erase;
        } else if (!item.content) {
          // Remove erasable content
          jsonPrep.content.splice(i, 1);
          --i;
          continue;
        }
      }
    }
    if (jsonPrep.content.length == 1) {
      json.content = jsonPrep.content[0];
    }
  }

  /**
   * This takes a message string and appends it to the bodyJson content taking
   * care to extract room mentions.
   * @param {string} str Raw message string
   * @param {MxEvents.BodyStructPrep} bodyJson JSON object to add to
   * @param {boolean} force Whether to force output even for a single string
   */
  private extractRoomMentions(str: string, bodyJson: MxEvents.BodyStructPrep, force: boolean) {
    // Transform @room into a room mention
    const atRoomRegex = /@room\b/g;
    const items = str.split(atRoomRegex);
    if (!force && items.length <= 1)
      return;

    let mention: MxEvents.BodyMention = {
      type: "mention",
      room: true,
      content: [ "@room" ],
    };

    if (items[0])
      bodyJson.content.push(items[0]);
    for (let i: number = 1; i < items.length; ++i) {
      bodyJson.content.push(mention);
      if (items[i])
        bodyJson.content.push(items[i]);
    }
  }

  /**
   * This intakes the content of a Matrix chat message and formats it as a
   * Minecraft message, using formatting codes.
   * Implemented with help from https://minecraft.gamepedia.com/Formatting_codes
   * @param {any} event Matrix m.room.message event
   * @returns {string} Message body
   */
  public async formatMxMessage(event: any): Promise<[string, MxEvents.BodyJson?]> {
    const content = event['content'];
    const sender: string = event['sender'];
    const roomId: string = event['room_id'];
    const format: string = content['format'];
    const formattedBody: string = content['formatted_body'];

    // Unformatted body, stripping out any Minecraft formatting code characters
    let body: string = content['body'].replace(/\u00a7/g, '');
    let bodyJson: MxEvents.BodyStructPrep = {type:"", content:[]};

    // Check for a room mention in body
    let allowRoomMention: Promise<boolean>;
    if (body.match(/@room\b/)) {
      // We should only allow if the user has sufficient power in this room
      allowRoomMention = this.matrix.checkRoomNotifyPrivilege(roomId, sender);
    } else {
      // Disallow
      allowRoomMention = new Promise((resolve, reject) => { resolve(false); });
    }

    if (format == 'org.matrix.custom.html') {
      // Convert the HTML to Minecraft 
      // Detect tags and plain text in between
      const tagRegex = /(\s*)(<(\/)?([\w-]+)(\s+([^>]*))?\s*(\/)?>)?(\s*)([^<]*[^<\s])?/g;
      const attrRegex = /\s*([\w-]+)(="([^"]*)")?/g;
      const matches = formattedBody.matchAll(tagRegex);
      let tagStack: {
        tag: string,
        endBlock?: boolean,
        json?: MxEvents.BodyStructPrep,
        nextBullet: number | null
      }[] = [];
      let curJson: MxEvents.BodyStructPrep = bodyJson;
      let blockDirty: boolean = false; // block is dirty (non empty, needing newline)
      let endBlock: boolean = false; // block end is pending
      let nextBullet: number | null = null;
      for (const match of matches) {
        let preWhitespace = match[1];
        let tagClose = match[3];
        let tag = match[4];
        let tagAttrs = match[6];
        let tagNoOpen = match[7];
        let postWhitespace = match[8];
        let lit = match[9];
        let json: MxEvents.BodyStruct | undefined;
        let nextBlockDirty: boolean = false; // whether new block starts dirty
        let preWhitespaceEmitted: boolean = false;
        if (tag) {
          tag = tag.toLowerCase();
          if (tagClose) {
            // Look back on the tagStack for a tag to close
            let thisEndBlock: boolean = false;
            let thisLastJson: MxEvents.BodyStructPrep = curJson;
            for (let i = tagStack.length-1; i >= 0; --i) {
              if (tagStack[i].endBlock)
                thisEndBlock = true;
              let thisJson = tagStack[i].json;
              if (thisJson !== undefined)
                thisLastJson = thisJson;
              // Match tag name
              if (tagStack[i].tag == tag) {
                if (thisEndBlock) {
                  endBlock = true;
                  // Discard inter-element whitespace before and after a block close tag
                  preWhitespace = "";
                  postWhitespace = "";
                }
                if (preWhitespace) {
                  curJson.content.push(" ");
                  preWhitespaceEmitted = true;
                }
                if (curJson !== thisLastJson) {
                  this.simplifyBodyJson(curJson);
                  for (let j = tagStack.length-1; j >= i; --j) {
                    let jsonPrep = tagStack[j].json;
                    if (jsonPrep && jsonPrep !== thisLastJson) {
                      this.simplifyBodyJson(jsonPrep);
                    }
                  }
                  curJson = thisLastJson;
                }
                nextBullet = tagStack[i].nextBullet;
                // Drop this and later entries from stack
                tagStack = tagStack.slice(0, i);
                break;
              }
            }
          } else {
            // Extract attributes
            let attrs: {[key: string]: string} = {};
            if (tagAttrs) {
              const attrMatches = tagAttrs.matchAll(attrRegex);
              for (const attrMatch of attrMatches) {
                const attr = attrMatch[1].toLowerCase();
                let val = attrMatch[3];
                if (val) {
                  // Sanitise attributes, including reducing whitespace and
                  // stripping Minecraft formatting codes characters.
                  val = val.replace(/\s+/g, ' ');
                  val = this.htmlDecode(val);
                  val = val.replace(/\u00a7/g, '');
                } else {
                  val = attr;
                }
                attrs[attr] = val;
              }
            }
            let isBlock: boolean = false;
            let forceEndBlock: boolean = false; // force ending of block (<br />)
            switch (tag) {
              case 'font':
              case 'span': {
                for (let attr of [ 'data-mx-color', 'color' ]) {
                  if (attrs[attr]) {
                    let parsed = this.htmlColorTo24bit(attrs[attr]);
                    if (parsed !== null) {
                      let style: MxEvents.BodyStyle = {
                        type: "style",
                        color: parsed,
                        content: [],
                      };
                      json = style;
                      break;
                    }
                  }
                }
                if (attrs['data-mx-spoiler']) {
                  let style: MxEvents.BodyStyle = {
                    type: "style",
                    spoiler: true,
                    content: [],
                  };
                  json = style;
                }
                break;
              }

              case 'del':
              case 'strike': {
                let style: MxEvents.BodyStyle = {
                  type: "style",
                  strike: true,
                  content: [],
                };
                json = style;
                break;
              }

              case 'h1':
              case 'h2':
              case 'h3':
              case 'h4':
              case 'h5':
              case 'h6': {
                let style: MxEvents.BodyStyle = {
                  type: "style",
                  heading: parseInt(tag.substr(1)),
                  content: [],
                };
                json = style;
                isBlock = true;
                break;
              }

              case 'ul': {
                nextBullet = null;
                isBlock = true;
                break;
              }
              case 'ol': {
                nextBullet = 1;
                if (attrs['start']) {
                  const start = parseInt(attrs['start']);
                  if (!isNaN(start))
                    nextBullet = start;
                }
                isBlock = true;
                break;
              }
              case 'li': {
                let bullet: MxEvents.BodyBlockBullet = {
                  type: "block",
                  block: "bullet",
                  content: [],
                };
                if (nextBullet !== null)
                  bullet['n'] = nextBullet++;
                json = bullet;
                isBlock = true;
                break;
              }
              case 'p':
              case 'div':
              case 'table':
              case 'tr':
              case 'pre': {
                isBlock = true;
                break;
              }

              case 'hr': {
                let hr: MxEvents.BodyHorizontalRule = {
                  type: "horizontalRule",
                  _erase: false,
                };
                json = hr;
                isBlock = true;
                nextBlockDirty = true; // even though no content
                tagNoOpen = '/';
                break;
              }

              case 'blockquote': {
                let quote: MxEvents.BodyBlockQuote = {
                  type: "block",
                  block: "quote",
                  content: [],
                };
                json = quote;
                isBlock = true;
                break;
              }

              case 'a': {
                // name, target, href (https, http, ftp, mailto, magnet)
                // start
                if (attrs['href']) {
                  let match = attrs['href'].match(/^https:\/\/matrix\.to\/#\/(@[^:]+:.*)$/);
                  if (match) {
                    let mxid: string = match[1];
                    let profile: MatrixProfile = await this.matrix.getUserProfile(mxid, roomId);
                    let mention: MxEvents.BodyMention = {
                      type: "mention",
                      user: {
                        mxid: mxid,
                        displayName: profile.displayName,
                      },
                      content: [],
                    };
                    json = mention;

                    // Is it a Minecraft player!
                    let uuid = this.matrix.getPlayerUUID(mxid);
                    if (uuid) {
                      let mcMention: MxEvents.BodyMentionMinecraft = mention as MxEvents.BodyMentionMinecraft;
                      mcMention.bridge = "minecraft";
                      mcMention.player = {
                        uuid: uuid,
                      };
                    }
                    break;
                  }
                  match = attrs['href'].match(/^([^:]+):/);
                  if (match) {
                    const protocols: {[x:string]:true} = {
                      https: true,
                      http: true,
                      ftp: true,
                      mailto: true,
                      magnet: true,
                    };
                    if (protocols[match[1]]) {
                      let link: MxEvents.BodyLink = {
                        type: "link",
                        href: attrs['href'],
                        content: [],
                      };
                      json = link;
                    }
                  }
                }
                break;
              }
              case 'sup':
              case 'sub':
                break;

              case 'b':
              case 'strong': {
                let style: MxEvents.BodyStyle = {
                  type: "style",
                  bold: true,
                  content: [],
                };
                json = style;
                break;
              }

              case 'i':
              case 'em': {
                let style: MxEvents.BodyStyle = {
                  type: "style",
                  italic: true,
                  content: [],
                };
                json = style;
                break;
              }

              case 'u': {
                let style: MxEvents.BodyStyle = {
                  type: "style",
                  underline: true,
                  content: [],
                };
                json = style;
                break;
              }

              case 'code':
                // class (language-*)
                let style: MxEvents.BodyStyle = {
                  type: "style",
                  code: true,
                  content: [],
                };
                json = style;
                break;

              case 'br': {
                isBlock = true;
                // force newline
                forceEndBlock = true;
                // even if block is clean
                blockDirty = true;
                tagNoOpen = '/';
                break;
              }
              case 'thead':
              case 'tbody':
              case 'th':
              case 'td':
              case 'caption':
                break;

              case 'img': {
                // width, height, alt, title, src
                let img: MxEvents.BodyImg = {
                  type: "img",
                  _erase: false,
                };
                if (attrs['title'])
                  img.title = attrs['title'];
                if (attrs['alt'])
                  img.alt = attrs['alt'];
                // Validate src
                if (attrs['src']) {
                  let match = attrs['src'].match(/^mxc:\/\/([^\/#?]+)\/([^\/#?]+)$/);
                  if (match)
                    img.src = `${this.config.appservice.homeserverURL}/_matrix/media/r0/download/${match[1]}/${match[2]}`;
                }
                json = img;
                tagNoOpen = '/';
                break;
              }

              default:
                break;
            }
            if (isBlock) {
              // End previous block before starting a new one
              endBlock = true;
              // Discard inter-element whitespace before and after a block tag
              preWhitespace = "";
              postWhitespace = "";
            }
            // Open new block: push onto tag stack
            if (!tagNoOpen) {
              tagStack.push({
                tag:tag,
                endBlock: isBlock,
                json: json ? curJson : undefined,
                nextBullet: nextBullet,
              });
            }

            if (preWhitespace) {
              curJson.content.push(" ");
              preWhitespaceEmitted = true;
            }

            if (json || forceEndBlock) {
              // End a previous dirty block on new content
              if (endBlock) {
                endBlock = false;
                if (blockDirty)
                  curJson.content.push("\n");
                blockDirty = nextBlockDirty;
                nextBlockDirty = false;
              }
            }
            if (json) {
              curJson.content.push(json);
              if (!tagNoOpen) {
                // json should only get set with array content
                curJson = json as MxEvents.BodyStructPrep;
              }
            }
            if (isBlock && tagNoOpen)
              endBlock = true;
          }
        }

        // Emit adjacent whitespace
        if ((preWhitespace || postWhitespace) && !preWhitespaceEmitted)
          curJson.content.push(" ");

        if (lit) {
          // Reduce whitespace including newlines
          lit = lit.replace(/[\s]+/g, ' ');
          // Decode HTML entities...
          lit = this.htmlDecode(lit);
          // ... and strip out Minecraft formatting code characters
          lit = lit.replace(/\u00a7/g, '');

          if (lit) {
            // End a previous dirty block on new content
            if (endBlock) {
              endBlock = false;
              if (blockDirty) {
                curJson.content.push("\n");
                blockDirty = false;
              }
            }
            if (lit) {
              blockDirty = true;
              if (await allowRoomMention)
                this.extractRoomMentions(lit, curJson, true);
              else
                curJson.content.push(lit);
            }
          }
        }
      }

      // Clean up json
      for (let i = tagStack.length-1; i >= 0; --i) {
        let jsonPrep = tagStack[i].json;
        if (jsonPrep)
          this.simplifyBodyJson(jsonPrep);
      }
      this.simplifyBodyJson(curJson);

    } else if (await allowRoomMention) {
      this.extractRoomMentions(body, bodyJson, false);
    }

    if (bodyJson.content.length !== 0) {
      // Use formatted body
      return [body, bodyJson.content as MxEvents.BodyJson];
    } else {
      return [body];
    }
  }

  /**
   * This intakes an m.emote message type and builds to be ready to be sent
   * to a Minecraft chat. ie. "waves" -> " * <Dylan> waves"
   *
   * @param {string} room Corresponding room
   * @param {any} event m.room.message with typeof "m.emote"
   * @returns {Promise<string>}
   */
  public async buildEmoteMsg(room: string, event: any): Promise<MxMessage> {
    const sender = event['sender'];
    const bodies = this.formatMxMessage(event);
    const senderProfile = await this.matrix.getUserProfile(sender, room);
    const name: string = senderProfile.displayName;
    const [body, bodyJson] = await bodies;

    return {
      sender: sender,
      room,
      body: ` * <${name}> ${body}`,
      event: <MxEvents.EmoteMessageEvent> {
        sender: {
          mxid: sender,
          displayName: name
        },
        type: "message.emote",
        body: body,
        bodyJson: bodyJson,
      } as MxEvents.Event
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
    const sender = event['sender'];
    const bodies = this.formatMxMessage(event);
    const senderProfile = await this.matrix.getUserProfile(sender, room);
    const name: string = senderProfile.displayName;
    const [body, bodyJson] = await bodies;

    return {
      sender: sender,
      room,
      body: `<${name}> ${body}`,
      event: <MxEvents.TextMessageEvent> {
        sender: {
          mxid: sender,
          displayName: name
        },
        type: "message.text",
        body: body,
        bodyJson: bodyJson,
      } as MxEvents.Event
    };
  }

  public async buildKickMsg(room: string, event: any): Promise<MxMessage> {
    const content = event['content'];
    const reason = content['reason'];
    const prevContent = event['prev_content'] || {};
    const sender = event['sender'];
    const victim = event['state_key'];

    const senderProfile = await this.matrix.getUserProfile(sender, room);
    const victimUUID: string | undefined = this.matrix.getPlayerUUID(victim);
    const senderName: string = senderProfile.displayName;
    const victimName: string = prevContent['displayname'] || victimUUID;

    return {
      sender: sender,
      room,
      event: <MxEvents.KickPlayerEvent> {
        sender: {
          mxid: sender,
          displayName: senderName
        },
        type: "player.kick",
        player: new Player(victimName, victimUUID),
        reason: reason
      } as MxEvents.Event
    };
  }

  public async buildBanMsg(room: string, event: any): Promise<MxMessage> {
    const content = event['content'];
    const reason = content['reason'];
    const prevContent = event['prev_content'] || {};
    const sender = event['sender'];
    const victim = event['state_key'];

    const senderProfile = await this.matrix.getUserProfile(sender, room);
    const victimUUID: string | undefined = this.matrix.getPlayerUUID(victim);
    const senderName: string = senderProfile.displayName;
    const victimName: string = prevContent['displayname'] || victimUUID;

    return {
      sender: sender,
      room,
      event: <MxEvents.BanPlayerEvent> {
        sender: {
          mxid: sender,
          displayName: senderName
        },
        type: "player.ban",
        player: new Player(victimName, victimUUID),
        reason: reason
      } as MxEvents.Event
    };
  }

  public async buildUnbanMsg(room: string, event: any): Promise<MxMessage> {
    const prevContent = event['prev_content'];
    const sender = event['sender'];
    const victim = event['state_key'];

    const senderProfile = await this.matrix.getUserProfile(sender, room);
    const victimUUID: string | undefined = this.matrix.getPlayerUUID(victim);
    const senderName: string = senderProfile.displayName;
    const victimName: string = prevContent['displayname'] || victimUUID;

    return {
      sender: sender,
      room,
      event: <MxEvents.UnbanPlayerEvent> {
        sender: {
          mxid: sender,
          displayName: senderName
        },
        type: "player.unban",
        player: new Player(victimName, victimUUID)
      } as MxEvents.Event
    };
  }
}
