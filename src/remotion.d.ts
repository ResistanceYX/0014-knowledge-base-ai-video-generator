// Remotion 4.0.545 的公开声明引用全局 Timer；在 TypeScript 7 下显式桥接 Node 类型。
export {};
declare global {
  type Timer = NodeJS.Timer;
}
