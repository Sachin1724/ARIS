import React, { useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { colors } from "../../../theme/colors";
import { typography } from "../../../theme/typography";

interface PairingCodeInputProps {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  error?: string | null;
  disabled?: boolean;
}

export default function PairingCodeInput({
  value,
  onChange,
  length = 6,
  error,
  disabled = false,
}: PairingCodeInputProps) {
  const inputRef = useRef<TextInput>(null);

  const digits = value.split("");

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.cellRow}
        onPress={() => inputRef.current?.focus()}
        accessibilityLabel="Pairing authorization code input"
      >
        {Array.from({ length }).map((_, index) => {
          const char = digits[index] || "";
          const isFocused = value.length === index;

          return (
            <View
              key={index}
              style={[
                styles.cell,
                isFocused && styles.cellFocused,
                !!error && styles.cellError,
              ]}
            >
              <Text style={styles.cellText}>{char}</Text>
            </View>
          );
        })}
      </Pressable>

      {/* Hidden real text input for keyboard handling */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={(text) => {
          const cleaned = text.replace(/[^0-9]/g, "").slice(0, length);
          onChange(cleaned);
        }}
        keyboardType="number-pad"
        maxLength={length}
        editable={!disabled}
        autoFocus={true}
      />

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <Text style={styles.hintText}>
          Enter the 6-digit authorization code shown on your UNO Q display or setup card.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginVertical: 16,
  },
  cellRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  cell: {
    width: 44,
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  cellFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceMuted,
  },
  cellError: {
    borderColor: colors.danger,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  cellText: {
    fontFamily: typography.fontFamilies.bold,
    fontSize: 22,
    color: colors.primaryText,
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
  hintText: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 10,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  errorText: {
    fontFamily: typography.fontFamilies.medium,
    fontSize: 12,
    color: colors.danger,
    marginTop: 10,
    textAlign: "center",
  },
});
