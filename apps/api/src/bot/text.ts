// Telegram measures message limits in UTF-16 units. Stop only between whole code points.
export function clipMessageText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  let result = "";
  for (const point of text) {
    if (result.length + point.length > limit - 1) break;
    result += point;
  }
  return `${result}…`;
}
