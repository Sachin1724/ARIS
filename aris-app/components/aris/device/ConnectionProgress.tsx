import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/colors";
import { typography } from "../../../theme/typography";

export interface SetupProgressStep {
  id: string;
  label: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
}

interface ConnectionProgressProps {
  steps: SetupProgressStep[];
  currentStepIndex: number;
}

export default function ConnectionProgress({
  steps,
  currentStepIndex,
}: ConnectionProgressProps) {
  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isCompleted = step.status === "completed";
        const isRunning = step.status === "running";
        const isFailed = step.status === "failed";
        const isPending = step.status === "pending";

        return (
          <View key={step.id} style={styles.stepRow}>
            {/* Left Indicator & Line */}
            <View style={styles.indicatorCol}>
              <View
                style={[
                  styles.dot,
                  isCompleted && styles.dotCompleted,
                  isRunning && styles.dotRunning,
                  isFailed && styles.dotFailed,
                  isPending && styles.dotPending,
                ]}
              >
                {isCompleted && (
                  <Ionicons name="checkmark" size={14} color={colors.background} />
                )}
                {isRunning && (
                  <ActivityIndicator size="small" color={colors.background} />
                )}
                {isFailed && (
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                )}
                {isPending && (
                  <View style={styles.innerPendingCircle} />
                )}
              </View>

              {index < steps.length - 1 && (
                <View
                  style={[
                    styles.line,
                    isCompleted && styles.lineCompleted,
                  ]}
                />
              )}
            </View>

            {/* Right Step Content */}
            <View style={styles.contentCol}>
              <Text
                style={[
                  styles.label,
                  (isRunning || isCompleted) && styles.labelActive,
                ]}
              >
                {step.label}
              </Text>
              <Text style={styles.description}>{step.description}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 56,
  },
  indicatorCol: {
    alignItems: "center",
    width: 32,
    marginRight: 14,
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dotCompleted: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dotRunning: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dotFailed: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  dotPending: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  innerPendingCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondaryText,
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 30,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  lineCompleted: {
    backgroundColor: colors.accent,
  },
  contentCol: {
    flex: 1,
    paddingTop: 2,
    paddingBottom: 16,
  },
  label: {
    fontFamily: typography.fontFamilies.semiBold,
    fontSize: 14,
    color: colors.secondaryText,
  },
  labelActive: {
    color: colors.primaryText,
  },
  description: {
    fontFamily: typography.fontFamilies.regular,
    fontSize: 12,
    color: colors.secondaryText,
    marginTop: 2,
    lineHeight: 16,
  },
});
