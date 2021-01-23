# Core Classes

## [Main](../src/Main.ts)
This is the Main class it communicates with both interfaces (WebInterface
, MatrixInterface) to relay messages between a Minecraft server and Matrix
room. Both Minecraft and Matrix messages flow through here. When the
WebInterface receives a message from the Minecraft server it tells Main. 
When MatrixInterface gets a new message in the Matrix room it tells Main.

### Main Methods

#### start(): Promise\<void>
This starts the application.

#### getNewMxMessages(): string[]
The WebInterface uses this method when a Minecraft server sends a GET
request that is requesting all the new messages of the Matrix room it's
bridged with.

#### sendToMinecraft(): void
| Parameter | Type      | Description                          |
|-----------|-----------|--------------------------------------|
| message   | MxMessage | A formatted message by MsgProcessor  |

The MatrixInterface uses this method to send an `m.room.message` to
Minecraft. Right now all the method does is store the room message in memory
until the bridged Minecraft server comes to retrieve it, which is done at
the `getNewMxMessages` method.

#### sendToMatrix(): Promise\<void>
| Parameter | Type             | Description             |
|-----------|------------------|-------------------------|
| bridge    | Bridge           | Bridged room to send to |
| message   | MCEvents.Message | Message to send         |

The WebInterface uses this method when a Minecraft server sends a POST
request that contains a new Minecraft chat message that a player sent. From
here Main will give it to `<MatrixInterface>.sendMessage` where it is relayed
to the given bridged room.

## [MatrixInterface](../src/matrix/MatrixInterface.ts)
The Matrix interface has everything to do with Matrix. It handles sending
and retrieving messages. It also has some utility methods to get the job done.

### MatrixInterface Methods

#### start(): Promise\<void>
This starts up the MatrixInterface to be ready, before anything can happen
this method must be called.

#### sendMessage(): Promise\<void>
| Parameter | Type             | Description             |
|-----------|------------------|-------------------------|
| bridge    | Bridge           | Bridged room to send to |
| message   | MCEvents.Message | Message to send         |

This method sends a Minecraft chat message to the provided bridged Matrix room.
It first makes sure the puppeted Matrix user is in sync with the Minecraft
player that it represents, this is done by the `PlayerManager.sync` method
. Once the Matrix puppet is synced it sends the Minecraft chat message to
 the room as the puppeted Matrix user.

#### getNewMxMessages(): string[]
| Parameter | Type   | Description      |
|-----------|--------|------------------|
| bridge    | Bridge | The bridged room |

When a Minecraft server comes to retrieve all the new missed messages from
the room it's bridged with then this method returns an array of string. Each
string is pre-formatted (by the MsgProcessor class) to be sent to the
Minecraft chat.

#### addNewMxMessage(): void
| Parameter | Type      | Description                          |
|-----------|-----------|--------------------------------------|
| message   | MxMessage | A formatted message by MsgProcessor  |

This stores all new Matrix messages in memory for a Minecraft server to come
and retrieve (see Main.getNewMxMessages)

#### getUserProfile(): MatrixProfile
| Parameter | Type   | Description                                |
|-----------|--------|--------------------------------------------|
| user      | string | The user profile being retrieved           |
| room      | string | The room to retrieve the profile data from |

This gets the cached profile of a provided Matrix ID in a room. This is a
utility method.

#### onMxMessage(): Promise\<void>
| Parameter | Type   | Description                     |
|-----------|--------|---------------------------------|
| room      | string | The room the message came  from |
| event     | any    | The m.room.message event object |

This method intakes m.room.message events. It first sees if it's a !minecraft
command if it is then it gives it to CmdManager.onMxMessage, otherwise
it checks if the message is coming from a bridged room if it is then
it processes the message through MsgProcessor and sends it to 
`Main.sendToMinecraft`.

## [WebInterface](../src/webserver/WebInterface.ts)
The WebInterface is an HTTP express web server that gets requests from
Minecraft servers. All the endpoints are [described here](./Endpoints.md).

### WebInterface Methods
To see how each endpoint is processed then see the 
[routes directory](../src/webserver/internal/routes)

#### start(): void
| Parameter | Type   | Description             |
|-----------|--------|-------------------------|
| app       | Router | Router to extend off of |

This gets the WebInterface ready for use, this must be called before
anything can happen.

#### vibeCheck(): void
| Parameter | Type     | Description                                     |
|-----------|----------|-------------------------------------------------|
| req       | Request  | The request object being read from              |
| res       | Response | The response object being sent to the requester |

This method intakes an HTTP request that has a bearer token. In that token
should determine whether it's bridged with a room or not. If it the
requester has a valid JSON web token then it responds with the room the
server is bridged with.

#### checkAuth(): void
| Parameter | Type         | Description                                     |
|-----------|--------------|-------------------------------------------------|
| req       | Request      | The request object being read from              |
| res       | Response     | The response object being sent to the requester |
| next      | NextFunction | This is called if the checkAuth passes          |

This authorizes every request other than the vibe check request. When a
request passes a couple of properties are added to the Request object which
can be read from in future methods:
req.main = Main class
req.bridge = Bridge the Minecraft server is bridged with
req.id = The UUID of the request (for logging purposes)
