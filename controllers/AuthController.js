import dbClient from "../utils/db";
import redisClient from "../utils/redis";

export default class AuthController {
  static async getConnect(request, response) {
    const auth = request.get("Authorization");
    // console.log(`auth: ${auth}`);

    if (typeof auth !== "string") {
      response.status(403);
      response.send({ error: "Forbidden" });
      return;
    }

    const authContents = auth.split(" ");
    // console.log(`authContents: ${authContents}`);

    if (!authContents || authContents.length !== 2) {
      response.status(403);
      response.send({ error: "Forbidden" });
      return;
    }

    const [authType, b64Credentials] = authContents;
    // console.log(` authType: ${authType}, b64Credentials: ${b64Credentials}`);

    if (
      typeof authType !== "string" ||
      authType !== "Basic" ||
      typeof b64Credentials !== "string"
    ) {
      response.status(403);
      response.send({ error: "Forbidden" });
      return;
    }

    const credentials = Buffer.from(b64Credentials, "base64")
      .toString("ascii")
      .split(":");
    // console.log(`credentials: ${credentials}`);

    if (credentials.length !== 2) {
      response.status(401);
      response.send({ error: "Unauthorized" });
      return;
    }

    const [email, password] = credentials;
    // console.log(`${email}, ${password}`);

    if (!(await dbClient.validCredentials(email, password))) {
      response.status(401);
      response.send({ error: "Unauthorized" });
      return;
    }

    const userId = await dbClient.userId(email);
    console.log(`userId: ${userId}`);

    if (!userId) {
      response.status(500);
      response.send({ error: "Unable to retrieve user ID" });
      return;
    }

    // Create 24h session token for user, and send the token back to the user,
    // for them to use to get back in their session, later.
    const { dbResponse, userSessionToken } = await redisClient.makeUserSession(
      userId.toString()
    );
    // console.log(dbResponse, userSessionToken);

    if (dbResponse !== "OK") {
      response.status(500);
      response.send({ error: "Failed to make user session" });
      return;
    }

    response.status(200);
    response.send({ token: userSessionToken });
  }

  static async getDisconnect(request, response) {
    const userSessionToken = request.get("X-Token");
    // console.log(userSessionToken);

    if (typeof userSessionToken !== "string") {
      response.status(403);
      response.send({ error: "Forbidden" });
      return;
    }

    const userId = await redisClient.getUserId(userSessionToken);
    // console.log(`userId: ${userId}`);

    if (!userId || !dbClient.userById(userId)) {
      response.status(401);
      response.send({ error: "Unauthorized" });
      return;
    }

    await redisClient.endUserSession(userSessionToken);
    response.status(204);
    response.send();
  }
}
