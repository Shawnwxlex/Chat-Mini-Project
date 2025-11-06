import React from "react";

/**
 * 错误测试组件
 * 用于测试错误边界是否正常工作
 *
 * 使用方法：
 * 1. 在 App.jsx 中临时导入并使用此组件
 * 2. 替换掉 Main 和 Sidebar 组件
 * 3. 观察错误边界是否捕获错误并显示降级 UI
 */
const ErrorTest = () => {
  // 故意抛出一个错误来测试错误边界
  throw new Error(
    "这是一个测试错误！\n" +
      "如果你看到这个错误信息，说明错误边界正常捕获了错误。\n" +
      "请检查控制台是否有 'ErrorBoundary 捕获到错误' 的日志。"
  );
};

export default ErrorTest;
