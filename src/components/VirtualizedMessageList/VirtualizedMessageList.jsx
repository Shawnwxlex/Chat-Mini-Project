import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { List, useDynamicRowHeight, useListRef } from "react-window";
import { assets } from "../../assets/assets";
import MarkdownRenderer from "../MarkdownRenderer/MarkdownRenderer";
import "./VirtualizedMessageList.css";

/**
 * 虚拟滚动消息列表组件
 * 使用 react-window 的 List 组件实现虚拟滚动
 */
const VirtualizedMessageList = ({
  chatHistory,
  resultData,
  isTypingState,
  loading,
  onImageClick,
}) => {
  const listRef = useListRef();
  const [itemHeights, setItemHeights] = useState(new Map());
  const [estimatedItemSize] = useState(150); // 估算的初始高度
  const lastScrollTimeRef = useRef(0); // 上次滚动时间（用于节流）

  // 使用 useDynamicRowHeight hook 管理动态高度
  const dynamicRowHeight = useDynamicRowHeight({
    defaultRowHeight: estimatedItemSize,
  });

  // 准备消息列表数据（包括流式消息和加载状态）
  const messages = useMemo(() => {
    const msgs = [...chatHistory];

    // 如果正在流式接收，添加流式消息
    if (isTypingState && resultData && resultData.trim() !== "") {
      msgs.push({
        role: "model",
        parts: [{ text: resultData }],
        isStreaming: true,
      });
    }

    // 如果正在加载但还没有数据，添加加载消息
    if (
      loading &&
      (!isTypingState || !resultData || resultData.trim() === "") &&
      chatHistory.length > 0 &&
      chatHistory[chatHistory.length - 1].role === "user"
    ) {
      msgs.push({
        role: "model",
        parts: [{ text: "" }],
        isLoading: true,
      });
    }

    return msgs;
  }, [chatHistory, resultData, isTypingState, loading]);

  // 估算消息高度
  const estimateItemSize = useCallback(
    (index) => {
      // 如果已经测量过，使用实际高度
      if (itemHeights.has(index)) {
        return itemHeights.get(index);
      }

      const message = messages[index];
      if (!message) return estimatedItemSize;

      let estimatedHeight = 80; // 基础高度（头像 + padding）

      // 用户消息
      if (message.role === "user") {
        const imageParts =
          message.parts?.filter((part) => part.inlineData) || [];
        const textParts = message.parts?.filter((part) => part.text) || [];

        // 图片高度（每张图片约 200px）
        estimatedHeight += imageParts.length * 200;

        // 文本高度（每行约 25px，每 50 个字符一行）
        if (textParts.length > 0) {
          const text = textParts[0].text || "";
          const lines = Math.ceil(text.length / 50);
          estimatedHeight += lines * 25;
        }
      } else {
        // AI 消息
        const text = message.parts?.[0]?.text || "";
        const lines = Math.ceil(text.length / 50);
        estimatedHeight += lines * 25;

        // 如果是加载状态，增加高度
        if (message.isLoading) {
          estimatedHeight += 60;
        }
      }

      return Math.max(estimatedHeight, 100); // 最小高度 100px
    },
    [messages, itemHeights, estimatedItemSize]
  );

  // 更新项目高度
  const updateItemSize = useCallback(
    (index, height) => {
      setItemHeights((prev) => {
        const newMap = new Map(prev);
        newMap.set(index, height);
        return newMap;
      });

      // 使用 dynamicRowHeight 更新高度
      dynamicRowHeight.setRowHeight(index, height);
    },
    [dynamicRowHeight]
  );

  // 渲染单个消息项（独立组件，可以使用 Hooks）
  // 注意：MessageItem 通过闭包访问外部变量（messages, resultData, isTypingState, formatMessage, onImageClick）
  const MessageItem = ({ index, style }) => {
    const itemRef = useRef(null);

    // 确保索引有效
    const isValidIndex = index >= 0 && index < messages.length;
    const message = isValidIndex ? messages[index] : null;

    // 测量实际高度
    useEffect(() => {
      if (!isValidIndex || !message) return;

      const currentRef = itemRef.current;
      if (!currentRef) return;

      // 使用 ResizeObserver 监听高度变化
      const resizeObserver = new ResizeObserver(() => {
        if (currentRef && index >= 0 && index < messages.length) {
          const height = currentRef.offsetHeight;
          const estimated = estimateItemSize(index);
          // 如果实际高度与估算高度差异较大，更新
          if (Math.abs(height - estimated) > 20) {
            updateItemSize(index, height);
          }
        }
      });

      resizeObserver.observe(currentRef);

      return () => {
        resizeObserver.disconnect();
      };
    }, [index, message, isValidIndex]);

    // 如果索引无效或消息不存在，返回 null
    if (!isValidIndex || !message) {
      return null;
    }

    const isLastMessage = index === messages.length - 1;
    const isTyping =
      isLastMessage &&
      message.role === "model" &&
      isTypingState &&
      resultData &&
      resultData.trim() !== "" &&
      message.isStreaming;

    if (message.role === "user") {
      const imageParts = message.parts?.filter((part) => part.inlineData) || [];
      const textParts = message.parts?.filter((part) => part.text) || [];

      return (
        <div ref={itemRef} style={style} className="virtual-message-item">
          <div className="result">
            <div className="result-title">
              <img src={assets.user_icon2} alt="" />
              <div style={{ flex: 1 }}>
                {imageParts.length > 0 && (
                  <div className="message-images">
                    {imageParts.map((part, imgIndex) => (
                      <img
                        key={imgIndex}
                        src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}
                        alt="上传的图片"
                        className="uploaded-image-preview clickable-image"
                        onClick={() =>
                          onImageClick(
                            `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                          )
                        }
                        title="点击放大查看"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}
                {textParts.length > 0 && <p>{textParts[0].text}</p>}
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div ref={itemRef} style={style} className="virtual-message-item">
          <div className="result">
            <div className="result-data">
              <img src={assets.gemini_icon} alt="" />
              {message.isLoading ? (
                <div className="loader">
                  <hr />
                  <hr />
                  <hr />
                </div>
              ) : isTyping ? (
                <MarkdownRenderer content={resultData} isStreaming={true} />
              ) : (
                <MarkdownRenderer
                  content={message.parts?.[0]?.text || ""}
                  isStreaming={false}
                />
              )}
            </div>
          </div>
        </div>
      );
    }
  };

  // 滚动到底部的函数
  const scrollToBottom = useCallback(() => {
    if (!listRef.current || messages.length === 0) return;

    const lastIndex = messages.length - 1;
    const currentRef = listRef.current;

    // 确保索引有效且 ref 存在
    if (lastIndex >= 0 && lastIndex < messages.length && currentRef) {
      try {
        currentRef.scrollToRow({
          index: lastIndex,
          align: "end",
        });
      } catch (error) {
        // 如果索引无效，忽略错误（可能是异步更新导致）
        console.warn(
          `[虚拟滚动] 滚动失败，索引可能无效: ${lastIndex}, 消息总数: ${messages.length}`,
          error
        );
      }
    }
  }, [listRef, messages]);

  // 滚动到底部（当新消息到达时）
  useEffect(() => {
    if (!listRef.current || messages.length === 0) return;

    // 使用 requestAnimationFrame 确保在渲染后滚动
    // 单次 requestAnimationFrame 即可，减少延迟
    const rafId = requestAnimationFrame(() => {
      scrollToBottom();
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [messages.length, isTypingState, scrollToBottom, listRef]);

  // 流式生成时，定期滚动到底部（更频繁的滚动）
  useEffect(() => {
    if (!isTypingState || !resultData || resultData.trim() === "") return;
    if (!listRef.current || messages.length === 0) return;

    // 减少节流时间：每 50ms 最多滚动一次（更流畅）
    const now = Date.now();
    if (now - lastScrollTimeRef.current < 50) {
      return;
    }
    lastScrollTimeRef.current = now;

    // 使用 requestAnimationFrame 确保在渲染后滚动
    // 单次 requestAnimationFrame 即可，减少延迟
    const rafId = requestAnimationFrame(() => {
      scrollToBottom();
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [resultData, isTypingState, scrollToBottom, messages.length, listRef]);

  // 计算列表高度（视口高度减去导航和输入框）
  const listHeight = useMemo(() => {
    return Math.max(window.innerHeight - 200, 400); // 最小高度 400px
  }, []);

  // 如果没有消息，不渲染虚拟列表
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="virtualized-message-list">
      <List
        listRef={listRef}
        height={listHeight}
        rowCount={messages.length}
        rowHeight={dynamicRowHeight}
        rowComponent={MessageItem}
        rowProps={{}}
        overscanCount={3} // 预渲染 3 个项目（减少初始渲染）
        style={{ width: "100%" }}
      />
    </div>
  );
};

export default VirtualizedMessageList;
