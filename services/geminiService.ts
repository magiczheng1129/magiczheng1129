
import { GoogleGenAI } from "@google/genai";
import { StoryboardData, StoryboardShot } from "../types";

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
    if (!API_KEY) {
        throw new Error("API Key 未配置。请在URL后添加 ?key=您的API_KEY 或配置环境变量。");
    }

    // 1. Optimize images (Resize & Compress) 
    const [optimizedOriginal, optimizedMask] = await Promise.all([
      resizeImage(originalImageBase64, false),
      resizeImage(maskImageBase64, true)
    ]);

    // 2. Prepare data
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
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    if (error.message?.includes("API key not valid") || error.message?.includes("400")) {
         throw new Error("API Key 无效。请检查环境变量，或在URL后尝试添加 ?key=您的有效API_KEY");
    }

    throw error;
  }
};

/**
 * Generates a structured 3x3 storyboard prompt with highly detailed descriptions.
 */
export const generateStoryboardData = async (
    imageBase64: string, 
    shotStyle: string
): Promise<StoryboardData> => {
    try {
        if (!API_KEY) throw new Error("API Key Missing");

        const optimizedImage = await resizeImage(imageBase64, false);
        const mimeMatch = optimizedImage.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const cleanData = optimizedImage.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

        const prompt = `
            Role: Expert Cinematographer and Midjourney/Stable Diffusion Prompt Engineer.
            Task: Analyze the input image and create a **highly detailed** 9-shot storyboard plan (3x3 grid) for AI image generation.
            Requested Style: ${shotStyle}.

            INSTRUCTIONS:
            1. **Reverse Engineering**: Analyze the input image's lighting (e.g., volumetric, natural, neon), texture (e.g., film grain, 8k, unreal engine 5), colors, and subject details.
            2. **Main Prompt**: Write a master description that establishes the world, atmosphere, and artistic style. It must be descriptive enough to set the tone for all shots.
            3. **Shot Details**: For each of the 9 shots, provide a **rich, visual description**. 
               - DO NOT just say "A man standing". 
               - DO SAY "A cinematic medium shot of a man standing in rain, rim lighting, shallow depth of field, 35mm lens, intense expression, hyper-realistic texture."
               - Ensure variety in camera angles based on the requested style.
            
            Output Constraint: Return strictly valid JSON. No Markdown.
            
            JSON Structure:
            {
              "mainPromptCn": "Detailed Chinese description of environment, lighting, artistic style, and subject attributes.",
              "mainPromptEn": "Detailed English description of environment, lighting, artistic style, and subject attributes.",
              "shots": [
                 { 
                   "id": 1, 
                   "shotTypeCn": "e.g. 特写", 
                   "shotTypeEn": "e.g. Close-up", 
                   "contentCn": "Rich Chinese description of Shot 1 including action, lighting, and camera details.", 
                   "contentEn": "Rich English description of Shot 1 including action, lighting, and camera details." 
                 },
                 ... (total 9 items)
              ]
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType, data: cleanData } }
                ]
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No response from AI");

        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);

    } catch (error) {
        console.error("Storyboard Gen Error", error);
        throw error;
    }
}

/**
 * Regenerates a single shot description with high detail.
 */
export const regenerateSingleShot = async (
    imageBase64: string,
    currentShot: StoryboardShot,
    mainPromptEn: string,
    desiredShotTypeEn: string
): Promise<StoryboardShot> => {
    try {
        if (!API_KEY) throw new Error("API Key Missing");

        const optimizedImage = await resizeImage(imageBase64, false);
        const mimeMatch = optimizedImage.match(/^data:(image\/[a-zA-Z+]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const cleanData = optimizedImage.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

        const prompt = `
            Role: Expert Cinematographer.
            Context: We are refining a 3x3 storyboard for AI generation.
            Main Scene Context: ${mainPromptEn}
            
            Task: Rewrite the description for Shot #${currentShot.id} to match the new Shot Type: "${desiredShotTypeEn}".
            
            Requirements:
            - The new description must be **visually rich and detailed**.
            - Include specific details about the subject's pose/action relevant to the new shot type.
            - Include lighting, camera lens (e.g., "wide angle", "telephoto"), and depth of field details.
            - Maintain consistency with the Main Scene Context.
            
            Output Constraint: Return strictly valid JSON for a single shot object.
            {
               "id": ${currentShot.id},
               "shotTypeCn": "...",
               "shotTypeEn": "${desiredShotTypeEn}",
               "contentCn": "Detailed Chinese description...",
               "contentEn": "Detailed English description..."
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType, data: cleanData } }
                ]
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No response");
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Single Shot Gen Error", error);
        throw error;
    }
}
