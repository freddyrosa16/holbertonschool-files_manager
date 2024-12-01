import Queue from "bull";
import imageThumbnail from "image-thumbnail";
import { promises as fsPromises } from "fs";
import dbClient from "./utils/db";

const { writeFile, readFile } = fsPromises;

const fileQueue = new Queue("fileQueue");
fileQueue.process(async (job, done) => {
  if (!job) {
    done(new Error("Missing job"));
    return;
  }
  if (job.data.fileId === undefined) {
    done(new Error("Missing fileId"));
    return;
  }
  if (job.data.userId === undefined) {
    done(new Error("Missing userId"));
    return;
  }

  const imageFileObject = await dbClient.findUserFile(
    job.data.userId,
    job.data.fileId
  );
  if (!imageFileObject) {
    done(new Error("File not found"));
    return;
  }

  const failedSizes = [];

  for (const width of [100, 250, 500]) {
    console.log(`width: ${width}, localPath: ${imageFileObject.localPath}`);

    let thumbnail;
    try {
      const imageFileDataBuffer = await readFile(imageFileObject.localPath);

      // console.log(imageFileDataBuffer);

      thumbnail = await imageThumbnail(imageFileDataBuffer, { width });

      await writeFile(`${imageFileObject.localPath}_${width}`, thumbnail);
    } catch (error) {
      console.log(error);
      failedSizes.push(width);
    }
  }

  console.log(failedSizes);
  // console.log(job, fileObject, failedSizes);

  if (failedSizes) {
    done(
      new Error(
        `Failed to generate thumnail of sizes: ${failedSizes.join(", ")}`
      )
    );
  } else {
    done();
  }
});

export default fileQueue;
