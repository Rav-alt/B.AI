"use client";
// Browser location for "use my location". Asked only when the user taps the button; never stored.
import { useCallback, useState } from "react";

export type LocState = { status: "idle" } | { status: "asking" } | { status: "error"; message: string };

export function useLocation() {
  const [state, setState] = useState<LocState>({ status: "idle" });
  const request = useCallback(
    () =>
      new Promise<{ lat: number; lon: number } | null>((resolve) => {
        if (!("geolocation" in navigator)) {
          setState({ status: "error", message: "Walang location sa browser na ito." });
          return resolve(null);
        }
        setState({ status: "asking" });
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setState({ status: "idle" });
            resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          },
          (err) => {
            setState({
              status: "error",
              message: err.code === err.PERMISSION_DENIED ? "Hindi pinayagan ang location. I-type na lang ang lugar." : "Hindi makuha ang location. I-type na lang ang lugar.",
            });
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
        );
      }),
    [],
  );
  return { state, request, clearError: () => setState({ status: "idle" }) };
}
