import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY || '';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper to resize and compress image for faster API transmission
const resizeImage = (base64Str: string, isMask: boolean = false): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    // Base64 doesn't strictly need crossOrigin, but good practice
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      // Limit resolution to speed up processing and upload
      // 1536px is a sweet spot for quality vs speed for Gemni Flash
      const MAX_SIZE = 1536; 
      let w = img.width;
      let h = img.height;
      
      // Calculate new dimensions preserving aspect ratio
      if (w > MAX_SIZE || h > MAX_SIZE) {
        if (w > h) {
          h = Math.round((h * MAX_SIZE) / w);
          w = MAX_SIZE;
        } else {
          w = Math.round((w * MAX_SIZE) / h);
          h = MAX_SIZE;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
         resolve(base64Str);
         return;
      }
      
      // If it's a mask, ensure clean black background
      if (isMask) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, w, h);
      }
      
      ctx.drawImage(img, 0, 0, w, h);
      
      // Use JPEG 0.85 for photo to significantly reduce payload size (Speed Boost)
      // Use PNG for mask to ensure sharp edges (Logic Correctness)
      const format = isMask ? 'image/png' : 'image/jpeg';
      const quality = isMask ? undefined : 0.85;
      
      resolve(canvas.toDataURL(format, quality));
    };
    
    // Fallback if image loading fails
    img.onerror = () => resolve(base64Str);
  });
};

/**
 * Removes the masked area using Gemini Nano Banana (gemini-2.5-flash-image)
 */
export const removeWatermark = async (
  originalImageBase64: string,
  maskImageBase64: string
): Promise<string> => {
  try {
    // 1. Optimize images (Resize & Compress) 
    // This fixes "Speed is slow" by reducing payload size significantly
    const [optimizedOriginal, optimizedMask] = await Promise.all([
      resizeImage(originalImageBase64, false),
      resizeImage(maskImageBase64, true)
    ]);

    // 2. Prepare data
    // Detect MIME type from the optimized string (likely jpeg now)
    const mimeMatch = optimizedOriginal.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    
    const cleanOriginal = optimizedOriginal.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
    const cleanMask = optimizedMask.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    // 3. Call API
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            // Explicit Prompt to fix "Failure"
            text: "Image Editing Task: Inpainting.\n\nInput Data:\n- Image 1: The original photograph.\n- Image 2: A binary mask (White = Area to remove/edit, Black = Keep).\n\nGoal:\nRemove the content in Image 1 that matches the White area in Image 2. Replace it with realistic background texture that blends seamlessly with the surrounding pixels.\n\nConstraint:\nReturn ONLY the processed image.",
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanOriginal,
            },
          },
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanMask,
            },
          },
        ],
      },
    });

    // 4. Parse Response
    let resultImageBase64 = '';
    
    if (response.candidates?.[0]?.content?.parts) {
       for (const part of response.candidates[0].content.parts) {
         if (part.inlineData && part.inlineData.data) {
           resultImageBase64 = `data:image/png;base64,${part.inlineData.data}`;
           break;
         }
       }
    }

    if (!resultImageBase64) {
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
          console.warn("Model failure text:", text);
          throw new Error("AI处理失败: 模型拒绝了该请求(可能涉及敏感内容或无法识别)。");
      }
      throw new Error("AI生成失败，请稍后重试。");
    }

    return resultImageBase64;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};