"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  VadEngine,
  AudioRecorder,
  selectBestMicrophone,
  ConversationHistory,
  type VadConfig,
  type VoiceAssistantStatus,
  type ConversationMessage,
  type ToolResult,
} from "@vox-reactor/core";
import { useVoxReactorConfig } from "../context/vox-provider";

// ═══════════════════════════════════════════════════════════
// useVadVoice Hook
// VAD + Whisper transcription (upload audio, process server-side)
// ═══════════════════════════════════════════════════════════

export interface UseVadVoiceOptions {
  /** Override VAD config */
  vadConfig?: Partial<VadConfig>;
  /** Client-side action handler */
  onAction?: (action: {
    type: string;
    tool: string;
    params: Record<string, unknown>;
  }) => Promise<ToolResult>;
  /** Notification callback */
  onNotification?: (message: string, variant: "success" | "error" | "info") => void;
}

export interface UseVadVoiceReturn {
  status: VoiceAssistantStatus;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string | null;
  error: string | null;
  conversationHistory: ConversationMessage[];
  toggleListening: () => Promise<void>;
  stopListening: () => void;
  clearConversationHistory: () => void;
}

export function useVadVoice(
  options: UseVadVoiceOptions = {}
): UseVadVoiceReturn {
  const config = useVoxReactorConfig();
  const { vadConfig, onAction, onNotification } = options;

  // State
  const [status, setStatus] = useState<VoiceAssistantStatus>("idle");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    ConversationMessage[]
  >([]);

  // Refs
  const vadRef = useRef<VadEngine | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const conversationRef = useRef(new ConversationHistory());
  const callbacksRef = useRef({ onAction, onNotification });
  callbacksRef.current = { onAction, onNotification };

  // Sync conversation
  useEffect(() => {
    const unsub = conversationRef.current.subscribe(setConversationHistory);
    return unsub;
  }, []);

  // Process audio blob (upload, transcribe, execute actions, TTS)
  const processAudioRef = useRef<((blob: Blob) => Promise<void>) | null>(null);

  const processAudio = useCallback(
    async (blob: Blob) => {
      if (!config.adapter.uploadAudio || !config.adapter.processCommand) {
        setError("Adapter missing uploadAudio or processCommand");
        setStatus("error");
        return;
      }

      setStatus("processing");
      setError(null);

      try {
        const audioId = await config.adapter.uploadAudio(blob);

        const history = conversationRef.current
          .getMessages()
          .map((m) => ({ role: m.role, content: m.content }));

        const result = await config.adapter.processCommand(audioId, history);

        if (result.error) {
          setError(result.error);
          callbacksRef.current.onNotification?.(result.error, "error");
          setStatus("error");
          setTimeout(() => setStatus("idle"), 1500);
          return;
        }

        setTranscript(result.transcript);
        conversationRef.current.addUserMessage(result.transcript);

        if (result.actions.length === 0) {
          const feedback =
            result.feedback ??
            "I heard you, but I'm not sure what action to take.";
          conversationRef.current.addAssistantMessage(feedback, "pending");
          await playTts(feedback);
          setStatus("idle");
          return;
        }

        // Execute actions
        setStatus("executing");
        const results: string[] = [];
        let hasError = false;

        for (const action of result.actions) {
          let execResult: ToolResult;

          if (callbacksRef.current.onAction) {
            execResult = await callbacksRef.current.onAction(action);
          } else if (config.adapter.executeAction) {
            execResult = await config.adapter.executeAction(
              action.tool,
              action.params
            );
          } else {
            execResult = {
              success: false,
              message: `No handler for action: ${action.tool}`,
            };
          }

          if (execResult.success) {
            results.push(execResult.message);
            callbacksRef.current.onNotification?.(execResult.message, "success");
          } else {
            hasError = true;
            results.push(execResult.error ?? execResult.message);
            callbacksRef.current.onNotification?.(
              execResult.error ?? execResult.message,
              "error"
            );
          }
        }

        const assistantContent = result.feedback ?? results.join("\n");
        conversationRef.current.addAssistantMessage(
          assistantContent,
          hasError ? "error" : "success"
        );

        await playTts(assistantContent);
        setStatus("idle");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        callbacksRef.current.onNotification?.(`Voice command failed: ${msg}`, "error");
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2000);
      }
    },
    [config.adapter]
  );

  processAudioRef.current = processAudio;

  // TTS playback with barge-in support
  const playTts = useCallback(
    async (text: string) => {
      if (!config.adapter.generateSpeech) return;

      try {
        const { audioUrl } = await config.adapter.generateSpeech(text);
        if (!audioUrl) return;

        setIsSpeaking(true);
        vadRef.current?.setTtsActive(true);

        if (!audioElRef.current) {
          audioElRef.current = new Audio();
        }

        const audio = audioElRef.current;
        audio.src = audioUrl;
        audio.onended = () => {
          setIsSpeaking(false);
          vadRef.current?.setTtsActive(false);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          vadRef.current?.setTtsActive(false);
        };
        await audio.play();
      } catch {
        // TTS is optional, don't error
      }
    },
    [config.adapter]
  );

  // Start listening
  const startListening = useCallback(async () => {
    setError(null);
    setTranscript(null);

    try {
      // Get mic permission first (unlocks device labels)
      const initialStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      initialStream.getTracks().forEach((t) => t.stop());

      // Select best mic
      const mic = await selectBestMicrophone();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: mic.deviceId
          ? {
              deviceId: { exact: mic.deviceId },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            }
          : {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
      });
      streamRef.current = stream;

      // Set up audio analysis
      const audioCtx = new AudioContext();
      await audioCtx.resume();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;

      // Set up recorder
      const recorder = new AudioRecorder(stream, {
        onAudioReady: (blob) => {
          processAudioRef.current?.(blob);
        },
        onError: (msg) => {
          setError(msg);
          setStatus("error");
        },
        onTooShort: () => {
          callbacksRef.current.onNotification?.(
            "Didn't catch that - please speak longer",
            "info"
          );
          setStatus("idle");
        },
      });
      recorderRef.current = recorder;

      // Set up VAD
      const vad = new VadEngine(analyser, vadConfig ?? {}, (event) => {
        switch (event.type) {
          case "speech_start":
            setStatus("recording");
            recorder.start();
            break;

          case "speech_end":
            recorder.stop();
            break;

          case "barge_in":
            // Stop TTS playback
            if (audioElRef.current) {
              audioElRef.current.pause();
              audioElRef.current.currentTime = 0;
            }
            setIsSpeaking(false);
            break;
        }
      });
      vadRef.current = vad;
      vad.start();

      setIsListening(true);
      setStatus("idle");
      callbacksRef.current.onNotification?.(
        "Listening... speak when ready",
        "success"
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Microphone access denied";
      setError(msg);
      callbacksRef.current.onNotification?.(`Microphone error: ${msg}`, "error");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }, [vadConfig]);

  // Stop listening
  const stopListening = useCallback(() => {
    vadRef.current?.dispose();
    vadRef.current = null;

    recorderRef.current?.cancel();
    recorderRef.current?.dispose();
    recorderRef.current = null;

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setIsListening(false);
    setStatus("idle");
  }, []);

  // Toggle
  const toggleListening = useCallback(async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Clear history
  const clearConversationHistory = useCallback(() => {
    conversationRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      vadRef.current?.dispose();
      recorderRef.current?.dispose();
      audioCtxRef.current?.close().catch(() => {});
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current = null;
      }
    };
  }, []);

  return {
    status,
    isListening,
    isSpeaking,
    transcript,
    error,
    conversationHistory,
    toggleListening,
    stopListening,
    clearConversationHistory,
  };
}
