import { createContext, useState, useRef } from "react";
import { fileToGenerativePart } from "../config/gemini";
import { useChatStore } from "../stores/chatStore";
import { useSessionStore } from "../stores/sessionStore";
// eslint-disable-next-line react-refresh/only-export-components
export const Context = createContext();

const ContextProvider = (props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [input, setInput] = useState("");
  const [recentPrompt, setRecentPrompt] = useState("");
  const [prevPrompts, setPrevPrompts] = useState([]);
  const [showResult, setShowResult] = useState(false);
  // 图片上传相关
  const [uploadedImages, setUploadedImages] = useState([]); // 当前上传的图片列表
  const fileInputRef = useRef(null); // 文件输入框引用

  // 从 Zustand stores 获取状态和方法
  const chatHistory = useChatStore((state) => state.chatHistory);
  const resultData = useChatStore((state) => state.resultData);
  const isTyping = useChatStore((state) => state.isTyping);
  const isRetrying = useChatStore((state) => state.isRetrying);
  const retryInfo = useChatStore((state) => state.retryInfo);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const stopGeneration = useChatStore((state) => state.stopGeneration);
  const clearChat = useChatStore((state) => state.clearChat);
  const loadChatHistory = useChatStore((state) => state.loadChatHistory);

  const chatSessions = useSessionStore((state) => state.chatSessions);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const saveSession = useSessionStore((state) => state.saveSession);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const setCurrentSessionId = useSessionStore(
    (state) => state.setCurrentSessionId
  );
  const getSession = useSessionStore((state) => state.getSession);
  const clearCurrentSession = useSessionStore(
    (state) => state.clearCurrentSession
  );

  // 图片压缩函数（支持格式转换）
  const compressImage = (
    file,
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.65,
    targetType = null
  ) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          // 计算新尺寸（保持宽高比）
          let width = img.width;
          let height = img.height;

          // 如果图片很大，即使不超过 maxWidth/maxHeight 也进行适度缩放
          // 这样可以进一步压缩文件大小
          const maxDimension = Math.max(width, height);
          if (maxDimension > maxWidth) {
            const ratio = maxWidth / maxDimension;
            width = width * ratio;
            height = height * ratio;
          } else if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = width * ratio;
            height = height * ratio;
          }

          // 创建 canvas 并绘制
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = width;
          canvas.height = height;

          // 填充白色背景（对于透明图片转换为 JPEG）
          if (targetType === "image/jpeg") {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);
          }

          // 使用高质量缩放
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          // 确定输出格式
          const outputType = targetType || file.type;

          // 转换为 Blob（压缩）
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // 创建新的 File 对象
                const compressedFile = new File([blob], file.name, {
                  type: outputType,
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error("图片压缩失败"));
              }
            },
            outputType,
            quality
          );
        };

        img.onerror = () => {
          reject(new Error("图片加载失败"));
        };

        img.src = e.target.result;
      };

      reader.onerror = () => {
        reject(new Error("文件读取失败"));
      };

      reader.readAsDataURL(file);
    });
  };

  // 处理图片上传
  const handleImageUpload = async (files) => {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length === 0) {
      setError("请选择有效的图片文件");
      return;
    }

    // 限制图片数量（最多 4 张）
    if (uploadedImages.length + imageFiles.length > 4) {
      setError("最多只能上传 4 张图片");
      return;
    }

    // 限制图片大小（每张最多 10MB，压缩前）
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = imageFiles.filter((file) => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      setError(
        `图片大小不能超过 10MB：${oversizedFiles.map((f) => f.name).join(", ")}`
      );
      return;
    }

    try {
      // 压缩并读取图片
      const newImages = await Promise.all(
        imageFiles.map(async (file) => {
          // 压缩图片（如果图片较大）
          let processedFile = file;
          const shouldCompress = file.size > 300 * 1024; // 大于 300KB 才压缩

          if (shouldCompress) {
            console.log(
              `[图片压缩] 开始压缩: ${file.name} (${(file.size / 1024).toFixed(
                2
              )}KB, 格式: ${file.type})`
            );
            try {
              // 根据文件大小动态调整压缩参数，更激进的压缩策略
              const fileSizeMB = file.size / (1024 * 1024);
              let maxSize, quality;

              if (fileSizeMB > 5) {
                // 超大文件：1024x1024，质量 50%
                maxSize = 1024;
                quality = 0.5;
              } else if (fileSizeMB > 2) {
                // 大文件：1280x1280，质量 55%
                maxSize = 1280;
                quality = 0.55;
              } else {
                // 中等文件：1280x1280，质量 60%
                maxSize = 1280;
                quality = 0.6;
              }

              // PNG/GIF 转换为 JPEG（JPEG 压缩效果更好）
              const targetFormat =
                file.type === "image/png" || file.type === "image/gif"
                  ? "image/jpeg"
                  : file.type;

              console.log(
                `[图片压缩] 压缩参数: ${maxSize}x${maxSize} 像素, 质量 ${(
                  quality * 100
                ).toFixed(0)}%, 格式: ${targetFormat}`
              );

              processedFile = await compressImage(
                file,
                maxSize,
                maxSize,
                quality,
                targetFormat
              );
              const originalSize = (file.size / 1024).toFixed(2);
              const compressedSize = (processedFile.size / 1024).toFixed(2);
              const reduction = (
                (1 - processedFile.size / file.size) *
                100
              ).toFixed(1);
              console.log(
                `[图片压缩] ${file.name}: ${originalSize}KB → ${compressedSize}KB (减少 ${reduction}%)`
              );
            } catch (compressError) {
              console.warn("[图片压缩] 压缩失败，使用原图:", compressError);
              processedFile = file; // 压缩失败，使用原图
            }
          } else {
            console.log(
              `[图片压缩] 跳过压缩: ${file.name} (${(file.size / 1024).toFixed(
                2
              )}KB，小于 300KB 阈值)`
            );
          }

          const preview = URL.createObjectURL(processedFile);
          const generativePart = await fileToGenerativePart(processedFile);
          return {
            file: processedFile,
            originalFile: file, // 保留原文件引用（用于显示文件名）
            preview,
            generativePart,
            id: Date.now() + Math.random(), // 生成唯一 ID
          };
        })
      );

      setUploadedImages((prev) => [...prev, ...newImages]);
    } catch (error) {
      console.error("图片上传失败:", error);
      setError("图片上传失败，请重试");
    }
  };

  // 删除图片
  const removeImage = (imageId) => {
    setUploadedImages((prev) => {
      const image = prev.find((img) => img.id === imageId);
      if (image) {
        URL.revokeObjectURL(image.preview); // 释放预览 URL
      }
      return prev.filter((img) => img.id !== imageId);
    });
  };

  // 清空所有图片
  const clearImages = () => {
    uploadedImages.forEach((img) => {
      URL.revokeObjectURL(img.preview);
    });
    setUploadedImages([]);
  };

  // 创建新会话
  const newChat = () => {
    setLoading(false);
    setShowResult(false);
    clearChat(); // 清空聊天状态（Zustand）
    clearImages(); // 清空图片
    setRecentPrompt("");
    clearCurrentSession(); // 清空当前会话 ID（Zustand）
  };

  // 保存当前会话到 localStorage
  const saveCurrentSession = () => {
    if (chatHistory.length === 0) return; // 没有对话内容不保存

    const sessionData = {
      id: currentSessionId || Date.now().toString(),
      title: chatHistory[0]?.parts[0]?.text || "新对话",
      chatHistory: chatHistory,
      createdAt: currentSessionId
        ? getSession(currentSessionId)?.createdAt || Date.now()
        : Date.now(),
      updatedAt: Date.now(),
    };

    saveSession(sessionData);
  };

  // 打开会话
  const openSession = (sessionId) => {
    const session = getSession(sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      loadChatHistory(session.chatHistory); // 加载聊天历史（Zustand）
      setShowResult(session.chatHistory.length > 0);
      setRecentPrompt("");
    }
  };

  // 删除会话
  const handleDeleteSession = (sessionId) => {
    deleteSession(sessionId);

    // 如果删除的是当前会话，清空显示
    if (currentSessionId === sessionId) {
      newChat();
    }
  };

  const onSent = async (prompt) => {
    try {
      setLoading(true);
      setError(null);
      setShowResult(true);

      // 确定要使用的提示词
      const userMessage = prompt !== undefined ? prompt : input;

      // 立即清空输入框（用户发送后立即清空，不等开始生成）
      setInput("");

      // 保存用户消息到历史记录
      setPrevPrompts((prev) => [...prev, userMessage]);
      setRecentPrompt(userMessage);

      // 处理图片：转换为 Gemini API 格式
      const imageParts = uploadedImages.map((img) => img.generativePart);

      // 清空图片（发送后清空）
      clearImages();

      // 使用 Zustand store 发送消息
      let fullResponse;
      try {
        fullResponse = await sendMessage(userMessage, imageParts);
      } catch (err) {
        // 如果是用户中断，不抛出错误（因为可能已保存部分内容）
        if (err.message === "请求已被用户中断") {
          // 用户主动停止，不抛出错误，让流程正常结束
          fullResponse = "";
        } else {
          // 其他错误，抛出
          throw err;
        }
      }

      // 获取更新后的聊天历史
      const updatedHistory = useChatStore.getState().chatHistory;

      // 保存会话到 localStorage（即使被中断，也保存当前状态）
      const sessionData = {
        id: currentSessionId || Date.now().toString(),
        title: updatedHistory[0]?.parts[0]?.text || "新对话",
        chatHistory: updatedHistory,
        createdAt: currentSessionId
          ? getSession(currentSessionId)?.createdAt || Date.now()
          : Date.now(),
        updatedAt: Date.now(),
      };

      saveSession(sessionData);

      return fullResponse || "";
    } catch (err) {
      // 如果是用户中断，不显示错误（因为已保存部分内容）
      if (err.message === "请求已被用户中断") {
        // 用户主动停止，不显示错误
        useChatStore.getState().setIsTyping(false);
        console.log("用户已停止生成");
      } else {
        // 其他错误，显示错误提示
        setError(err.message);
        useChatStore.getState().setIsTyping(false);
        console.error("发送消息失败:", err);

        // 如果出错且没有保存任何内容，回滚用户消息
        const currentHistory = useChatStore.getState().chatHistory;
        const lastMessage = currentHistory[currentHistory.length - 1];
        if (
          currentHistory.length > 0 &&
          lastMessage?.role === "user" &&
          // 检查是否有对应的 AI 回复（如果没有，说明完全失败）
          !currentHistory.some(
            (msg, index) =>
              index > currentHistory.length - 1 && msg.role === "model"
          )
        ) {
          useChatStore.getState().setChatHistory(currentHistory.slice(0, -1));
        }
      }
      // 不抛出错误，让流程正常结束
    } finally {
      setLoading(false);
    }
  };

  const ContextValue = {
    // methods
    onSent,
    newChat,
    openSession,
    deleteSession: handleDeleteSession,
    saveCurrentSession,
    handleImageUpload, // 图片上传
    removeImage, // 删除图片
    clearImages, // 清空图片
    stopGeneration, // 停止生成

    // states
    loading,
    error,
    input,
    recentPrompt,
    prevPrompts,
    showResult,
    resultData, // 从 Zustand 获取
    isTyping, // 从 Zustand 获取
    isRetrying, // 从 Zustand 获取
    retryInfo, // 从 Zustand 获取
    chatHistory, // 从 Zustand 获取
    chatSessions, // 从 Zustand 获取
    currentSessionId, // 从 Zustand 获取
    uploadedImages, // 上传的图片列表
    fileInputRef, // 文件输入框引用

    // setters
    setLoading,
    setError,
    setInput,
    setRecentPrompt,
    setPrevPrompts,
    setShowResult,
  };

  return (
    <Context.Provider value={ContextValue}>{props.children}</Context.Provider>
  );
};

export default ContextProvider;
