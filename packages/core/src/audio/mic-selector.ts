// ═══════════════════════════════════════════════════════════
// Smart Microphone Selection
// Prefers hardware mics over system defaults/virtual devices
// ═══════════════════════════════════════════════════════════

export interface MicSelectionResult {
  deviceId: string | undefined;
  label: string;
  strategy: "hardware" | "non-default" | "default";
}

/**
 * Select the best available microphone.
 *
 * Requires mic permission to be granted first (labels are hidden until
 * permission is given). Call `navigator.mediaDevices.getUserMedia({ audio: true })`
 * before calling this function to unlock device labels.
 *
 * Priority:
 * 1. Real hardware mic (not default, not monitor, not virtual)
 * 2. Any non-default mic
 * 3. System default
 */
export async function selectBestMicrophone(): Promise<MicSelectionResult> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioInputs = devices.filter((d) => d.kind === "audioinput");

  // Priority 1: Real hardware mic
  for (const mic of audioInputs) {
    const label = mic.label.toLowerCase();
    const isDefault = mic.deviceId === "default" || label.includes("default");
    const isMonitor = label.includes("monitor");
    const isVirtual =
      label.includes("virtual") ||
      label.includes("pipewire") ||
      label.includes("null");

    if (!isDefault && !isMonitor && !isVirtual && mic.deviceId) {
      return {
        deviceId: mic.deviceId,
        label: mic.label,
        strategy: "hardware",
      };
    }
  }

  // Priority 2: Any non-default
  const nonDefault = audioInputs.find((m) => m.deviceId !== "default");
  if (nonDefault) {
    return {
      deviceId: nonDefault.deviceId,
      label: nonDefault.label,
      strategy: "non-default",
    };
  }

  // Priority 3: System default
  return {
    deviceId: undefined,
    label: "default",
    strategy: "default",
  };
}
