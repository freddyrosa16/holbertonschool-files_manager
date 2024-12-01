import { promises as fsPromises } from "fs";
import { v4 as uuidv4 } from "uuid";
import dbClient from "../utils/db";
import redisClient from "../utils/redis";
import fileQueue from "../worker";

const { mkdir, writeFile, readFile } = fsPromises;

export default class FilesController {
  static async postUpload(request, response) {
    const userToken = request.get("X-Token");

    if (typeof userToken !== "string") {
      response.status(403);
      response.send({ error: "Forbidden" });
      return;
    }

    const userId = await redisClient.getUserId(userToken);

    if (!userId) {
      response.status(401);
      response.send({ error: "Unauthorized" });
      return;
    }

    const userObject = await dbClient.userById(userId);

    if (!userObject) {
      response.status(500);
      response.send({ error: "Failed to get user from ID" });
      return;
    }

    const fileObject = {
      name: request.body.name,
      type: request.body.type,
      isPublic: request.body.isPublic,
      parentId: request.body.parentId || 0,
      userId: userObject._id,
    };
    let parentFile;

    // console.log(fileObject);

    // TODO: PREVENT DUPLICATES
    if (typeof fileObject.name !== "string") {
      response.status(400);
      response.send({ error: "Missing name" });
      return;
    }
    if (
      fileObject.type !== "folder" &&
      fileObject.type !== "file" &&
      fileObject.type !== "image"
    ) {
      response.status(400);
      response.send({ error: "Missing type" });
      return;
    }
    if (!request.body.data && fileObject.type !== "folder") {
      response.status(400);
      response.send({ error: "Missing data" });
      return;
    }
    if (fileObject.parentId) {
      parentFile = await dbClient.fileWithID(fileObject.parentId);
      // console.log(`parentFile: ${parentFile}`);

      if (!parentFile) {
        response.status(400);
        response.send({ error: "Parent not found" });
        return;
      }

      if (parentFile.type !== "folder") {
        response.status(400);
        response.send({ error: "Parent is not a folder" });
        return;
      }
    }
    if (fileObject.isPublic !== true) {
      fileObject.isPublic = false;
    }
    // console.log(fileObject);

    if (fileObject.type !== "folder") {
      // console.log('NOT FOLDER');

      const fileDir = process.env.FOLDER_PATH || "/tmp/files_manager/";
      // console.log(`fileDir: ${fileDir}`);

      try {
        await mkdir(fileDir);
      } catch (error) {
        /* the dir may already exist */
      }

      fileObject.localPath = fileDir + uuidv4();
      // console.log(`fileObject: ${fileObject}`);

      const fileContent = Buffer.from(request.body.data, "base64").toString(
        "utf-8"
      );
      // console.log(`fileContent: ${fileContent}`);

      try {
        await writeFile(fileObject.localPath, fileContent);
      } catch (error) {
        response.status(500);
        response.send({ error: "Failed to add file" });
        return;
      }
    }

    const insertResult = await dbClient.addFile(fileObject);

    if (!insertResult.result.ok) {
      // maybe TODO: remove file
      response.status(500);
      response.send({ error: "Failed to add file" });
      return;
    }

    if (fileObject.type === "image") {
      fileQueue.add({ userId: fileObject.userId, fileId: fileObject._id });
    }

    // ``await dbClient.addFile(fileObject)``
    // inserts the mongo-generated ``_id`` into the object
    // as a side-effect,
    // but we want to response with ``id`` as the key,
    // not ``_id``.
    fileObject.id = fileObject._id;
    delete fileObject._id;

    // console.log(fileObject);

    response.status(201);
    response.send(fileObject);
  }

  // TODO: REPLACE `_id` BY `id`

  static async getShow(request, response) {
    const userSessionToken = request.get("X-Token");

    if (!userSessionToken) {
      response.status(401);
      response.send({ error: "Unauthorized" });
      return;
    }

    const userId = await redisClient.getUserId(userSessionToken);

    if (!userId) {
      response.status(401);
      response.send({ error: "Unauthorized" });
      return;
    }

    const fileWithId = await dbClient.fileWithID(request.params.id);

    if (
      !fileWithId ||
      !fileWithId.userId ||
      fileWithId.userId.toString() !== userId
    ) {
      response.status(404);
      response.send({ error: "Not found" });
      return;
    }

    response.send(fileWithId);
  }

  static async getIndex(request, response) {
    const userSessionToken = request.get("X-Token");

    if (!userSessionToken) {
      response.status(401);
      response.json({ error: "Unauthorized" });
      return;
    }

    const userId = await redisClient.getUserId(userSessionToken);

    if (!userId || !(await dbClient.userById(userId))) {
      response.status(401);
      response.json({ error: "Unauthorized" });
      return;
    }

    let { parentId } = request.query;
    if (Number.parseInt(parentId, 16) === 0) {
      parentId = null;
    }

    // console.log(`parentId: ${parentId}`);

    let result = (await dbClient.findFiles(userId, parentId)) || [];

    const pageNumber = Number.parseInt(request.query.page, 10);
    // console.log(pageNumber);
    const pageSize = 20;

    if (Number.isInteger(pageNumber)) {
      result = result.slice(
        pageNumber * pageSize,
        pageNumber * pageSize + pageSize
      );
    }

    response.json(result);
  }

  static async putPublishUnpublish(request, response, publish) {
    const userSessionToken = request.get("X-Token");
    // console.log(userSessionToken);

    if (!userSessionToken) {
      response.status(401);
      response.send({ error: "Unauthorized" });
      return;
    }

    const userId = await redisClient.getUserId(userSessionToken);
    // console.log(userId);

    if (!userId) {
      response.status(401);
      response.send({ error: "Unauthorized" });
      return;
    }

    const updateResult = await dbClient.setFilePublic(
      userId,
      request.params.id,
      publish
    );
    // console.log(updateResult);

    if (
      !updateResult ||
      !updateResult.result.ok ||
      !updateResult.matchedCount
    ) {
      response.status(404);
      response.send({ error: "Not found" });
      return;
    }

    const updatedFileObject = await dbClient.findUserFile(
      userId,
      request.params.id
    );
    // console.log(updatedFileObject);

    if (!updatedFileObject) {
      response.status(500);
      response.send({ error: "Error finding updated file" });
      return;
    }

    response.send(updatedFileObject);
  }

  static async putPublish(request, response) {
    FilesController.putPublishUnpublish(request, response, true);
  }

  static async putUnpublish(request, response) {
    FilesController.putPublishUnpublish(request, response, false);
  }

  static async getFile(request, response) {
    const fileObject = await dbClient.fileWithID(request.params.id);

    if (!fileObject) {
      response.status(404);
      response.json({ error: "Not found" });
      return;
    }

    const userSessionToken = request.get("X-Token");
    const userId = await redisClient.getUserId(userSessionToken);
    // console.log(userSessionToken, userId);

    if (!fileObject.isPublic && fileObject.userId.toString() !== userId) {
      response.status(404);
      response.json({ error: "Not found" });
      return;
    }

    if (fileObject.type === "folder") {
      response.status(400);
      response.json({ error: "A folder doesn't have content" });
      return;
    }

    let fileLocalPath = fileObject.localPath;
    const imageWidth = Number.pareseInt(request.query.size);

    if (fileObject.type === "image" && Number.isInteger(imageWidth)) {
      fileLocalPath += `_${imageWidth}`;
    }

    try {
      const fileContent = await readFile(fileLocalPath);
    } catch (error) {
      response.status(404);
      response.json({ error: "Not found" });
    }
  }
}
