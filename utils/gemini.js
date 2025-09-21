const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const generatePrompt = (style) => {
  const stylePrompts = {
    'cartoon1': 'Transform this portrait into a 3D animation style, similar to Pixar or DreamWorks. Add smooth textures, realistic lighting, and depth while keeping the person recognizable. Maintain portrait orientation. Return only the generated image with no text.',
    'cartoon2': 'Transform this portrait into an anime style illustration with clean lines, expressive eyes, and vibrant flat colors. Keep the character recognizable and stylized in anime form. Maintain portrait orientation. Return only the generated image with no text.',
    'cartoon3': 'Transform this portrait into a claymation style as if sculpted from clay. Add realistic clay textures, handcrafted look, and stop-motion feel while keeping the person recognizable. Maintain portrait orientation. Return only the generated image with no text.'
  };
  
  return stylePrompts[style] || 'Transform this portrait into a cartoon style while keeping the person recognizable. Maintain portrait orientation. Return only the generated image with no text.';
};

exports.processImageWithGemini = async (imagePath, style) => {
  try {
    // Check if image exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found at path: ${imagePath}`);
    }
    
    // Read image file
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    
    // Use the gemini-2.5-flash-image-preview model
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-image-preview"
    });
    
    // Generate prompt based on style
    const prompt = generatePrompt(style);
    
    console.log('Using gemini-2.5-flash-image-preview model for image processing');
    console.log('Prompt:', prompt);
    
    // Prepare image data
    const image = {
      inlineData: {
        data: base64Image,
        mimeType: 'image/png'
      }
    };
    
    // Generate content
    const result = await model.generateContent([prompt, image]);
    const response = await result.response;
    
    console.log('Received response from Gemini API');
    
    // Extract the image from response
    if (response.candidates && response.candidates[0].content) {
      const content = response.candidates[0].content;
      
      // Check if the response contains parts with inline data
      if (content.parts && content.parts.length > 0) {
        for (const part of content.parts) {
          if (part.inlineData) {
            console.log('Found image data in response');
            return part.inlineData.data;
          }
        }
      }
      
      // If we get here, try to extract image data from the response text
      const responseText = response.text();
      if (responseText) {
        console.log('Response text:', responseText.substring(0, 200) + '...');
        
        // Try to find base64 image data in the response
        const base64Match = responseText.match(/data:image\/[^;]+;base64,([^"]+)/);
        if (base64Match && base64Match[1]) {
          console.log('Found base64 image data in text response');
          return base64Match[1];
        }
      }
    }
    
    throw new Error('No image data found in Gemini response');
  } catch (error) {
    console.error('Error processing image with Gemini:', error);
    
    // If Gemini fails, we'll use a fallback image processing method
    console.log('Using fallback image processing method');
    return await applyFallbackProcessing(imagePath, style);
  }
};

// Fallback method if Gemini doesn't work
const applyFallbackProcessing = async (imagePath, style) => {
  try {
    // Use a simple image processing approach without external libraries
    const sharp = require('sharp');
    
    // Load the image
    let image = sharp(imagePath);
    
    // Apply different effects based on the selected style
    switch (style) {
      case 'cartoon1':
        // Cartoon effect (posterize + sharpen)
        image = image.png().modulate({
          brightness: 1.1,
          saturation: 1.2
        }).sharpen();
        break;
      case 'cartoon2':
        // Watercolor effect (blur + soften)
        image = image.png().blur(1).modulate({
          brightness: 1.05,
          saturation: 1.1
        });
        break;
      case 'cartoon3':
        // Comic effect (high contrast)
        image = image.png().normalize().modulate({
          brightness: 1,
          saturation: 1.3,
          hue: 0
        });
        break;
      default:
        image = image.png().modulate({
          brightness: 1.1,
          saturation: 1.2
        });
    }
    
    // Convert to buffer and return as base64
    const buffer = await image.toBuffer();
    return buffer.toString('base64');
  } catch (error) {
    console.error('Error in fallback processing:', error);
    
    // Ultimate fallback - just return the original image
    const imageData = fs.readFileSync(imagePath);
    return imageData.toString('base64');
  }
};