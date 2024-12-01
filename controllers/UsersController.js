import dbClient from "../utils/db";
import redisClient from "../utils/redis";

export default class UsersController {
  static async postNew(request, response) {
    const { email, password } = request.body;

    if (email === undefined) {
      response.status(400);
      response.send({ error: "Missing email" });
    } else if (password === undefined) {
      response.status(400);
      response.send({ error: "Missing password" });
    } else if (await dbClient.userByEmail(email)) {
      response.status(400);
      response.send({ error: "Already exist" });
    } else {
      const result = await dbClient.addUser(email, password);

      if (!result.result.ok) {
        response.status(500);
        response.send({ error: "Failed to add new user" });
      } else {
        response.status(201);
        response.send({ email, id: result.insertedId });
      }
    }
  }

  static async getMe(request, response) {
    const userSessionToken = request.get("X-Token");
    // console.log(userSessionToken);

    if (typeof userSessionToken !== "string") {
      response.status(401);
      response.send({ error: "Unauthorized" });
      return;
    }

    const userId = await redisClient.getUserId(userSessionToken);
    // console.log(`userId: ${userId}`);

    if (typeof userId !== "string") {
      response.status(401);
      response.send({ error: "Unauthorized" });
      return;
    }

    const userObject = await dbClient.userById(userId);
    // console.log(`userObject: ${userObject}`);

    if (typeof userObject !== "object") {
      response.status(401);
      response.send({ error: "Unauthorized" });
      return;
    }

    response.send({ id: userObject._id, email: userObject.email });
  }
}
