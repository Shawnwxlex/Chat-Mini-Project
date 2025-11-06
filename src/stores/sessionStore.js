import { create } from "zustand";
import { persist } from "zustand/middleware";

// 会话状态 Store（带持久化）
export const useSessionStore = create(
  persist(
    (set, get) => ({
      // 状态
      chatSessions: [],
      currentSessionId: null,

      // Actions
      // 设置会话列表
      setChatSessions: (sessions) => set({ chatSessions: sessions }),

      // 设置当前会话 ID
      setCurrentSessionId: (id) => set({ currentSessionId: id }),

      // 创建新会话
      createSession: (sessionData) => {
        const { chatSessions } = get();
        const newSessions = [sessionData, ...chatSessions];
        set({
          chatSessions: newSessions,
          currentSessionId: sessionData.id,
        });
        return newSessions;
      },

      // 更新会话
      updateSession: (sessionId, sessionData) => {
        const { chatSessions } = get();
        const index = chatSessions.findIndex((s) => s.id === sessionId);
        if (index !== -1) {
          const updatedSessions = [...chatSessions];
          updatedSessions[index] = {
            ...updatedSessions[index],
            ...sessionData,
            updatedAt: Date.now(),
          };
          set({ chatSessions: updatedSessions });
          return updatedSessions;
        }
        return chatSessions;
      },

      // 保存或更新会话
      saveSession: (sessionData) => {
        const { currentSessionId, chatSessions } = get();
        const sessions = [...chatSessions];

        if (currentSessionId) {
          // 更新现有会话
          const index = sessions.findIndex((s) => s.id === currentSessionId);
          if (index !== -1) {
            sessions[index] = {
              ...sessions[index],
              ...sessionData,
              updatedAt: Date.now(),
            };
          } else {
            sessions.unshift(sessionData);
            set({ currentSessionId: sessionData.id });
          }
        } else {
          // 创建新会话
          sessions.unshift(sessionData);
          set({ currentSessionId: sessionData.id });
        }

        set({ chatSessions: sessions });
        return sessions;
      },

      // 删除会话
      deleteSession: (sessionId) => {
        const { chatSessions, currentSessionId } = get();
        const filteredSessions = chatSessions.filter((s) => s.id !== sessionId);
        set({ chatSessions: filteredSessions });

        // 如果删除的是当前会话，清空当前会话 ID
        if (currentSessionId === sessionId) {
          set({ currentSessionId: null });
        }

        return filteredSessions;
      },

      // 获取会话
      getSession: (sessionId) => {
        const { chatSessions } = get();
        return chatSessions.find((s) => s.id === sessionId);
      },

      // 清空当前会话
      clearCurrentSession: () => {
        set({ currentSessionId: null });
      },
    }),
    {
      name: "gemini-chat-sessions", // localStorage key
      // 只持久化 chatSessions 和 currentSessionId
      partialize: (state) => ({
        chatSessions: state.chatSessions,
        currentSessionId: state.currentSessionId,
      }),
    }
  )
);
