
import "dotenv/config";
import mongoose from "mongoose";
import Specialty from "../src/models/Specialty";
import { genai, GEMINI_MODEL } from "../src/lib/gemini";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  try {
    const specialties = await Specialty.find({
      description: { $exists: true, $nin: ["", null] },
      $or: [
        { descriptionAr: { $exists: false } },
        { descriptionAr: "" },
        { descriptionAr: null },
      ],
    });

    console.log(`Found ${specialties.length} specialties to translate.`);

    for (const specialty of specialties) {
      const description = specialty.description?.trim();

      if (!description) continue;

      try {
        const result = await genai.models.generateContent({
          model: GEMINI_MODEL,
          contents: `Translate this medical specialty description into accurate, natural Arabic.
Preserve the medical meaning. Return only the Arabic translation, with no explanation.

Description: ${description}`,
        });

        const translated = result.text?.trim();

        if (!translated) {
          console.log(`Skipped empty translation: ${specialty.name}`);
          continue;
        }

        // Save only if the Arabic description is still empty.
        const update = await Specialty.updateOne(
          {
            _id: specialty._id,
            $or: [
              { descriptionAr: { $exists: false } },
              { descriptionAr: "" },
              { descriptionAr: null },
            ],
          },
          { $set: { descriptionAr: translated } }
        );

        if (update.modifiedCount > 0) {
          console.log(`Translated: ${specialty.name}`);
        } else {
          console.log(`Skipped; Arabic description already exists: ${specialty.name}`);
        }
      } catch (error) {
        console.error(`Translation failed for ${specialty.name}:`, error);
      }
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
