import React from "react";
import {fitFont} from "./SceneFrame";

export const BodyLines: React.FC<{lines: string[]; columns?: 1 | 2; numbered?: boolean}> = ({lines, columns = 1, numbered = false}) => {
  const totalLength = lines.reduce((sum, line) => sum + Array.from(line).length, 0);
  const compact = lines.length >= 5 || totalLength > 430;
  return (
    <div style={{height: "100%", display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: compact ? 7 : 10, alignContent: "stretch", overflow: "hidden"}}>
      {lines.map((line, index) => (
        <div key={`${index}-${line.slice(0, 16)}`} style={{minHeight: 0, boxSizing: "border-box", padding: compact ? "8px 13px" : "12px 16px", borderRadius: 9, background: "#102035cc", border: "1px solid #263b53", display: "flex", gap: 12, alignItems: "flex-start", overflow: "hidden"}}>
          {numbered ? <span style={{color: "#7e94ad", fontSize: 15, fontFamily: "monospace", paddingTop: 3}}>{String(index + 1).padStart(2, "0")}</span> : null}
          <div style={{fontSize: fitFont(line, compact ? 20 : 25, 17), lineHeight: 1.43, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: compact ? 2 : 3, WebkitBoxOrient: "vertical", overflow: "hidden"}}>{line}</div>
        </div>
      ))}
    </div>
  );
};
