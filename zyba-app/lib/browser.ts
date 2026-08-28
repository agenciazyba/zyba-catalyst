export function isIosWebView(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const isIosDevice =
    /iP(ad|hone|od)/.test(userAgent) ||
    (userAgent.includes("Macintosh") && "ontouchend" in document);

  return isIosDevice && userAgent.includes("AppleWebKit") && !userAgent.includes("Safari");
}

export function openInCurrentWindow(url: string) {
  if (typeof window === "undefined") return;
  window.location.assign(url);
}
