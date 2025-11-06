import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import "./MarkdownRenderer.css";

/**
 * Markdown 渲染组件
 * 支持代码高亮、表格、列表等 GFM 特性
 * 流式渲染时使用容错模式
 */
const MarkdownRenderer = memo(({ content, isStreaming = false }) => {
  // 如果内容为空，返回空
  if (!content || content.trim() === "") {
    return null;
  }

  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 代码块高亮
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            const codeString = String(children).replace(/\n$/, "");

            return !inline && match ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div"
                className="code-block"
                {...props}
              >
                {codeString}
              </SyntaxHighlighter>
            ) : (
              <code className="inline-code" {...props}>
                {children}
              </code>
            );
          },
          // 段落
          p({ children }) {
            return <p className="markdown-paragraph">{children}</p>;
          },
          // 列表
          ul({ children }) {
            return <ul className="markdown-list">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="markdown-list">{children}</ol>;
          },
          li({ children }) {
            return <li className="markdown-list-item">{children}</li>;
          },
          // 标题
          h1({ children }) {
            return <h1 className="markdown-heading markdown-h1">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="markdown-heading markdown-h2">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="markdown-heading markdown-h3">{children}</h3>;
          },
          // 链接
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="markdown-link"
              >
                {children}
              </a>
            );
          },
          // 引用
          blockquote({ children }) {
            return (
              <blockquote className="markdown-blockquote">
                {children}
              </blockquote>
            );
          },
          // 表格
          table({ children }) {
            return (
              <div className="markdown-table-wrapper">
                <table className="markdown-table">{children}</table>
              </div>
            );
          },
          // 粗体
          strong({ children }) {
            return <strong className="markdown-strong">{children}</strong>;
          },
          // 斜体
          em({ children }) {
            return <em className="markdown-em">{children}</em>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
