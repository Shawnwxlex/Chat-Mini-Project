import React, { useContext, useState } from "react";
import "./Main.css";
import "../../assets/assets";
import { assets } from "../../assets/assets";
import { Context } from "../../context/Context";
import VirtualizedMessageList from "../VirtualizedMessageList/VirtualizedMessageList";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import RetryStatusBar from "../RetryStatusBar/RetryStatusBar";
import VPNWarning from "../VPNWarning/VPNWarning";

const Main = () => {
  const {
    onSent,
    loading,
    showResult,
    input,
    setInput,
    chatHistory,
    resultData,
    isTyping: isTypingState,
    error,
    setError,
    uploadedImages,
    handleImageUpload,
    removeImage,
    fileInputRef,
    stopGeneration,
    isRetrying,
    setLoading,
  } = useContext(Context);

  // 图片放大查看
  const [enlargedImage, setEnlargedImage] = useState(null);

  return (
    <div className="main">
      {/* VPN 提示 */}
      <VPNWarning />
      {/* 重试状态条 */}
      <RetryStatusBar />
      <div className="nav">
        <p>CHAT MINI</p>
        <div className="nav-right">
          <ThemeToggle />
          <img src={assets.user_icon2} alt="" />
        </div>
      </div>
      <div className="main-container">
        {!showResult && chatHistory.length === 0 ? (
          <>
            <div className="greet">
              <p>
                <span>Hello, Dev.</span>
              </p>
              <p>How can I help you today?</p>
            </div>
            <div className="cards">
              <div className="card">
                <p>Suggest beautiful places to see on an upcoming road trip</p>
                <img src={assets.compass_icon} alt="" />
              </div>
              <div className="card">
                <p>Briefly summarize this concept: urban planning</p>
                <img src={assets.bulb_icon} alt="" />
              </div>
              <div className="card">
                <p>Brainstorm team bonding activities for our work retreat</p>
                <img src={assets.message_icon} alt="" />
              </div>
              <div className="card">
                <p>Tell me about React js and React native</p>
                <img src={assets.code_icon} alt="" />
              </div>
            </div>
          </>
        ) : (
          <div className="chat-history">
            {/* 使用虚拟滚动消息列表 */}
            <VirtualizedMessageList
              chatHistory={chatHistory}
              resultData={resultData}
              isTypingState={isTypingState}
              loading={loading}
              onImageClick={setEnlargedImage}
            />
          </div>
        )}
        {/* 错误提示 */}
        {error && (
          <div className="error-toast">
            <div className="error-toast-content">
              <span className="error-icon">⚠️</span>
              <span className="error-text">{error}</span>
              <button
                className="error-close"
                onClick={() => setError(null)}
                aria-label="关闭错误提示"
              >
                ×
              </button>
            </div>
          </div>
        )}
        <div className="main-bottom">
          <div className="search-box">
            <textarea
              onChange={(e) => {
                setInput(e.target.value);
              }}
              onKeyDown={(e) => {
                // Shift + 回车键：换行
                if (e.key === "Enter" && e.shiftKey) {
                  // 允许默认行为（换行）
                  return;
                }
                // 回车键发送消息（且输入框不为空）
                if (e.key === "Enter" && input.trim() !== "" && !loading) {
                  e.preventDefault(); // 阻止默认行为（防止换行）
                  onSent();
                }
              }}
              value={input}
              placeholder="Enter a prompt here (Shift+Enter to new line)"
              rows={1}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: "inherit",
                fontFamily: "inherit",
                minHeight: "20px",
                maxHeight: "100px",
                overflowY: "auto",
                backgroundColor: "var(--bg-input)",
                color: "var(--text-primary)",
              }}
              className="chat-textarea"
            />
            <div>
              {/* 隐藏的文件输入框 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files) {
                    handleImageUpload(e.target.files);
                    e.target.value = ""; // 清空，允许重复选择同一文件
                  }
                }}
              />
              <img
                src={assets.gallery_icon}
                alt="上传图片"
                onClick={() => fileInputRef.current?.click()}
                style={{ cursor: "pointer" }}
                title="上传图片"
              />
              {/* 语音输入功能暂未实现，暂时隐藏 */}
              {/* <img src={assets.mic_icon} alt="" /> */}
              {isTypingState || isRetrying || loading ? (
                <button
                  onClick={() => {
                    stopGeneration();
                    // 立即停止加载状态
                    setLoading(false);
                  }}
                  className="stop-button"
                  title="停止生成"
                  aria-label="停止生成"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <img
                  onClick={() => onSent()}
                  src={assets.send_icon}
                  alt="发送"
                  style={{ cursor: "pointer" }}
                />
              )}
            </div>
          </div>
          {/* 图片预览 */}
          {uploadedImages.length > 0 && (
            <div className="image-preview-container">
              {uploadedImages.map((image) => (
                <div key={image.id} className="image-preview-item">
                  <img
                    src={image.preview}
                    alt="预览"
                    className="image-preview"
                  />
                  <button
                    className="image-remove-btn"
                    onClick={() => removeImage(image.id)}
                    aria-label="删除图片"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="bottom-info">AI may display inaccurate information.</p>
        </div>
      </div>
      {/* 图片放大查看模态框 */}
      {enlargedImage && (
        <div className="image-modal" onClick={() => setEnlargedImage(null)}>
          <div
            className="image-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="image-modal-close"
              onClick={() => setEnlargedImage(null)}
              aria-label="关闭"
            >
              ×
            </button>
            <img
              src={enlargedImage}
              alt="放大查看"
              className="enlarged-image"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Main;
