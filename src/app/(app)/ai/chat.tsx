import { useLocalSearchParams } from "expo-router";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { isApiError } from "@/api/client";
import { sendChat, useMe, type ChatTurn } from "@/api/queries";
import { reportError } from "@/lib/monitoring";
import { Button } from "@/ui/forms";
import { Notice } from "@/ui/QueryBoundary";
import { SUGGESTIONS } from "@/lib/ai";
import { voiceSupported } from "@/lib/voice";
import { colors, radius, space } from "@/theme/tokens";
import { Icon } from "@/ui/Icon";
import { Card, pressedStyle } from "@/ui/primitives";
import { Screen } from "@/ui/Screen";
import { AppText } from "@/ui/Text";

// Native speech module: only requested in builds that contain it, never in Expo Go.
const VoiceButton = voiceSupported ? lazy(() => import("@/ui/VoiceButton")) : null;

/** What the assistant says when it cannot answer; the same wording as the web. */
function failureReply(error: unknown) {
  if (isApiError(error)) {
    // A throttle carries its own Bulgarian message and tells the user to wait.
    if (error.code === "rate_limited") return error.message;
    if (error.isConnectivity) return "Няма връзка с интернет. Опитай отново след малко.";
  }
  return "В момента не мога да отговоря. Опитай отново след малко.";
}

export default function ChatScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const started = useRef(false);
  const sending = useRef(false);
  const me = useMe();
  const [failed, setFailed] = useState<{ turns: ChatTurn[]; message: string } | null>(null);

  async function send(text: string, retryTurns?: ChatTurn[]) {
    const question = text.trim();
    if (!question || sending.current) return;
    sending.current = true;

    const next: ChatTurn[] = retryTurns ?? [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setPending(true);
    setFailed(null);

    try {
      // The server only reads the last twenty; ten is plenty of context.
      const reply = await sendChat(next.slice(-10));
      setMessages([...next, { role: "assistant", content: reply.content }]);
    } catch (error) {
      reportError("AI chat request failed", error);
      setFailed({ turns: next, message: failureReply(error) });
    } finally {
      setPending(false);
      sending.current = false;
    }
  }

  // A popular question tapped on the AI tab arrives as `?q=` and is asked once.
  useEffect(() => {
    if (q && !started.current) {
      started.current = true;
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <Screen back="/ai" title="AgroGrain AI" subtitle="Твоят земеделски асистент" scroll={false} keyboard>
      <AppText variant="caption" tone="muted">Контекст: {me.data?.user.regionName ?? "регионът от профила"} · AI може да греши.</AppText>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: space.sm, paddingBottom: space.md }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      >
        {messages.length ? (
          <>
            {messages.map((message, index) => {
              const mine = message.role === "user";
              return (
                <View
                  key={index}
                  style={[styles.bubble, mine ? styles.mine : styles.theirs]}
                  accessibilityLabel={`${mine ? "Ти" : "AgroGrain AI"}: ${message.content}`}
                >
                  <AppText
                    variant="small"
                    selectable
                    style={{ lineHeight: 20, color: mine ? colors.white : colors.ink }}
                  >
                    {message.content}
                  </AppText>
                </View>
              );
            })}
            {pending ? (
              <View
                style={[styles.bubble, styles.theirs, { width: 64, alignItems: "center" }]}
                accessibilityLabel="AgroGrain AI пише"
              >
                <ActivityIndicator size="small" color={colors.muted} />
              </View>
            ) : null}
          </>
        ) : (
          <View style={{ gap: space.sm }}>
            <AppText variant="heading">Популярни въпроси</AppText>
            {SUGGESTIONS.map((question) => (
              <Pressable
                key={question}
                accessibilityRole="button"
                onPress={() => void send(question)}
                style={({ pressed }) => pressed && pressedStyle}
              >
                <Card
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}
                >
                  <Icon name="sparkles" size={16} color={colors.brand[600]} />
                  <AppText variant="small" style={{ flex: 1 }}>
                    {question}
                  </AppText>
                  <Icon name="chevron-forward" size={16} color={colors.muted} />
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {failed && <View style={{ gap: space.sm, paddingBottom: space.sm }}>
        <Notice tone="warn">{failed.message}</Notice>
        <Button title="Опитай отново" compact variant="secondary"
          onPress={() => void send(failed.turns.at(-1)?.content ?? "", failed.turns)} />
        <Button title="Промени въпроса" compact variant="ghost" onPress={() => {
          setInput(failed.turns.at(-1)?.content ?? "");
          setMessages(failed.turns.slice(0, -1));
          setFailed(null);
        }} />
      </View>}
      {voiceMessage ? (
        <AppText variant="caption" tone="muted" style={{ paddingBottom: 6 }} accessibilityRole="alert">
          {voiceMessage}
        </AppText>
      ) : null}
      <View style={styles.inputBar}>
        <TextInput
          accessibilityLabel="Въпрос към AgroGrain AI"
          value={input}
          onChangeText={setInput}
          placeholder="Напиши своя въпрос…"
          placeholderTextColor={colors.muted}
          multiline
          editable={!pending && !failed}
          maxLength={2000}
          style={styles.input}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={() => void send(input)}
        />
        {VoiceButton ? (
          <Suspense fallback={null}>
            <VoiceButton onText={setInput} onError={setVoiceMessage} disabled={pending} />
          </Suspense>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Изпрати"
          disabled={pending || !!failed || !input.trim()}
          onPress={() => void send(input)}
          style={({ pressed }) => [
            styles.send,
            (pending || !input.trim()) && { opacity: 0.35 },
            pressed && pressedStyle,
          ]}
        >
          <Icon name="send" size={16} color={colors.white} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "86%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mine: { alignSelf: "flex-end", backgroundColor: colors.brand[600], borderBottomRightRadius: 6 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.soft, borderBottomLeftRadius: 6 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 36,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.ink,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.brand[600],
    alignItems: "center",
    justifyContent: "center",
  },
});
