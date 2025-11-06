import { create } from "zustand";
import { runStream } from "../config/gemini";

// 流式渲染相关的 ref（需要在 store 外部管理，因为 ref 不触发重渲染）
export const streamBufferRef = { current: "" };
export const displayedIndexRef = { current: 0 };
export const rafIdRef = { current: null };
export const isStreamingRef = { current: false };
export const abortControllerRef = { current: null }; // AbortController 引用

// 格式化消息（已废弃，使用 MarkdownRenderer）
// 保留用于向后兼容，但不再使用
// const formatMessage = (text) => {
//   let formatted = text
//     .split("**")
//     .map((part, i) => (i % 2 === 1 ? `<b>${part}</b>` : part))
//     .join("");
//   return formatted.split("*").join("<br/>");
// };

// 停止平滑渲染
const stopSmoothRender = () => {
  if (rafIdRef.current) {
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;
  }
};

// 平滑渲染器：使用 requestAnimationFrame 批量上屏
const startSmoothRender = (setResultData, setIsTyping) => {
  // 如果已经在运行，不重复启动
  if (rafIdRef.current) return;

  const render = () => {
    const buffer = streamBufferRef.current;
    const currentIndex = displayedIndexRef.current;

    if (currentIndex < buffer.length) {
      // 每帧显示多个字符（批量渲染，提高流畅度）
      const remainingChars = buffer.length - currentIndex;
      const batchSize = Math.min(remainingChars > 50 ? 10 : 5, remainingChars);

      // 更新显示索引
      displayedIndexRef.current = Math.min(
        currentIndex + batchSize,
        buffer.length
      );

      // 获取要显示的文本（直接使用原始文本，MarkdownRenderer 会处理格式化）
      const textToShow = buffer.substring(0, displayedIndexRef.current);
      setResultData(textToShow);

      // 继续下一帧
      rafIdRef.current = requestAnimationFrame(render);
    } else if (isStreamingRef.current) {
      // 缓冲区已全部显示，但还在流式接收，等待新数据
      rafIdRef.current = requestAnimationFrame(render);
    } else {
      // 流式完成且全部显示完成
      stopSmoothRender();
      setIsTyping(false);
    }
  };

  // 启动渲染循环
  rafIdRef.current = requestAnimationFrame(render);
};

