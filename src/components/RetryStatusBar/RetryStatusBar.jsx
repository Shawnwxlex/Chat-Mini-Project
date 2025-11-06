import React from "react";
import { useChatStore } from "../../stores/chatStore";
import "./RetryStatusBar.css";

/**
 * 重试状态条组件
 * 显示重试进度和倒计时
 */
const RetryStatusBar = () => {
  const { isRetrying, retryInfo } = useChatStore();

  if (!isRetrying || !retryInfo) {
    return null;
  }

  const { attempt, maxAttempts, remaining } = retryInfo;
  const remainingSeconds = remaining ? Math.ceil(remaining / 1000) : 0;

  return (
    <div className="retry-status-bar">
      <div className="retry-status-content">
        <span className="retry-icon">🔄</span>
        <span className="retry-text">
          网络请求失败，正在重试 ({attempt}/{maxAttempts})
          {remaining > 0 && ` - ${remainingSeconds} 秒后重试`}
        </span>
      </div>
      {remaining > 0 && (
        <div className="retry-progress">
          <div
            className="retry-progress-bar"
            style={{
              width: `${
                ((retryInfo.delay - remaining) / retryInfo.delay) * 100
              }%`,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default RetryStatusBar;
