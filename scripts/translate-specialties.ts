
import "dotenv/config"
import mongoose from "mongoose"
import { GoogleGenAI } from "@google/genai"
import Specialty from "../src/models/Specialty"

async function main() {
    const uri = process.env.MONGODB_URI
    const apiKey = process.env.GEMINI_API_KEY

    if (!uri) throw new Error("MONGODB_URI is not set")
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set")

    await mongoose.connect(uri.replace("localhost", "127.0.0.1"))

    const genai = new GoogleGenAI({ apiKey })

    // Process only specialties that do not already have an Arabic name.
    const specialties = await Specialty.find({
        $or: [
            { nameAr: { $exists: false } },
            { nameAr: null },
            { nameAr: "" },
        ],
    }).sort({ name: 1 })

    console.log(`Found ${specialties.length} specialties needing Arabic translations.`)

    let translated = 0
    let failed = 0

    for (const specialty of specialties) {
        try {
            const result = await genai.models.generateContent({
                model: "gemini-3.5-flash-lite",
                contents: `Translate this medical specialty name into accurate Arabic.
Return only the Arabic translation, without explanations or quotation marks.
Specialty: ${specialty.name}`,
            })

            const nameAr = result.text?.trim()

            if (!nameAr) {
                failed++
                console.error(`No translation returned for: ${specialty.name}`)
                continue
            }

            specialty.nameAr = nameAr
            await specialty.save()

            translated++
            console.log(`${specialty.name} -> ${nameAr}`)
        } catch (error) {
            failed++
            console.error(`Failed: ${specialty.name}`, error)
        }
    }

    console.log(`Finished. Translated: ${translated}; failed: ${failed}.`)
    await mongoose.disconnect()
}

main().catch(async (error) => {
    console.error(error)
    await mongoose.disconnect()
    process.exit(1)
})
