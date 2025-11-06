import React, { useEffect } from "react";
import { useChatStore } from "../../stores/chatStore";
import "./VPNWarning.css";

const VPNWarning = () => {
  const showVPNWarning = useChatStore((state) => state.showVPNWarning);
  const setShowVPNWarning = useChatStore((state) => state.setShowVPNWarning);

  useEffect(() => {
    if (showVPNWarning) {
      // 10秒后自动隐藏
      const timer = setTimeout(() => {
        setShowVPNWarning(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [showVPNWarning, setShowVPNWarning]);

  const handleClose = () => {
    setShowVPNWarning(false);
  };

  if (!showVPNWarning) return null;

  return (
    <div className="vpn-warning">
      <div className="vpn-warning-content">
        <span className="vpn-warning-icon">⚠️</span>
        <span className="vpn-warning-text">
          中国大陆地区用户请连接 VPN 后重试
        </span>
        <button
          className="vpn-warning-close"
          onClick={handleClose}
          aria-label="关闭提示"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default VPNWarning;
