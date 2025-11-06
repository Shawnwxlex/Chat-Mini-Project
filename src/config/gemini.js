import { GoogleGenerativeAI } from "@google/generative-ai";

// 优先使用环境变量，如果没有则使用默认值（开发用）
// ⚠️ 注意：默认 API Key 仅用于开发测试，生产环境请务必使用 .env 文件
const API_KEY =
  import.meta.env.VITE_GEMINI_API_KEY ||
  "AIzaSyC9BIvgkTQBfI2toMl2hVSrcg3ZSUwpI_w";

// 如果使用默认值，给出提示
if (!import.meta.env.VITE_GEMINI_API_KEY) {
  console.warn(
    "⚠️ 警告：未找到 VITE_GEMINI_API_KEY 环境变量，使用默认 API Key\n" +
      "建议：在项目根目录创建 .env 文件，添加：VITE_GEMINI_API_KEY=your_api_key_here"
  );
}

const genAI = new GoogleGenerativeAI(API_KEY);

// 非流式响应（保留作为备用）
async function run(prompt, chatHistory = []) {
  try {
    // 检查 API 密钥
    if (!API_KEY) {
      throw new Error(
        "请设置有效的 Gemini API 密钥。在项目根目录创建 .env 文件，添加：VITE_GEMINI_API_KEY=your_api_key_here"
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 如果有历史记录，使用 startChat 来维持对话上下文
    if (chatHistory.length > 0) {
      const chat = model.startChat({
        history: chatHistory,
      });
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();
      console.log(text);
      return text;
    } else {
      // 首次对话，使用原来的方式（确保能正常工作）
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      console.log(text);
      return text;
    }
  } catch (error) {
    console.error("API 调用失败:", error);
    throw error;
  }
}

// 流式响应函数 - 支持实时更新（支持图片）
// 支持 AbortController 中断请求
async function runStream(
  prompt,
  chatHistory = [],
  onChunk,
  imageParts = [],
  abortSignal = null
) {
  try {
    // 检查 API 密钥
    if (!API_KEY) {
      throw new Error(
        "请设置有效的 Gemini API 密钥。在项目根目录创建 .env 文件，添加：VITE_GEMINI_API_KEY=your_api_key_here"
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    let fullText = "";

    // 构建消息内容（文本 + 图片）
    const messageParts =
      imageParts.length > 0 ? [...imageParts, { text: prompt }] : prompt;

    // 如果有历史记录，使用 startChat 来维持对话上下文
    if (chatHistory.length > 0) {
      const chat = model.startChat({
        history: chatHistory,
      });

      // 使用流式响应（支持图片）
      const result = await chat.sendMessageStream(messageParts);

      // 实时处理每个数据块
      for await (const chunk of result.stream) {
        // 检查是否被中断
        if (abortSignal?.aborted) {
          throw new Error("请求已被用户中断");
        }

        const chunkText = chunk.text();
        fullText += chunkText;

        // 调试日志：验证流式对话是否生效
        console.log(`[流式对话] 收到数据块: "${chunkText}"`);
        console.log(`[流式对话] 累计文本长度: ${fullText.length} 字符`);

        // 调用回调函数，实时更新 UI
        if (onChunk) {
          onChunk(chunkText, fullText);
        }
      }
    } else {
      // 首次对话，使用流式响应（支持图片）
      const result = await model.generateContentStream(messageParts);

      // 实时处理每个数据块
      for await (const chunk of result.stream) {
        // 检查是否被中断
        if (abortSignal?.aborted) {
          throw new Error("请求已被用户中断");
        }

        const chunkText = chunk.text();
        fullText += chunkText;

        // 调试日志：验证流式对话是否生效
        console.log(`[流式对话] 收到数据块: "${chunkText}"`);
        console.log(`[流式对话] 累计文本长度: ${fullText.length} 字符`);

        // 调用回调函数，实时更新 UI
        if (onChunk) {
          onChunk(chunkText, fullText);
        }
      }
    }

    return fullText;
  } catch (error) {
    console.error("API 调用失败:", error);
    throw error;
  }
}

// 将图片文件转换为 Gemini API 需要的格式
export function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const base64Data = reader.result.split(",")[1]; // 移除 data:image/...;base64, 前缀
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsDataURL(file);
  });
}

export default run;
export { runStream };

// async function run2() {
//   const imagePart = fileToPart("./demo.jpg", "image/jpeg");
//   const res = await ai.models.generateContent({
//     model: "gemini-2.5-flash",
//     contents: [imagePart, "explain this image briefly"],
//   });
//   console.log(res.text);
// }

// run2();
