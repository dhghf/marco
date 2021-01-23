# Message Body JSON Format
This is the intermediate JSON format used to represent formatted Matrix message
bodies. It is designed in such a way as to:
 - Remove the burden of interpreting the original HTML from the Minecraft
   plugin, so e.g. whitespace around elements is fully expanded.
 - Be abstract enough from the Minecraft raw JSON format to be unaffected by
   incompatibilities between Minecraft versions.
 - Be unconcerned with nitty gritty Minecraft specifics such as indentation and
   line lengths.
 - Allow the same message to be displayed differently to different players (for
   example when certain players are mentioned).

## BodyJson:
A BodyJson represents a snippet of formatted message text.

This may be one of several types:
 - A string, which must be presented as plain text.
 - An array of BodyJson types, for which each item in the array must be
   presented in succession.
 - An object with at least the following fields, but may have more depending on
   the type, which should be presented depending on the type.

| Attribute | Type     | Description        |
|-----------|----------|--------------------|
| type      | string   | A type identifier. |
| content   | BodyJson | Optional content.  |

If the type isn't recognised, the Minecraft plugin must fall back to presenting
the content field if present.

### BodyStyle Object:
A style object alters the way in which the content should be visually presented
to the player. It extends the BodyJson object with the following additional
fields:

| Attribute | Type     | Description                                            |
|-----------|----------|--------------------------------------------------------|
| type      | string   | must be "style".                                       |
| content   | BodyJson | Content affected by the style.                         |
| color     | integer  | Optional 24-bit integer representing color of content. |
| bold      | true     | Optionally present the content in bold.                |
| italic    | true     | Optionally present the content in italics.             |
| underline | true     | Optionally present the content underlined.             |
| strike    | true     | Optionally present the content strike-through.         |
| spoiler   | true     | Optionally present the content as a spoiler.           |
| code      | true     | Optionally present the content as code.                |
| heading   | 1..6     | Optionally present the content as a heading.           |

The content of spoiler text is expected to be presented obfuscated with the
non-obfuscated content shown when the player hovers over it.

Headings correspond to HTML heading levels and should be presented in bold.

### BodyLink Object:
A link object adds a URL to the content, much like an HTML hyperlink. It
extends the BodyJson object with the following additional fields:

| Attribute | Type     | Description                     |
|-----------|----------|---------------------------------|
| type      | string   | must be "link".                 |
| content   | BodyJson | Content with the link attached. |
| href      | string   | URL of hyperlink.               |

The content is expected to be presented underlined with the href as the hover
text, and to open the href when clicked.

### BodyMention Object:
A mention object marks the content as mentioning a specific user in the Matrix
room, or everybody. It extends the BodyJson object with the following
additional fields, but may have more fields depending on the bridge identifier:

| Attribute | Type     | Description                             |
|-----------|----------|-----------------------------------------|
| type      | string   | must be "mention".                      |
| content   | BodyJson | Content to present as the mention text. |
| room      | true     | Optionally mention the whole room.      |
| user      | MxUser   | Optional matrix user information.       |
| bridge    | string   | Optional bridge identifier.             |

See [Endpoints](./Endpoints.md) for documentation about the MxUser object.

The plugin may for example use these fields to present more information about
the user as hover text, and allow the player to paste the mentioned user's
displayName with shift+click.

If the whole room is mentioned, the whole message should be presented
highlighted (e.g. red text) for all players.

Further fields may be interpreted depending on the bridge identifier if it is
recognised.

### BodyMentionMinecraft Object:
A Minecraft mention object marks the content as mentioning a Minecraft player
specifically. It extends the BodyMention object with the following additional
fields:

| Attribute | Type            | Description                   |
|-----------|-----------------|-------------------------------|
| bridge    | string          | must be "minecraft".          |
| player    | MinecraftPlayer | Minecraft player information. |

The whole message should be presented highlighted (e.g. red text) for any
mentioned players.

In addition to the handling of generic mentions, the plugin may also for
example suggest an appropriate command to whisper to the mentioned player when
the content is clicked.

#### MinecraftPlayer Object:
A Minecraft player object specifies a Minecraft player known to the bridge. It
has the following fields:

| Attribute | Type   | Description                       |
|-----------|--------|-----------------------------------|
| uuid      | string | The player's UUID in string form. |

### BodyImg Object:
An image object represents an image. It extends the BodyJson object with the
following additional fields:

| Attribute | Type     | Description                 |
|-----------|----------|-----------------------------|
| type      | string   | must be "img".              |
| src       | string   | Optional HTTP(S) image URL. |
| alt       | string   | Optional alternate text.    |
| title     | string   | Optional image title.       |

Due to the lack of image capabilities in Minecraft chat, an image is expected
to be presented to Minecraft players as a link to the image source URL, using
the alt text (or the title if no alt text is provided, or just "image" if
neither alt or title are provided). If a title is provided it can be shown as a
hover text.

### BodyBlock Object:
A block object represents a block of text with aligned lines. It extends the
BodyJson object with the following additional fields, but may have more fields
depending on the block identifier:

| Attribute | Type     | Description                     |
|-----------|----------|---------------------------------|
| type      | string   | must be "block".                |
| content   | BodyJson | Content contained in the block. |
| block     | string   | A block identifier.             |

### BodyBlockQuote Object:
A block quote object represents a block of quoted text. It extends the
BodyBlock object with the following additional fields:

| Attribute | Type   | Description      |
|-----------|--------|------------------|
| block     | string | must be "quote". |

It should present the content indented with a coloured line down the left, or
with a prefix on each line such as "> ".

### BodyBlockBullet Object:
A bullet block object represents a bullet point followed by block of text with
aligned lines. It extends the BodyBlock object with the following additional
fields:

| Attribute | Type    | Description             |
|-----------|---------|-------------------------|
| block     | string  | must be "bullet".       |
| n         | integer | Optional bullet number. |

The bullet presented may vary depending on the depth of bullet point nesting.

If n is present the bullet is a numbered point. Similarly to unnumbered bullets
the type of numbering may vary (between decimal, roman, and alphanumeric
numbering) depending on the depth of bullet point nesting.

### BodyBlockInline Object:
An inline block object represents a block of text with aligned lines that may
start after and on the same line as other text. It extends the BodyBlock object
with the following additional fields:

| Attribute | Type   | Description       |
|-----------|--------|-------------------|
| block     | string | must be "inline". |

### BodyHorizontalRule Object:
A horizontal rule object represents a horizontal line to the end of the line.
It extends the BodyJson object with the following additional fields:

| Attribute | Type   | Description               |
|-----------|--------|---------------------------|
| type      | string | must be "horizontalRule". |

It should ideally be presented as a gray horizontal line to the end of the
line, but doesn't have to go all the way.

Consider the use of hyphens and strike-through to present the line via text
chat and to the game console.
