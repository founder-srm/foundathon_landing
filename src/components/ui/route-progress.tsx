"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type RouteProgressContextValue = {
  isPending: boolean;
  start: () => void;
  stop: () => void;
};

const MIN_VISIBLE_MS = 280;
const MAX_VISIBLE_MS = 10000;
const HEADER_OFFSET_CLASS = "top-[4.5rem]";

const RouteProgressContext = createContext<RouteProgressContextValue | null>(
  null,
);

const isInternalNavigation = (anchor: HTMLAnchorElement) => {
  const href = anchor.getAttribute("href");
  if (!href) {
    return false;
  }

  if (
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return false;
  }

  if (anchor.target && anchor.target !== "_self") {
    return false;
  }

  if (anchor.hasAttribute("download") || anchor.getAttribute("aria-disabled")) {
    return false;
  }

  try {
    const destination = new URL(href, window.location.href);
    const current = new URL(window.location.href);

    if (destination.origin !== current.origin) {
      return false;
    }

    const samePathAndQuery =
      destination.pathname === current.pathname &&
      destination.search === current.search;

    if (samePathAndQuery && destination.hash !== current.hash) {
      return false;
    }

    return (
      destination.pathname !== current.pathname ||
      destination.search !== current.search ||
      destination.hash !== current.hash
    );
  } catch {
    return false;
  }
};

export const RouteProgressProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const routeKey = `${pathname}?${searchKey}`;
  const [isPending, setIsPending] = useState(false);
  const hideTimeoutRef = useRef<number | null>(null);
  const forceStopTimeoutRef = useRef<number | null>(null);
  const pendingSinceRef = useRef<number>(0);
  const pendingRef = useRef(false);
  const previousRouteKeyRef = useRef<string | null>(null);

  const clearTimers = useCallback(() => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (forceStopTimeoutRef.current) {
      window.clearTimeout(forceStopTimeoutRef.current);
      forceStopTimeoutRef.current = null;
    }
  }, []);

  const forceStop = useCallback(() => {
    clearTimers();
    pendingRef.current = false;
    setIsPending(false);
  }, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    if (!pendingRef.current) {
      pendingRef.current = true;
      pendingSinceRef.current = Date.now();
      setIsPending(true);
    }

    forceStopTimeoutRef.current = window.setTimeout(() => {
      forceStop();
    }, MAX_VISIBLE_MS);
  }, [clearTimers, forceStop]);

  const stop = useCallback(() => {
    if (!pendingRef.current) {
      return;
    }

    const elapsed = Date.now() - pendingSinceRef.current;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
    clearTimers();

    hideTimeoutRef.current = window.setTimeout(() => {
      forceStop();
    }, remaining);
  }, [clearTimers, forceStop]);

  useEffect(() => {
    if (previousRouteKeyRef.current === null) {
      previousRouteKeyRef.current = routeKey;
      return;
    }

    if (previousRouteKeyRef.current !== routeKey) {
      previousRouteKeyRef.current = routeKey;
      stop();
    }
  }, [routeKey, stop]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
        return;
      }

      if (!(event.target instanceof Element)) {
        return;
      }

      const anchor = event.target.closest("a");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (!isInternalNavigation(anchor)) {
        return;
      }

      start();
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      clearTimers();
    };
  }, [clearTimers, start]);

  const contextValue = useMemo<RouteProgressContextValue>(
    () => ({
      isPending,
      start,
      stop,
    }),
    [isPending, start, stop],
  );

  return (
    <RouteProgressContext.Provider value={contextValue}>
      {children}
    </RouteProgressContext.Provider>
  );
};

export const RouteProgressBar = () => {
  const { isPending } = useRouteProgress();

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 ${HEADER_OFFSET_CLASS} z-[60] h-[2px]`}
    >
      <div
        className={`h-full overflow-hidden bg-fnblue/15 transition-opacity duration-200 ${
          isPending ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="h-full w-1/3 bg-fnblue animate-[route-progress_1.1s_ease-in-out_infinite]" />
      </div>
    </div>
  );
};

export const useRouteProgress = () => {
  const context = useContext(RouteProgressContext);
  if (!context) {
    throw new Error(
      "useRouteProgress must be used within a RouteProgressProvider.",
    );
  }
  return context;
};
