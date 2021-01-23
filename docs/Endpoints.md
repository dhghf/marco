# Endpoints
These are all the HTTP endpoints opened by the WebInterface, if you're
writing a valid Minecraft plugin for this appservice you start here. As
long as each request and response is handled properly then you have a
valid plugin.

## The Chat Endpoint

### GET /chat

#### Required Headers:
The provided JSON web token describes what room the server is bridged with.
 - Content-Type: `application/json`
 - Authorization: `Bearer <JSON WEB TOKEN>`

#### Request Body
None

#### Response Body:
The response body returns an array of pre-formatted messages like
"\<Dylan> Hello!", this can easily just be sent to the Minecraft chat as is.

| Attribute | Type     | Description                                                                |
|-----------|----------|----------------------------------------------------------------------------|
| chat      | string[] | An array of pre-formatted messages ready to be sent to the Minecraft chat. |

### GET /events

#### Required Headers:
The provided JSON web token describes what room the server is bridged with.
 - Content-Type: `application/json`
 - Authorization: `Bearer <JSON WEB TOKEN>`

#### Request Body
None

#### Response Body:
The response body returns an array of structured events.

| Attribute | Type      | Description                                                       |
|-----------|-----------|-------------------------------------------------------------------|
| events    | MxEvent[] | An array of structured events for the Minecraft plugin to handle. |

##### MxEvent Object:
This describes the Matrix event. It must have at least the following fields,
but may have more depending on the type:

| Attribute | Type   | Description                     |
|-----------|--------|---------------------------------|
| sender    | MxUser | The Matrix sender of the event. |
| type      | string | An event type identifier.       |

##### MxUser Object:
This describes a Matrix user, allowing the Minecraft plugin to format it as it
likes, for example showing the displayName but with the MXID in a tooltip.

| Attribute   | Type   | Description                  |
|-------------|--------|------------------------------|
| mxid        | string | Matrix ID of user.           |
| displayName | string | The displayName of the user. |

##### message.text Event:
This describes a normal text message send by the Matrix sender user. It extends
the MxEvent object with the following additional fields:

| Attribute | Type   | Description             |
|-----------|--------|-------------------------|
| type      | string | must be "message.text". |
| body      | string | The message itself.     |

The Minecraft plugin is expected to broadcast the message, prefixing the body
with the name of the sender.

##### message.emote Event:
This describes an emote message send by the Matrix sender user (e.g. with
"/me").
It extends the MxEvent object with the following additional fields:

| Attribute | Type   | Description              |
|-----------|--------|--------------------------|
| type      | string | must be "message.emote". |
| body      | string | The message itself.      |

The Minecraft plugin is expected to broadcast the message, prefixing the body
with e.g. "\*" and the name of the sender.

##### message.announce Event:
This describes an announcement message send by a sufficiently privileged Matrix
sender user (i.e. with "!minecraft announce").
It extends the MxEvent object with the following additional fields:

| Attribute | Type   | Description                 |
|-----------|--------|-----------------------------|
| type      | string | must be "message.announce". |
| body      | string | The message itself.         |

The Minecraft plugin is expected to broadcast the message as if send from the
Minecraft server console, e.g. prefixing the body with "[Server] ".

##### player.kick Event:
This describes the kicking of a Minecraft user from the Matrix room.
It extends the MxEvent object with the following additional fields:

| Attribute | Type   | Description                      |
|-----------|--------|----------------------------------|
| type      | string | must be "player.kick".           |
| player    | Player | The player who was kicked.       |
| reason    | string | Optional reason for the kicking. |

The Minecraft plugin may respond to this event by kicking the player from the
server too.

##### player.ban Event:
This describes the banning of a Minecraft user from the Matrix room.
It extends the MxEvent object with the following additional fields:

| Attribute | Type   | Description                      |
|-----------|--------|----------------------------------|
| type      | string | must be "player.ban".            |
| player    | Player | The player who was banned.       |
| reason    | string | Optional reason for the banning. |

The Minecraft plugin may respond to this event by banning the player from the
server too.

##### player.unban Event:
This describes the unbanning of a Minecraft user from the Matrix room.
It extends the MxEvent object with the following additional fields:

| Attribute | Type   | Description                  |
|-----------|--------|------------------------------|
| type      | string | must be "player.unban".      |
| player    | Player | The player who was unbanned. |

The Minecraft plugin may respond to this event by unbanning the player from the
server too.

### POST /chat
This endpoint is for sending a Minecraft chat message to the bridged Matrix
 room.

#### Required Headers:
The provided JSON web token describes what room the server is bridged with.
 - Content-Type: `application/json`
 - Authorization: `Bearer <JSON WEB TOKEN>`

#### Request Body:
| Attribute | Type   | Description                           |
|-----------|--------|---------------------------------------|
| message   | string | The raw text message sent by a player |
| player    | Player | The player who sent the message       |

##### Player Object:
This describes the player who sent the message, the name and uuid must not
be null or undefined.

| Attribute   | Type   | Description                          |
|-------------|--------|--------------------------------------|
| name        | string | The name of the player               |
| uuid        | string | The UUID of the player               |
| displayName | string | Optional display name of the player  |
| texture     | string | Optional base64 encoded texture info |

#### Response Body:
None (200 OK)

### POST /player/join
This endpoint is for joining a Minecraft player to the bridged Matrix room.

#### Required Headers:
The provided JSON web token describes what room the server is bridged with.
 - Content-Type: `application/json`
 - Authorization: `Bearer <JSON WEB TOKEN>`

#### Request Body:
| Attribute | Type   | Description                           |
|-----------|--------|---------------------------------------|
| player    | Player | The player who joined                 |

#### Response Body:
None (200 OK)

### POST /player/quit
This endpoint is for making a Minecraft player leave the bridged Matrix room.

#### Required Headers:
The provided JSON web token describes what room the server is bridged with.
 - Content-Type: `application/json`
 - Authorization: `Bearer <JSON WEB TOKEN>`

#### Request Body:
| Attribute | Type   | Description                           |
|-----------|--------|---------------------------------------|
| player    | Player | The player who quit                   |

#### Response Body:
None (200 OK)

### POST /player/kick
This endpoint is for kicking a Minecraft player from the bridged Matrix room.

#### Required Headers:
The provided JSON web token describes what room the server is bridged with.
 - Content-Type: `application/json`
 - Authorization: `Bearer <JSON WEB TOKEN>`

#### Request Body:
| Attribute | Type   | Description                           |
|-----------|--------|---------------------------------------|
| reason    | string | The kick reason                       |
| player    | Player | The player who was kicked             |

#### Response Body:
None (200 OK)
