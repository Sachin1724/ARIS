import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useRef, useCallback } from "react";
import Mascot from "../../components/Mascot";
import Card from "../../components/Card";
import DemoLabel from "../../components/DemoLabel";
import { colors } from "../../constants/tokens";
import { apiClient, ApiClientError } from "../../services/api-client";
import { mockAssistantResponse } from "../../services/mock-data";

interface Message {
  role: "user" | "assistant";
  text: string;
  evidence?: { label: string; value: string; unit: string }[];
  caveats?: string[];
}

export default function AskArisScreen() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const isDemo = !apiClient.isConfigured;
  const scrollRef = useRef<ScrollView>(null);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "user", text: question }]);

    try {
      const response = isDemo
        ? mockAssistantResponse(question)
        : await apiClient.askAssistant({ text: question });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: response.answer,
          evidence: response.evidence,
          caveats: response.caveats,
        },
      ]);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to get answer";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Could not get an answer: ${message}` },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, loading, isDemo]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4"
          contentContainerClassName="py-4 gap-3"
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && (
            <View className="items-center py-8">
              <Mascot state="idle" size="large" />
              <Text
                className="text-ink text-lg mt-4 text-center"
                style={{ fontFamily: "Poppins_600SemiBold" }}
              >
                Ask about your air quality
              </Text>
              <Text
                className="text-secondary-text text-sm text-center mt-1 px-8"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                Questions are answered by your UNO Q device using measured
                data and deterministic rules.
              </Text>
              {isDemo && (
                <View className="mt-3">
                  <DemoLabel />
                </View>
              )}
            </View>
          )}

          {messages.map((msg, i) => (
            <Card
              key={i}
              className={msg.role === "user" ? "bg-surface-lavender ml-8" : "mr-8"}
            >
              <Text
                className="text-ink text-sm"
                style={{ fontFamily: "Inter_400Regular" }}
              >
                {msg.text}
              </Text>
              {msg.evidence && msg.evidence.length > 0 && (
                <View className="mt-2 pt-2 border-t border-border gap-1">
                  {msg.evidence.map((e, j) => (
                    <Text
                      key={j}
                      className="text-secondary-text text-xs"
                      style={{ fontFamily: "Inter_400Regular" }}
                    >
                      {e.label}: {e.value} {e.unit}
                    </Text>
                  ))}
                </View>
              )}
              {msg.caveats && msg.caveats.length > 0 && (
                <View className="mt-2 pt-2 border-t border-border">
                  {msg.caveats.map((c, j) => (
                    <Text
                      key={j}
                      className="text-caution text-xs"
                      style={{ fontFamily: "Inter_400Regular" }}
                    >
                      {c}
                    </Text>
                  ))}
                </View>
              )}
            </Card>
          ))}

          {loading && (
            <View className="mr-8">
              <Card>
                <View className="flex-row items-center gap-2">
                  <Mascot state="thinking" size="small" />
                  <Text
                    className="text-secondary-text text-sm"
                    style={{ fontFamily: "Inter_400Regular" }}
                  >
                    Thinking...
                  </Text>
                </View>
              </Card>
            </View>
          )}
        </ScrollView>

        <View className="px-4 py-3 bg-surface border-t border-border flex-row gap-2">
          <TextInput
            className="flex-1 bg-background border border-border rounded-md px-3 py-2.5 text-ink text-sm"
            style={{ fontFamily: "Inter_400Regular" }}
            placeholder="Ask a question..."
            placeholderTextColor={colors.secondaryText}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!loading}
            accessibilityLabel="Type your question"
          />
          <Pressable
            onPress={handleSend}
            disabled={loading || !input.trim()}
            className={`rounded-md px-4 items-center justify-center ${
              loading || !input.trim() ? "bg-border" : "bg-lavender active:bg-lavender-dark"
            }`}
            accessibilityRole="button"
            accessibilityLabel="Send question"
          >
            <Text
              className="text-white text-sm"
              style={{ fontFamily: "Inter_600SemiBold" }}
            >
              Send
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
