// Renders B.AI's markdown-light text: **bold** and line breaks. Nothing else, so AI text can't inject markup.
import { Fragment } from "react";

export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");
  return (
    <p className={className}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
              <strong key={j} className="font-bold">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <Fragment key={j}>{part}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </p>
  );
}