// 聊天状态 Store
export const useChatStore = create((set, get) => ({
  // 状态
  chatHistory: [],
  resultData: "",
  isTyping: false,
  isRetrying: false, // 是否正在重试
  retryInfo: null, // 重试信息 { attempt: 1, maxAttempts: 3, delay: 1000 }
  showVPNWarning: false, // 是否显示 VPN 提示

  // Actions
  // 设置对话历史
  setChatHistory: (history) => set({ chatHistory: history }),

  // 添加用户消息
  addUserMessage: (message) =>
    set((state) => ({
      chatHistory: [...state.chatHistory, message],
    })),

  // 添加 AI 回复
  addModelMessage: (message) =>
    set((state) => ({
      chatHistory: [...state.chatHistory, message],
    })),

  // 设置流式响应数据
  setResultData: (data) => set({ resultData: data }),

  // 设置流式状态
  setIsTyping: (typing) => set({ isTyping: typing }),

  // 设置重试状态
  setIsRetrying: (retrying) => set({ isRetrying: retrying }),
  setRetryInfo: (info) => set({ retryInfo: info }),

  // 设置 VPN 提示状态
  setShowVPNWarning: (show) => set({ showVPNWarning: show }),

  // 停止生成
  // 保留当前已显示的内容，将其保存为完整的消息
  stopGeneration: () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 获取当前已显示的文本（从缓冲区）
    const currentText = streamBufferRef.current;

    // 如果已经有文本内容，将其保存为完整的 AI 回复
    if (currentText && currentText.trim() !== "") {
      const { addModelMessage } = get();
      const modelMessage = { role: "model", parts: [{ text: currentText }] };
      addModelMessage(modelMessage);
    }

    // 停止平滑渲染
    stopSmoothRender();
    isStreamingRef.current = false;

    // 清空流式数据，但保留已保存的消息
    streamBufferRef.current = "";
    displayedIndexRef.current = 0;

    set({
      resultData: "", // 清空流式显示数据
      isTyping: false,
      isRetrying: false,
      retryInfo: null,
    });
  },

  // 清空聊天状态
  clearChat: () => {
    // 停止正在进行的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopSmoothRender();
    streamBufferRef.current = "";
    displayedIndexRef.current = 0;
    isStreamingRef.current = false;
    set({
      chatHistory: [],
      resultData: "",
      isTyping: false,
      isRetrying: false,
      retryInfo: null,
      showVPNWarning: false,
    });
  },

  // 重置流式渲染状态
  resetStreaming: () => {
    stopSmoothRender();
    streamBufferRef.current = "";
    displayedIndexRef.current = 0;
    isStreamingRef.current = false;
    set({
      resultData: "",
      isTyping: false,
      isRetrying: false,
      retryInfo: null,
      showVPNWarning: false,
    });
  },

  // 发送消息（核心业务逻辑）
  // 支持 AbortController 和指数退避重试
  sendMessage: async (userMessage, imageParts = [], maxRetries = 3) => {
    const {
      addUserMessage,
      addModelMessage,
      setResultData,
      setIsTyping,
      resetStreaming,
      setIsRetrying,
      setRetryInfo,
    } = get();

    // 构建用户消息部分（包含文本和图片）
    const userParts =
      imageParts.length > 0
        ? [...imageParts, { text: userMessage }]
        : [{ text: userMessage }];

    // 先将用户消息添加到 chatHistory（只在第一次添加）
    const updatedHistory = get().chatHistory;
    const isFirstAttempt =
      updatedHistory.length === 0 ||
      updatedHistory[updatedHistory.length - 1].role !== "user" ||
      updatedHistory[updatedHistory.length - 1].parts[0]?.text !== userMessage;

    if (isFirstAttempt) {
      const userMessageObj = { role: "user", parts: userParts };
      addUserMessage(userMessageObj);
    }

    // 创建 AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 清空之前的流式数据，准备新的流式响应
    resetStreaming();
    isStreamingRef.current = true;
    setIsTyping(true);
    setIsRetrying(false);
    setRetryInfo(null);
    get().setShowVPNWarning(false); // 重置 VPN 提示

    // 启动平滑渲染器
    startSmoothRender(setResultData, setIsTyping);

    // 指数退避重试逻辑
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // 检查是否被中断
      if (abortController.signal.aborted) {
        throw new Error("请求已被用户中断");
      }

      // 如果不是第一次尝试，显示重试状态
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 指数退避，最大 10 秒
        setIsRetrying(true);
        setRetryInfo({
          attempt,
          maxAttempts: maxRetries + 1,
          delay,
        });

        // 等待重试延迟
        await new Promise((resolve) => {
          const startTime = Date.now();
          const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, delay - elapsed);

            if (abortController.signal.aborted) {
              clearInterval(interval);
              resolve();
              return;
            }

            setRetryInfo({
              attempt,
              maxAttempts: maxRetries + 1,
              delay,
              remaining,
            });

            if (remaining === 0) {
              clearInterval(interval);
              resolve();
            }
          }, 100);
        });

        // 检查是否被中断
        if (abortController.signal.aborted) {
          throw new Error("请求已被用户中断");
        }
      }

      try {
        // 使用流式响应 API
        const startTime = Date.now();
        let firstChunkReceived = false; // 标记是否收到第一个数据块
        const TIMEOUT_DURATION = 15000; // 15秒超时

        console.log(
          `[流式对话] 开始接收响应 (尝试 ${attempt + 1}/${
            maxRetries + 1
          }): ${new Date().toLocaleTimeString()}`
        );

        // 设置超时检测
        const timeoutId = setTimeout(() => {
          if (!firstChunkReceived && !abortController.signal.aborted) {
            // 超过15秒还没有收到任何数据，可能是网络问题
            console.warn("[网络检测] 请求超时，可能是网络连接问题");
            get().setShowVPNWarning(true);
            // 组件会自动在3秒后隐藏提示
          }
        }, TIMEOUT_DURATION);

        // 获取更新后的聊天历史（包含刚添加的用户消息）
        const currentHistory = get().chatHistory;

        let fullResponse;
        try {
          fullResponse = await runStream(
            userMessage,
            currentHistory.slice(0, -1), // 排除刚添加的用户消息，传给 API
            (chunkText, accumulatedText) => {
              // 检查是否被中断
              if (abortController.signal.aborted) {
                // 即使被中断，也要更新缓冲区，以便保存已接收的内容
                streamBufferRef.current = accumulatedText;
                return;
              }

              // 标记已收到第一个数据块
              if (!firstChunkReceived) {
                firstChunkReceived = true;
                clearTimeout(timeoutId); // 清除超时检测
              }

              // 将新接收的文本存入缓冲区（不直接更新UI）
              streamBufferRef.current = accumulatedText;

              // 调试日志
              const elapsed = Date.now() - startTime;
              console.log(
                `[流式对话] 收到数据块 (${elapsed}ms): 已接收 ${accumulatedText.length} 个字符，缓冲区: ${accumulatedText.length} 字符`
              );
            },
            imageParts,
            abortController.signal
          );

          // 清除超时检测（如果还没清除）
          clearTimeout(timeoutId);
        } catch (error) {
          // 清除超时检测
          clearTimeout(timeoutId);

          // 如果是因为中断导致的错误，检查是否有已接收的内容
          if (
            abortController.signal.aborted ||
            error.message === "请求已被用户中断"
          ) {
            const currentText = streamBufferRef.current;
            if (currentText && currentText.trim() !== "") {
              // 有部分内容，返回这部分内容
              fullResponse = currentText;
            } else {
              // 没有内容，抛出错误
              throw error;
            }
          } else {
            // 检查是否是网络错误（可能是VPN问题）
            if (
              !firstChunkReceived &&
              (error.name === "NetworkError" ||
                error.name === "TypeError" ||
                error.message?.includes("Failed to fetch") ||
                error.message?.includes("network"))
            ) {
              // 网络错误且没有收到任何数据，可能是VPN问题
              get().setShowVPNWarning(true);
              // 组件会自动在3秒后隐藏提示
            }
            // 其他错误，直接抛出
            throw error;
          }
        }

        const totalTime = Date.now() - startTime;
        console.log(
          `[流式对话] 完成！总耗时: ${totalTime}ms，总字符数: ${fullResponse.length}`
        );

        // 流式响应完成
        isStreamingRef.current = false;
        setIsRetrying(false);
        setRetryInfo(null);
        abortControllerRef.current = null;

        // 更新对话历史：添加 AI 回复
        const modelMessage = { role: "model", parts: [{ text: fullResponse }] };
        addModelMessage(modelMessage);

        return fullResponse;
      } catch (error) {
        lastError = error;

        // 检查是否被中断
        if (
          abortController.signal.aborted ||
          error.message === "请求已被用户中断"
        ) {
          // 获取当前已显示的文本（从缓冲区）
          const currentText = streamBufferRef.current;

          // 如果已经有文本内容，将其保存为完整的 AI 回复
          if (currentText && currentText.trim() !== "") {
            const modelMessage = {
              role: "model",
              parts: [{ text: currentText }],
            };
            addModelMessage(modelMessage);
          }

          isStreamingRef.current = false;
          setIsTyping(false);
          setIsRetrying(false);
          setRetryInfo(null);
          stopSmoothRender();
          streamBufferRef.current = "";
          displayedIndexRef.current = 0;
          abortControllerRef.current = null;

          // 不抛出错误，而是静默停止（因为已经保存了部分内容）
          return currentText || "";
        }

        // 判断是否可重试
        const isRetryable = isRetryableError(error);
        if (!isRetryable || attempt === maxRetries) {
          // 不可重试或已达到最大重试次数
          isStreamingRef.current = false;
          setIsTyping(false);
          setIsRetrying(false);
          setRetryInfo(null);
          abortControllerRef.current = null;
          throw error;
        }

        // 可以重试，继续循环
        console.warn(
          `[流式对话] 请求失败，将在 ${Math.min(
            1000 * Math.pow(2, attempt),
            10000
          )}ms 后重试 (${attempt + 1}/${maxRetries})`,
          error
        );
      }
    }

    // 所有重试都失败了
    isStreamingRef.current = false;
    setIsTyping(false);
    setIsRetrying(false);
    setRetryInfo(null);
    abortControllerRef.current = null;
    throw lastError;
  },

  // 加载会话的聊天历史
  loadChatHistory: (history) => {
    // 停止正在进行的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopSmoothRender();
    streamBufferRef.current = "";
    displayedIndexRef.current = 0;
    isStreamingRef.current = false;
    set({
      chatHistory: history,
      resultData: "",
      isTyping: false,
      isRetrying: false,
      retryInfo: null,
      showVPNWarning: false,
    });
  },
}));

/**
 * 判断错误是否可重试
 * 网络错误、超时错误等可以重试
 * API Key 错误、权限错误等不可重试
 */
function isRetryableError(error) {
  // 用户中断的错误不可重试
  if (error.message === "请求已被用户中断") {
    return false;
  }

  // 网络错误可以重试
  if (error.name === "NetworkError" || error.name === "TypeError") {
    return true;
  }

  // 超时错误可以重试
  if (error.message?.includes("timeout") || error.message?.includes("网络")) {
    return true;
  }

  // API 错误：429 (Too Many Requests) 可以重试
  if (error.status === 429 || error.message?.includes("429")) {
    return true;
  }

  // API 错误：500+ 服务器错误可以重试
  if (error.status >= 500) {
    return true;
  }

  // API Key 错误、权限错误等不可重试
  if (
    error.message?.includes("API") ||
    error.message?.includes("密钥") ||
    error.message?.includes("权限") ||
    error.status === 401 ||
    error.status === 403
  ) {
    return false;
  }

  // 默认：其他错误可以重试
  return true;
}
