// enhanced-gemini-image.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Target output size
const TARGET_WIDTH = 720;
const TARGET_HEIGHT = 1280; // portrait 9:16

const generatePrompt = (style) => {
  console.log("Prompt:", style);

  const stylePrompts = {
    cartoon1: `Create a character illustration from this image in the style of a modern Pixar or Disney animated film. The character should have soft, rounded features, large, expressive eyes, and a friendly, inviting expression. Use smooth, subtle shading and a warm, vibrant color palette. The lighting should be soft and cinematic, with a gentle glow that gives it a magical, polished look.`,

    cartoon2: `Transform this image into a character design reminiscent of a modern DreamWorks animated film. The character should have slightly exaggerated features and dynamic, spirited facial expressions. Use bold, saturated colors and dramatic, directional lighting to create a strong sense of depth. Incorporate subtle textures to add detail and a sense of realism, while maintaining a playful, stylized aesthetic.`,

    cartoon3: `Convert this image into a character illustration in a modern anime/manga style. Emphasize clean, sharp lines, slightly elongated proportions, and either large, expressive eyes (for a classic look) or more realistic, detailed eyes (for a contemporary feel). Use dynamic shading, a vibrant yet sometimes muted color palette, and subtle lighting effects that enhance the character's mood or action. The overall look should be visually striking, capturing the essence of popular anime or manga aesthetics.`,
  };

  //   const stylePrompts = {
  //     cartoon1: `Transform this portrait into a high-quality 3D animated character style (like Pixar/DreamWorks). Keep the person recognizable but give them a polished 3D cartoon appearance with:
  // - Smooth, stylized features
  // - Enhanced lighting and shading
  // - Vibrant but natural colors
  // - Professional 3D rendering quality
  // - Portrait orientation
  // - Clean, professional look`,

  //     cartoon2: `Transform this portrait into a beautiful anime/manga style illustration with:
  // - Clean line art
  // - Large expressive eyes
  // - Vibrant colors
  // - Anime character proportions
  // - Stylized hair and features
  // - Portrait orientation
  // - High quality anime art style`,

  //     cartoon3: `Transform this portrait into a claymation/stop-motion style character like from Wallace & Gromit with:
  // - Clay texture appearance
  // - Slightly exaggerated features
  // - Matte surface finish
  // - Handcrafted look
  // - Portrait orientation
  // - Keep the person recognizable`,
  //   };

  return (
    stylePrompts[style] ||
    `Transform this portrait into a stylized artistic version while keeping the person recognizable. Use portrait orientation and high quality.`
  );
};

const getImageMimeType = (buffer) => {
  // Check the first few bytes to determine image type
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return "image/png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46)
    return "image/gif";
  if (
    buffer[0] === 0x57 &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x42 &&
    buffer[3] === 0x50
  )
    return "image/webp";
  return "image/png"; // default fallback
};

const resizeBufferToTarget = async (buffer) => {
  const sharp = require("sharp");
  try {
    const resized = await sharp(buffer)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, {
        fit: "cover",
        position: "centre",
      })
      .png()
      .toBuffer();

    const meta = await sharp(resized).metadata();
    console.log(
      `Resized image metadata: ${meta.format} ${meta.width}x${meta.height}`
    );
    return resized;
  } catch (error) {
    console.error("Error in resizeBufferToTarget:", error);
    throw error;
  }
};

