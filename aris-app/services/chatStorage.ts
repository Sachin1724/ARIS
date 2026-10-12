import AsyncStorage from "@react-native-async-storage/async-storage";

export interface BreakdownItem {
  icon: any;
  iconBg: string;
  iconColor: string;
  title: string;
  detail: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  time?: string;
  duration?: string;
  breakdown?: BreakdownItem[];
  breakdownExpanded?: boolean;
}

const CHAT_STORAGE_KEY = "@aris_chat_history_v1";

// In-memory cache fallback in case native storage is not linked or unavailable
let memoryHistory: ChatMessage[] = [];

export const chatStorage = {
  /**
   * Loads saved chat messages from local persistent storage.
   */
  async loadChatHistory(): Promise<ChatMessage[]> {
    try {
      if (AsyncStorage) {
        const raw = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter(
              (m) => m && typeof m.text === "string" && m.text.trim().length > 0
            );
            memoryHistory = valid;
            return valid;
          }
        }
      }
    } catch (err) {
      console.warn("[chatStorage] Failed to load chat history from AsyncStorage:", err);
    }
    return memoryHistory;
  },

  /**
   * Persists chat messages to local storage.
   */
  async saveChatHistory(messages: ChatMessage[]): Promise<void> {
    memoryHistory = messages;
    try {
      if (AsyncStorage) {
        // Keep the last 100 messages to prevent excessive storage usage
        const toSave = messages.slice(-100);
        await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
      }
    } catch (err) {
      console.warn("[chatStorage] Failed to save chat history to AsyncStorage:", err);
    }
  },

  /**
   * Clears saved chat messages from local storage.
   */
  async clearChatHistory(): Promise<void> {
    memoryHistory = [];
    try {
      if (AsyncStorage) {
        await AsyncStorage.removeItem(CHAT_STORAGE_KEY);
      }
    } catch (err) {
      console.warn("[chatStorage] Failed to clear chat history from AsyncStorage:", err);
    }
  },
};
