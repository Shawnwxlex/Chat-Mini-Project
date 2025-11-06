import React from "react";
import "./ErrorBoundary.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // 你同样可以将错误日志上报给服务器
    console.error("ErrorBoundary 捕获到错误:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // 可以在这里添加重置逻辑，比如刷新页面
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // 你可以自定义降级后的 UI 并渲染
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>😔 出错了</h2>
            <p className="error-message">
              {this.state.error && this.state.error.toString()}
            </p>
            <p className="error-hint">
              应用遇到了一个错误。请尝试刷新页面或联系开发者。
            </p>
            <div className="error-actions">
              <button onClick={this.handleReset} className="retry-button">
                刷新页面
              </button>
              <button
                onClick={() => {
                  this.setState({
                    hasError: false,
                    error: null,
                    errorInfo: null,
                  });
                }}
                className="dismiss-button"
              >
                关闭
              </button>
            </div>
            {process.env.NODE_ENV === "development" && this.state.errorInfo && (
              <details className="error-details">
                <summary>错误详情（开发模式）</summary>
                <pre>{this.state.errorInfo.componentStack}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