exports.processImageWithGemini = async (imagePath, style) => {
  try {
    // Validate file
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found at path: ${imagePath}`);
    }

    // Read and prepare input image
    const imageData = fs.readFileSync(imagePath);
    const mimeType = getImageMimeType(imageData);
    const base64Image = imageData.toString("base64");

    console.log(`Input image: ${mimeType}, size: ${imageData.length} bytes`);

    // Initialize model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image-preview",
    });

    const prompt = generatePrompt(style);
    console.log("Using gemini-2.5-flash-image-preview model");
    console.log("Prompt:", prompt);

    // Prepare the input
    const parts = [
      {
        text: prompt,
      },
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType,
        },
      },
    ];

    // Call the API
    console.log("Calling Gemini API...");
    const result = await model.generateContent(parts);

    if (!result || !result.response) {
      throw new Error("No response received from Gemini API");
    }

    const response = result.response;
    console.log("Received response from Gemini API");

    // Debug: log response structure
    console.log(
      "Response structure:",
      JSON.stringify({
        candidates: response.candidates?.length,
        hasText: typeof response.text === "function",
      })
    );

    // Try to extract image data from response
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];

      if (candidate.content && candidate.content.parts) {
        console.log(
          `Found ${candidate.content.parts.length} parts in response`
        );

        for (let i = 0; i < candidate.content.parts.length; i++) {
          const part = candidate.content.parts[i];

          if (part.inlineData && part.inlineData.data) {
            console.log(`Found image data in part ${i}`);
            const imageData = part.inlineData.data;

            // Convert base64 to buffer
            const buffer = Buffer.from(imageData, "base64");
            console.log(`Generated image buffer size: ${buffer.length} bytes`);

            // Resize to target dimensions
            const resizedBuffer = await resizeBufferToTarget(buffer);
            return resizedBuffer.toString("base64");
          }
        }
      }
    }

    // If no image found in structured response, try text parsing as fallback
    if (typeof response.text === "function") {
      const responseText = response.text();
      console.log("Response text length:", responseText?.length || 0);

      if (responseText) {
        // Look for base64 data in various formats
        const patterns = [
          /data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/,
          /base64:([A-Za-z0-9+/=]+)/,
          /([A-Za-z0-9+/=]{100,})/, // Long base64 string
        ];

        for (const pattern of patterns) {
          const match = responseText.match(pattern);
          if (match) {
            const base64Data = match[1] || match[0];
            console.log(
              `Found base64 data using pattern, length: ${base64Data.length}`
            );

            try {
              const buffer = Buffer.from(base64Data, "base64");
              const resizedBuffer = await resizeBufferToTarget(buffer);
              return resizedBuffer.toString("base64");
            } catch (parseError) {
              console.log(
                "Failed to parse base64 data, trying next pattern..."
              );
            }
          }
        }
      }
    }

    throw new Error(
      "No image data found in Gemini response. The model may not have generated an image."
    );
  } catch (error) {
    console.error("Error processing image with Gemini:", error.message);

    // Enhanced error logging
    if (error.message.includes("API_KEY")) {
      console.error(
        "API Key issue - check your GOOGLE_API_KEY environment variable"
      );
    } else if (
      error.message.includes("quota") ||
      error.message.includes("limit")
    ) {
      console.error("API quota/rate limit exceeded");
    } else if (error.message.includes("model")) {
      console.error("Model-related error - check if the model name is correct");
    }

    console.log("Falling back to basic image processing...");
    return await applyFallbackProcessing(imagePath, style);
  }
};

// Improved fallback method
const applyFallbackProcessing = async (imagePath, style) => {
  try {
    const sharp = require("sharp");
    console.log("Applying fallback processing for style:", style);

    let image = sharp(imagePath);

    // Apply style-specific effects
    switch (style) {
      case "cartoon1":
        image = image
          .modulate({
            brightness: 1.1,
            saturation: 1.2,
            hue: 0,
          })
          .sharpen({ sigma: 1, flat: 1, jagged: 2 });
        break;

      case "cartoon2":
        image = image
          .blur(0.5)
          .modulate({
            brightness: 1.05,
            saturation: 1.15,
          })
          .sharpen({ sigma: 0.5, flat: 1, jagged: 1 });
        break;

      case "cartoon3":
        image = image
          .normalize()
          .modulate({
            brightness: 0.98,
            saturation: 1.1,
          })
          .convolve({
            width: 3,
            height: 3,
            kernel: [-1, -1, -1, -1, 9, -1, -1, -1, -1],
          });
        break;

      default:
        image = image.modulate({
          brightness: 1.05,
          saturation: 1.1,
        });
    }

    // Process and resize
    const processedBuffer = await image.png().toBuffer();
    const finalBuffer = await resizeBufferToTarget(processedBuffer);

    console.log("Fallback processing completed successfully");
    return finalBuffer.toString("base64");
  } catch (error) {
    console.error("Error in fallback processing:", error);

    // Ultimate fallback - just resize original
    try {
      const sharp = require("sharp");
      const originalBuffer = fs.readFileSync(imagePath);
      const resizedBuffer = await sharp(originalBuffer)
        .resize(TARGET_WIDTH, TARGET_HEIGHT, {
          fit: "cover",
          position: "centre",
        })
        .png()
        .toBuffer();

      console.log("Ultimate fallback: resized original image");
      return resizedBuffer.toString("base64");
    } catch (ultimateError) {
      console.error("Ultimate fallback also failed:", ultimateError);
      throw new Error("All image processing methods failed");
    }
  }
};
