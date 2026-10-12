import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Modal,
  Keyboard,
  Alert,
} from "react-native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Mascot } from "page-mascot";
import { colors } from "../../theme/colors";
import { typography } from "../../theme/typography";
import { apiClient } from "../../services/api-client";
import { useDeviceStatus } from "../../hooks/useDeviceStatus";
import { usePreferences } from "../../context/PreferencesContext";
import { chatStorage, ChatMessage as Message, BreakdownItem } from "../../services/chatStorage";
import { assistantWeatherService } from "../../services/assistantWeather";

const quickChips = [
  "Weather in Chhend tomorrow?",
  "Is it safe to run?",
  "Should I open windows?",
  "What is the 24h forecast?",
  "How does SPS30 measure PM2.5?",
];

export default function AskArisScreen() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState("0.0");
  const [showMenu, setShowMenu] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const { status } = useDeviceStatus();
  const { formatTemp, station } = usePreferences();

  const [isListening, setIsListening] = useState(false);
  const [voiceStatusText, setVoiceStatusText] = useState<string | null>(null);

  // Voice speech recognition event hooks
  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
    setVoiceStatusText("Listening... Speak now");
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setVoiceStatusText(null);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript ?? "";
    if (transcript) {
      setInput(transcript);
      scrollRef.current?.scrollToEnd({ animated: true });
      if (event.isFinal) {
        setVoiceStatusText(null);
      }
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    setIsListening(false);
    setVoiceStatusText(null);
    if (event.error !== "no-speech" && event.error !== "aborted") {
      Alert.alert(
        "Voice Input",
        event.message || "Could not recognize speech. Please try speaking closer to the mic."
      );
    }
  });

  const handleToggleVoice = async () => {
    if (isListening) {
      try {
        await ExpoSpeechRecognitionModule.stop();
      } catch (e) {
        console.warn("Failed to stop speech recognition:", e);
      }
      return;
    }

    try {
      const isAvailable = await ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (!isAvailable) {
        Alert.alert(
          "Speech Recognition Unavailable",
          "Google Speech Services is not available or enabled on this device."
        );
        return;
      }

      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Microphone Permission",
          "Microphone permission is required for voice queries. Please grant it in device settings."
        );
        return;
      }

      setInput("");
      setVoiceStatusText("Listening... Speak now");
      await ExpoSpeechRecognitionModule.start({
        lang: "en-IN",
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
      });
    } catch (err: any) {
      setIsListening(false);
      setVoiceStatusText(null);
      Alert.alert("Voice Error", err?.message || "Could not start speech recognition.");
    }
  };

  // Load chat history from local persistent storage on mount
  useEffect(() => {
    let mounted = true;
    chatStorage.loadChatHistory().then((history) => {
      if (mounted && history && history.length > 0) {
        setMessages(history);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 200);
      }
    });

    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Pull chat up when keyboard appears
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    );

    return () => {
      showSub.remove();
    };
  }, []);

  const sensors = status?.sensors ?? {};
  const pm25Val = sensors.pm25?.value ?? null;
  const pm10Val = sensors.pm10?.value ?? null;
  const tempVal = formatTemp(sensors.temperature_c?.value ?? null);
  const humVal = sensors.humidity_pct?.value != null ? Math.round(sensors.humidity_pct.value) : null;
  const co2Val = sensors.co2?.value ?? null;
  const tvocVal = sensors.tvoc?.value ?? null;

  const handleToggleBreakdown = (msgId: string) => {
    setMessages((prev) => {
      const updated = prev.map((m) =>
        m.id === msgId ? { ...m, breakdownExpanded: !m.breakdownExpanded } : m
      );
      chatStorage.saveChatHistory(updated);
      return updated;
    });
  };

  const handleClearChat = async () => {
    await chatStorage.clearChatHistory();
    setMessages([]);
    setShowMenu(false);
  };

  const handleInsertSnapshot = () => {
    setShowMenu(false);
    const currentTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (!status) {
      const emptyMsg: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        text: "No device connected. Connect your UNO Q to insert a live telemetry snapshot.",
        time: currentTime,
      };
      setMessages((prev) => {
        const updated = [...prev, emptyMsg];
        chatStorage.saveChatHistory(updated);
        return updated;
      });
      return;
    }

    const pm25Str = pm25Val != null ? `${pm25Val.toFixed(1)} µg/m³` : "--";
    const pm10Str = pm10Val != null ? `${pm10Val.toFixed(1)} µg/m³` : "--";
    const humStr = humVal != null ? `${humVal}%` : "--";
    const co2Str = co2Val != null ? `${Math.round(co2Val)} ppm` : "--";
    const tvocStr = tvocVal != null ? `${tvocVal.toFixed(2)} mg/m³` : "--";

    const snapshotMsg: Message = {
      id: `msg-${Date.now()}`,
      role: "assistant",
      text: `Live Hardware Telemetry Snapshot:\nPM2.5: ${pm25Str}\nPM10: ${pm10Str}\nTemp: ${tempVal}\nHumidity: ${humStr}\nCO2: ${co2Str}\nTVOC: ${tvocStr}`,
      time: currentTime,
      breakdownExpanded: true,
      breakdown: [
        {
          icon: "hardware-chip",
          iconBg: "rgba(56, 189, 248, 0.15)",
          iconColor: colors.info,
          title: "Sensirion SPS30",
          detail: `Laser optical scattering active`,
        },
        {
          icon: "thermometer",
          iconBg: "rgba(16, 185, 129, 0.15)",
          iconColor: colors.success,
          title: "SHT4x Digital Probe",
          detail: `${tempVal} • ${humStr} RH`,
        },
      ],
    };

    setMessages((prev) => {
      const updated = [...prev, snapshotMsg];
      chatStorage.saveChatHistory(updated);
      return updated;
    });
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const handleSend = useCallback(
    async (customText?: string) => {
      const question = (customText || input).trim();
      if (!question || loading) return;

      if (isListening) {
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch (_) {}
        setIsListening(false);
        setVoiceStatusText(null);
      }

      setInput("");
      setLoading(true);

      // Start elapsed duration timer
      startTimeRef.current = Date.now();
      setElapsedSeconds("0.0");
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const sec = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
        setElapsedSeconds(sec);
      }, 100);

      const currentTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const userMsgId = `msg-${Date.now()}`;
      const userMsg: Message = {
        id: userMsgId,
        role: "user",
        text: question,
        time: currentTime,
      };

      setMessages((prev) => {
        const updated = [...prev, userMsg];
        chatStorage.saveChatHistory(updated);
        return updated;
      });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

      try {
        let answerText = "";
        let breakdown: BreakdownItem[] = [];

        const isLocWeather = assistantWeatherService.isLocationWeatherQuery(question);
        let weatherResult = null;
        if (isLocWeather) {
          weatherResult = await assistantWeatherService.resolveLocationWeather(
            question,
            station?.name || "Rourkela"
          );
        }

        if (weatherResult) {
          answerText = weatherResult.answer;
          breakdown = weatherResult.evidence;
        } else if (apiClient.isConfigured) {
          const resp = await apiClient.askAssistant({ text: question });
          answerText = resp.answer;
          if (resp.evidence && resp.evidence.length > 0) {
            breakdown = resp.evidence.map((ev, i) => ({
              icon: i === 0 ? "pulse" : i === 1 ? "trending-up" : "cloud",
              iconBg:
                i === 0
                  ? "rgba(16, 185, 129, 0.15)"
                  : i === 1
                  ? "rgba(245, 158, 11, 0.15)"
                  : "rgba(56, 189, 248, 0.15)",
              iconColor:
                i === 0
                  ? colors.success
                  : i === 1
                  ? colors.warning
                  : colors.info,
              title: ev.label,
              detail: `${ev.value} ${ev.unit}`,
            }));
          }
        } else {
          answerText =
            "No device connected. Connect your UNO Q to get real-time air quality analysis and personalized recommendations.";
        }

        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        const finalDuration = `${((Date.now() - startTimeRef.current) / 1000).toFixed(1)}s`;

        const asstMsg: Message = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          text: answerText,
          time: currentTime,
          duration: finalDuration,
          breakdown: breakdown.length > 0 ? breakdown : undefined,
          breakdownExpanded: breakdown.length > 0,
        };
        setMessages((prev) => {
          const updated = [...prev, asstMsg];
          chatStorage.saveChatHistory(updated);
          return updated;
        });
      } catch {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        const finalDuration = `${((Date.now() - startTimeRef.current) / 1000).toFixed(1)}s`;

        const errMsg: Message = {
          id: `msg-${Date.now() + 1}`,
          role: "assistant",
          text: "Unable to reach the ARIS assistant. Check that your UNO Q is connected and try again.",
          time: currentTime,
          duration: finalDuration,
        };

        setMessages((prev) => {
          const updated = [...prev, errMsg];
          chatStorage.saveChatHistory(updated);
          return updated;
        });
      } finally {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setLoading(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
      }
    },
    [input, loading]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.headerIconButton}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={colors.primaryText} />
        </Pressable>

        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Chat with ARIS</Text>
        </View>

        <Pressable
          style={styles.headerIconButton}
          onPress={() => setShowMenu(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Conversation menu"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.primaryText} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {messages.map((msg) => {
            const isUser = msg.role === "user";

            if (isUser) {
              return (
                <View key={msg.id} style={styles.userMessageWrapper}>
                  <View style={styles.userBubble}>
                    <Text style={styles.userBubbleText}>{msg.text}</Text>
                  </View>
                  {msg.time && (
                    <Text style={styles.timeText}>{msg.time}</Text>
                  )}
                </View>
              );
            }

            const isStreaming = !msg.duration && msg.text.length > 0;

            return (
              <View key={msg.id} style={styles.assistantMessageWrapper}>
                <View style={styles.assistantRow}>
                  <View style={styles.avatarContainer}>
                    <Mascot
                      state={isStreaming ? "thinking" : "good_conditions"}
                      size={38}
                      interactive={false}
                    />
                  </View>

                  <View style={styles.assistantBubble}>
                    <Text style={styles.assistantBubbleText}>{msg.text}</Text>
                  </View>
                </View>

                <View style={styles.assistantMetaRow}>
                  {msg.time && (
                    <Text style={styles.timeText}>{msg.time}</Text>
                  )}
                  {msg.duration && (
                    <View style={styles.durationBadge}>
                      <Ionicons name="stopwatch-outline" size={10} color={colors.accent} />
                      <Text style={styles.durationText}>{msg.duration}</Text>
                    </View>
                  )}
                </View>

                {msg.breakdown && msg.breakdown.length > 0 && (
                  <View style={styles.breakdownCard}>
                    <Pressable
                      style={styles.breakdownHeaderRow}
                      onPress={() => handleToggleBreakdown(msg.id)}
                      accessibilityRole="button"
                      accessibilityLabel="Toggle rationale evidence"
                    >
                      <Text style={styles.breakdownCardTitle}>Why I say this</Text>
                      <Ionicons
                        name={msg.breakdownExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={colors.secondaryText}
                      />
                    </Pressable>

                    {msg.breakdownExpanded && (
                      <View style={styles.breakdownList}>
                        {msg.breakdown.map((item, bIndex) => (
                          <View key={bIndex} style={styles.breakdownItemRow}>
                            <View
                              style={[
                                styles.breakdownIconBadge,
                                { backgroundColor: item.iconBg },
                              ]}
                            >
                              <Ionicons
                                name={item.icon}
                                size={16}
                                color={item.iconColor}
                              />
                            </View>
                            <View style={styles.breakdownTextGroup}>
                              <Text style={styles.breakdownItemTitle}>
                                {item.title}
                              </Text>
                              <Text style={styles.breakdownItemDetail}>
                                {item.detail}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {loading && (
            <View style={styles.assistantMessageWrapper}>
              <View style={styles.assistantRow}>
                <View style={styles.avatarContainer}>
                  <Mascot state="thinking" size={38} interactive={false} />
                </View>
                <View style={styles.assistantBubble}>
                  <Text style={styles.assistantBubbleText}>
                    Analyzing air telemetry...
                  </Text>
                  <View style={styles.loadingTimerRow}>
                    <Ionicons name="stopwatch-outline" size={11} color={colors.accent} />
                    <Text style={styles.loadingTimerText}>{elapsedSeconds}s</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContent}
          keyboardShouldPersistTaps="handled"
        >
          {quickChips.map((chip, idx) => (
            <Pressable
              key={idx}
              style={styles.chipButton}
              onPress={() => handleSend(chip)}
              accessibilityRole="button"
              accessibilityLabel={chip}
            >
              <Text style={styles.chipText}>{chip}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {voiceStatusText && (
          <View style={styles.listeningBanner}>
            <View style={styles.listeningPill}>
              <View style={styles.recordingPulse} />
              <Text style={styles.listeningBannerText}>{voiceStatusText}</Text>
            </View>
          </View>
        )}

        <View style={styles.inputContainer}>
          <View
            style={[
              styles.inputPill,
              isListening && styles.inputPillListening,
            ]}
          >
            <Ionicons
              name={isListening ? "mic" : "terminal-outline"}
              size={18}
              color={isListening ? colors.danger : colors.accent}
              style={{ marginLeft: 12, marginRight: 8 }}
            />
            <TextInput
              style={styles.textInput}
              placeholder={isListening ? "Listening to your voice..." : "Ask about air telemetry..."}
              placeholderTextColor={isListening ? colors.danger : colors.mutedText}
              value={input}
              onChangeText={(t) => {
                setInput(t);
                if (t.length === 1) {
                  scrollRef.current?.scrollToEnd({ animated: true });
                }
              }}
              onFocus={() => {
                setTimeout(() => {
                  scrollRef.current?.scrollToEnd({ animated: true });
                }, 120);
              }}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
            />
            {/* Dedicated Voice Mic Button */}
            <Pressable
              style={[
                styles.micButton,
                isListening && styles.micButtonListening,
              ]}
              onPress={handleToggleVoice}
              accessibilityRole="button"
              accessibilityLabel={isListening ? "Stop listening" : "Start voice input"}
            >
              <Ionicons
                name={isListening ? "stop" : "mic"}
                size={18}
                color={isListening ? "#FFFFFF" : colors.accent}
              />
            </Pressable>

            {/* Dedicated Send Button */}
            <Pressable
              style={[
                styles.sendButton,
                input.trim()
                  ? { backgroundColor: colors.accent }
                  : { backgroundColor: colors.surfaceMuted, opacity: 0.4 },
              ]}
              onPress={() => {
                if (input.trim()) handleSend();
              }}
              disabled={!input.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={input.trim() ? "#0D110E" : colors.mutedText}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <View style={styles.menuOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowMenu(false)}
            accessibilityLabel="Close menu"
          />
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>Assistant Options</Text>

            <Pressable
              style={styles.menuOptionRow}
              onPress={handleInsertSnapshot}
              accessibilityRole="button"
            >
              <Ionicons name="hardware-chip-outline" size={18} color={colors.accent} />
              <Text style={styles.menuOptionText}>Insert Telemetry Snapshot</Text>
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              style={styles.menuOptionRow}
              onPress={handleClearChat}
              accessibilityRole="button"
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={[styles.menuOptionText, { color: colors.danger }]}>
                Clear Conversation History
              </Text>
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              style={styles.menuCloseButton}
              onPress={() => setShowMenu(false)}
              accessibilityRole="button"
            >
              <Text style={styles.menuCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flexOne: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 18,
    color: colors.primaryText,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 16,
  },
  userMessageWrapper: {
    alignItems: "flex-end",
  },
  userBubble: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderBottomRightRadius: 2,
    maxWidth: "80%",
  },
  userBubbleText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 14,
    color: "#0D110E",
    lineHeight: 20,
  },
  timeText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 10,
    color: colors.mutedText,
    marginTop: 4,
  },
  assistantMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 48,
    marginTop: 4,
    gap: 8,
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(223, 242, 77, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(223, 242, 77, 0.25)",
  },
  durationText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 10,
    color: colors.accent,
  },
  loadingTimerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  loadingTimerText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 11,
    color: colors.accent,
  },
  assistantMessageWrapper: {
    alignItems: "flex-start",
    width: "100%",
  },
  assistantRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    maxWidth: "92%",
  },
  avatarContainer: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  assistantBubble: {
    flex: 1,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderTopLeftRadius: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  assistantBubbleText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 14,
    color: colors.primaryText,
    lineHeight: 20,
  },
  breakdownCard: {
    marginTop: 10,
    width: "100%",
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breakdownHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  breakdownCardTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.primaryText,
  },
  breakdownList: {
    gap: 10,
    marginTop: 10,
  },
  breakdownItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  breakdownIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  breakdownTextGroup: {
    flex: 1,
  },
  breakdownItemTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 13,
    color: colors.primaryText,
  },
  breakdownItemDetail: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 2,
    lineHeight: 16,
  },
  chipsScroll: {
    maxHeight: 44,
  },
  chipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  chipButton: {
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    color: colors.accent,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  inputPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingRight: 6,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontFamily: typography.fontFamilies.regular,
    fontSize: 14,
    color: colors.primaryText,
    paddingVertical: 8,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  micButtonListening: {
    backgroundColor: colors.danger,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  listeningBanner: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    alignItems: "center",
  },
  listeningPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  recordingPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  listeningBannerText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    color: colors.danger,
  },
  inputPillListening: {
    borderColor: colors.danger,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  menuCard: {
    width: "100%",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuTitle: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 16,
    color: colors.primaryText,
    marginBottom: 12,
  },
  menuOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  menuOptionText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 14,
    color: colors.primaryText,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  menuCloseButton: {
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  menuCloseText: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.secondaryText,
  },
});
