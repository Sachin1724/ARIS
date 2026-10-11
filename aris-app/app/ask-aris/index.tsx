import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import Mascot from "../../components/Mascot";
import Card from "../../components/Card";
import { colors } from "../../constants/tokens";

interface Message {
  role: "user" | "assistant";
  text: string;
}

export default function AskArisScreen() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", text: userMessage },
      {
        role: "assistant",
        text: "I cannot answer questions yet. Connect your UNO Q device to enable the assistant. Answers come from the device's deterministic pipeline, not generated text.",
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={100}
      >
        <ScrollView
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
            </Card>
          ))}
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
            accessibilityLabel="Type your question"
          />
          <Pressable
            onPress={handleSend}
            className="bg-lavender rounded-md px-4 items-center justify-center active:bg-lavender-dark"
            accessibilityRole="button"
            accessibilityLabel="Send question"
          >
            <Text className="text-white text-sm" style={{ fontFamily: "Inter_600SemiBold" }}>
              Send
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
