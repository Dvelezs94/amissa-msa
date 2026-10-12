"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Bell, Mail, Send, Zap } from "lucide-react";
import {
  clampWorkflowCanvasZoom,
  layoutWorkflowCanvas,
  workflowActionSummary,
  workflowTriggerSummary,
  type WorkflowCanvasNode,
} from "@/lib/workflow-canvas";
import {
  workflowActionLabel,
  workflowTriggerLabel,
  type WorkflowActionConfig,
  type WorkflowActionType,
  type WorkflowTriggerType,
} from "@/lib/workflows";

const TONE_CLASS: Record<string, string> = {
  trigger: "bg-accent-500",
  notify: "bg-primary-600",
  email: "bg-teal-700",
  telegram: "bg-sky-700",
};

function NodeIcon({
  kind,
  actionType,
}: {
  kind: WorkflowCanvasNode["kind"];
  actionType?: WorkflowActionType;
}) {
  const cls = "h-5 w-5 text-white";
  if (kind === "trigger") return <Zap className={cls} />;
  if (actionType === "email") return <Mail className={cls} />;
  if (actionType === "telegram") return <Send className={cls} />;
  return <Bell className={cls} />;
}

export function WorkflowCanvas({
  triggerType,
  toStatus,
  actions,
}: {
  triggerType: WorkflowTriggerType;
  toStatus?: string;
  actions: WorkflowActionConfig[];
}) {
  const layout = useMemo(
    () => layoutWorkflowCanvas(actions.length),
    [actions.length]
  );

  return (
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundColor: "#111827" }} />
      <p className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg bg-black/40 px-2.5 py-1.5 text-[11px] text-zinc-300 backdrop-blur-sm">
        Arrastra para mover · Ctrl + rueda para zoom
      </p>
      <CanvasPanZoom>
        <div
          className="relative"
          style={{ width: layout.width, height: layout.height }}
        >
          <svg
            className="pointer-events-none absolute inset-0"
            width={layout.width}
            height={layout.height}
            aria-hidden
          >
            {layout.edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.d}
                fill="none"
                stroke="#F14C03"
                strokeWidth={2.25}
              />
            ))}
          </svg>
          {layout.nodes.map((node) => (
            <CanvasNodeCard
              key={node.id}
              node={node}
              triggerType={triggerType}
              toStatus={toStatus ?? ""}
              action={
                node.actionIndex != null ? actions[node.actionIndex] : undefined
              }
            />
          ))}
        </div>
      </CanvasPanZoom>
    </div>
  );
}

function CanvasPanZoom({ children }: { children: React.ReactNode }) {
  const [pan, setPan] = useState({ x: 36, y: 56 });
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      drag.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: pan.x,
        origY: pan.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pan.x, pan.y]
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== e.pointerId) return;
    setPan({
      x: state.origX + (e.clientX - state.startX),
      y: state.origY + (e.clientY - state.startY),
    });
  }, []);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== e.pointerId) return;
    drag.current = null;
  }, []);

  const onWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    setZoom((z) => clampWorkflowCanvasZoom(z * factor));
  }, []);

  return (
    <div
      className="absolute inset-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div
        className="origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: -2400,
            top: -2400,
            width: 6400,
            height: 6400,
            backgroundImage:
              "radial-gradient(circle, rgba(148,163,184,0.32) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        {children}
      </div>
    </div>
  );
}

function CanvasNodeCard({
  node,
  triggerType,
  toStatus,
  action,
}: {
  node: WorkflowCanvasNode;
  triggerType: WorkflowTriggerType;
  toStatus: string;
  action?: WorkflowActionConfig;
}) {
  const tone = node.kind === "trigger" ? "trigger" : action?.type ?? "notify";
  const eyebrow = node.kind === "trigger" ? "Cuando" : "Entonces";
  const triggerFilter = workflowTriggerSummary(triggerType, toStatus || null);
  const title =
    node.kind === "trigger"
      ? workflowTriggerLabel(triggerType)
      : action
        ? workflowActionLabel(action.type)
        : "Acción";
  const subtitle =
    node.kind === "trigger"
      ? triggerFilter !== title
        ? triggerFilter
        : null
      : action
        ? workflowActionSummary(action)
        : null;

  return (
    <div
      className="absolute flex rounded-xl bg-[#1f2937] text-left shadow-xl ring-1 ring-white/10"
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
    >
      <span className="flex min-w-0 flex-1 overflow-hidden rounded-xl">
        <span
          className={`flex w-12 shrink-0 items-center justify-center ${TONE_CLASS[tone] ?? TONE_CLASS.notify}`}
        >
          <NodeIcon kind={node.kind} actionType={action?.type} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {eyebrow}
          </span>
          <span className="truncate text-sm font-medium text-white">{title}</span>
          {subtitle ? (
            <span className="truncate text-[11px] text-zinc-400">{subtitle}</span>
          ) : null}
        </span>
      </span>
      {node.kind === "trigger" ? (
        <span className="absolute right-[-6px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#1f2937] bg-accent-500" />
      ) : (
        <span className="absolute left-[-6px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#1f2937] bg-accent-500" />
      )}
    </div>
  );
}
