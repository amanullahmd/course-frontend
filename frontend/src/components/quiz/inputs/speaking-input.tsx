"use client";

import * as React from "react";
import type { MediaDto, SessionQuestion } from "@/lib/api/types";
import type { DraftAnswer } from "@/lib/exercises";
import { AudioRecorder } from "../audio-recorder";

/** SPEAKING: record in the browser; the uploaded media id becomes the answer. */
export function SpeakingInput({
  question,
  value,
  onChange,
}: {
  question: SessionQuestion;
  value: DraftAnswer;
  onChange: (value: DraftAnswer) => void;
}) {
  // The upload may finish after the learner moved on, so always merge into the latest value.
  const latest = React.useRef(value);
  const change = React.useRef(onChange);
  React.useEffect(() => {
    latest.current = value;
    change.current = onChange;
  });
  return (
    <AudioRecorder
      maxSeconds={question.maxRecordingSeconds ?? 60}
      media={value.responseMedia}
      onChange={(media: MediaDto | null) => change.current({ ...latest.current, responseMediaId: media?.id ?? null, responseMedia: media })}
    />
  );
}
