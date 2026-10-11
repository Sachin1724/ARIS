import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useRef, useCallback } from "react";
import Mascot from "../../components/Mascot";
import Card from "../../components/Card";
import DemoLabel from "../../components/DemoLabel";
import { colors } from "../../constants/tokens";
import { apiClient, ApiClientError } from "../../services/api-client";
import { mockAssistantResponse } from "../../services/mock-data";

interface Evidence {
  label: string;
  value: string;
  unit: string;
  timestamp?: string;
}

interface Message {
  role: "user" | "assistant";
  text: string;
  evidence?: Evidence[];
  reasoning?: string;
  caveats?: string[];
}

function ReasoningSection({ reasoning }: { reasoning: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="mt-2 pt-2 border-t border-border">
      <Pressable
        onPress={() => setExpanded(!expanded)}
        className="flex-row items-center gap-1 active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel={expanded ? "Hide reasoning" : "Show reasoning"}
      >
        <Text
          className="text-lavender text-xs"
          style={{ fontFamily: "Inter_500Medium" }}
        >
          {expanded ? "Hide reasoning" : "Why I say this"}
        </Text>
      </Pressable>
      {expanded && (
        <Text
          className="text-secondary-text text-xs mt-1 leading-4"
          style={{ fontFamily: "Inter_400Regular" }}
        >
          {reasoning}
        </Text>
      )}
    </View>
  );
}

function EvidenceRow({ item }: { item: Evidence }) {
  const timeLabel = item.timestamp
    ? ` (${new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
    : "";

  return (
    <Text
      className="text-secondary-text text-xs"
      style={{ fontFamily: "Inter_400Regular" }}
    >
      {item.label}: {item.value} {item.unit}{timeLabel}
    </Text>
  );
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
          reasoning: response.reasoning,
          caveats: response.caveats,
        },
      ]);
    } catch (err) {
      let text = "Could not get an answer.";
      if (err instanceof ApiClientError) {
        if (err.isTimeout) text = "Request timed out. Check device connection.";
        else if (err.isNotFound) text = "Assistant not available on this device.";
        else text = `Could not get an answer: ${err.message}`;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text },
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
                    <EvidenceRow key={j} item={e} />
                  ))}
                </View>
              )}

              {msg.reasoning && <ReasoningSection reasoning={msg.reasoning} />}

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
