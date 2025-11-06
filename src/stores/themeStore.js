import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 主题 Store
 * 管理应用主题（浅色/深色）
 * 支持系统主题偏好（prefers-color-scheme）
 */
export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: "light", // 'light' | 'dark' | 'system'

      // 设置主题
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      // 切换主题
      toggleTheme: () => {
        const currentTheme = get().theme;
        const newTheme = currentTheme === "light" ? "dark" : "light";
        get().setTheme(newTheme);
      },

      // 初始化主题（从系统偏好或本地存储）
      initTheme: () => {
        const storedTheme = get().theme;
        if (storedTheme === "system") {
          const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
            .matches
            ? "dark"
            : "light";
          applyTheme(systemTheme);
        } else {
          applyTheme(storedTheme);
        }
      },
    }),
    {
      name: "gemini-chat-theme",
      partialize: (state) => ({
        theme: state.theme,
      }),
    }
  )
);

/**
 * 应用主题到 DOM
 */
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    root.setAttribute("data-theme", systemTheme);
  } else {
    root.setAttribute("data-theme", theme);
  }
}

// 监听系统主题变化
if (typeof window !== "undefined") {
  // 初始化主题
  const initTheme = () => {
    const themeStore = useThemeStore.getState();
    themeStore.initTheme();
  };

  // 页面加载时初始化
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
  } else {
    initTheme();
  }

  // 监听系统主题变化
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      const themeStore = useThemeStore.getState();
      if (themeStore.theme === "system") {
        applyTheme(e.matches ? "dark" : "light");
      }
    });
}
