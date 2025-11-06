import React, { useState, useContext, useRef, useEffect } from "react";
import "./Sidebar.css";
import "../../assets/assets";
import { assets } from "../../assets/assets";
import { Context } from "../../context/Context";

const Sidebar = () => {
  const [extended, setExtended] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [toastKey, setToastKey] = useState(0); // 用于强制重新渲染动画
  const timeoutIdRef = useRef(null);

  // 处理开发中提示
  const handleComingSoon = () => {
    // 如果已经有提示在显示，清除之前的定时器
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    // 先隐藏，更新 key 来强制重新渲染，然后立即显示
    setShowComingSoon(false);

    // 使用 requestAnimationFrame 确保 DOM 更新后再显示，重新触发动画
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setToastKey((prev) => prev + 1);
        setShowComingSoon(true);

        // 设置新的定时器
        timeoutIdRef.current = setTimeout(() => {
          setShowComingSoon(false);
          timeoutIdRef.current = null;
        }, 3000);
      });
    });
  };

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, []);
  const {
    chatSessions,
    currentSessionId,
    newChat,
    openSession,
    deleteSession,
  } = useContext(Context);

  // 格式化日期显示
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  // 处理会话点击
  const handleSessionClick = (sessionId) => {
    openSession(sessionId);
  };

  // 处理删除会话
  const handleDeleteSession = (e, sessionId) => {
    e.stopPropagation(); // 阻止事件冒泡
    if (window.confirm("确定要删除这个会话吗？")) {
      deleteSession(sessionId);
    }
  };

  return (
    <div className="sidebar">
      <div className="top">
        <img
          onClick={() => setExtended((prew) => !prew)}
          className="menu"
          src={assets.menu_icon}
          alt=""
        />
        <div onClick={() => newChat()} className="new-chat">
          <img src={assets.plus_icon} alt="" />
          {extended ? <p>New chat</p> : null}
        </div>
        {extended ? (
          <div className="recent">
            <p className="recent-title">聊天记录</p>
            {chatSessions.length === 0 ? (
              <p style={{ padding: "20px", color: "#666", fontSize: "14px" }}>
                暂无聊天记录
              </p>
            ) : (
              chatSessions.map((session) => {
                const isActive = session.id === currentSessionId;
                return (
                  <div
                    key={session.id}
                    onClick={() => handleSessionClick(session.id)}
                    className={`recent-entry ${isActive ? "active" : ""}`}
                    style={{
                      position: "relative",
                    }}
                  >
                    <img src={assets.message_icon} alt="" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {session.title.length > 20
                          ? session.title.slice(0, 20) + "..."
                          : session.title}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "12px",
                          color: "#999",
                          marginTop: "4px",
                        }}
                      >
                        {formatDate(session.updatedAt)}
                      </p>
                    </div>
                    {extended && (
                      <button
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "4px 8px",
                          fontSize: "12px",
                          color: "#999",
                          marginLeft: "8px",
                        }}
                        onMouseEnter={(e) => (e.target.style.color = "#ff4444")}
                        onMouseLeave={(e) => (e.target.style.color = "#999")}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>
      <div className="bottom">
        <div className="bottom-item recent-entry" onClick={handleComingSoon}>
          <img src={assets.question_icon} alt="" />
          {extended ? <p>Help</p> : null}
        </div>
        <div className="bottom-item recent-entry" onClick={handleComingSoon}>
          <img src={assets.history_icon} alt="" />
          {extended ? <p>Activity</p> : null}
        </div>
        <div className="bottom-item recent-entry" onClick={handleComingSoon}>
          <img src={assets.setting_icon} alt="" />
          {extended ? <p>Setting</p> : null}
        </div>
      </div>
      {/* 开发中提示 */}
      {showComingSoon && (
        <div key={toastKey} className="coming-soon-toast">
          <div className="coming-soon-content">
            <span className="coming-soon-icon">🚧</span>
            <span className="coming-soon-text">开发中，敬请期待</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
