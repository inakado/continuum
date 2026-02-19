"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  Background,
  Handle,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { Check, CircleDot, Lock, Play } from "lucide-react";
import Button from "@/components/ui/Button";
import { studentApi, type GraphEdge, type GraphNode } from "@/lib/api/student";
import { ApiError } from "@/lib/api/client";
import styles from "./student-section-graph-panel.module.css";

type Props = {
  sectionId: string;
  sectionTitle?: string | null;
  onBack: () => void;
  onNotFound: () => void;
};

type UnitNodeData = {
  unitId: string;
  title: string;
  status: GraphNode["status"];
  completionPercent: number;
  solvedPercent: number;
};

const NODE_SPACING_SCALE_X = 1.2;
const NODE_SPACING_SCALE_Y = 1.34;

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const isCurrentUnitStatus = (status: GraphNode["status"] | undefined) =>
  status === "available" || status === "in_progress";

const getStatusClassName = (status: GraphNode["status"]) => {
  switch (status) {
    case "locked":
      return styles.nodeLocked;
    case "available":
      return styles.nodeAvailable;
    case "in_progress":
      return styles.nodeInProgress;
    case "completed":
      return styles.nodeCompleted;
    default:
      return "";
  }
};

const HIDDEN_HANDLE_STYLE = {
  opacity: 0,
  border: 0,
  background: "transparent",
  pointerEvents: "none",
} as const;

const getStatusIcon = (status: GraphNode["status"]) => {
  switch (status) {
    case "completed":
      return Check;
    case "in_progress":
      return Play;
    case "available":
      return CircleDot;
    case "locked":
    default:
      return Lock;
  }
};

const UnitNode = ({ data }: NodeProps<UnitNodeData>) => {
  const completionPercent = clampPercent(data.completionPercent);
  const solvedPercent = clampPercent(data.solvedPercent);
  const StatusIcon = getStatusIcon(data.status);

  return (
    <div className={`${styles.node} ${getStatusClassName(data.status)}`}>
      <Handle
        type="target"
        position={Position.Top}
        className={`${styles.handle} ${styles.handleTop}`}
        style={HIDDEN_HANDLE_STYLE}
      />
      <div className={styles.nodeHeader}>
        <div className={styles.nodeTitle}>{data.title}</div>
        <span className={styles.nodeStatusIconWrap} aria-hidden="true">
          <StatusIcon size={12} strokeWidth={2.2} />
        </span>
      </div>
      <div className={styles.nodeMetrics}>
        <div className={styles.nodeMetricRow}>
          <span className={styles.nodeMetricLabel}>Выполнение</span>
          <span className={styles.nodeMetricValue}>{completionPercent}%</span>
        </div>
        <div className={styles.nodeMetricTrack} aria-hidden>
          <span className={styles.nodeMetricFillPrimary} style={{ width: `${completionPercent}%` }} />
        </div>
        <div className={styles.nodeMetricRow}>
          <span className={styles.nodeMetricLabel}>Решено</span>
          <span className={styles.nodeMetricValue}>{solvedPercent}%</span>
        </div>
        <div className={styles.nodeMetricTrack} aria-hidden>
          <span className={styles.nodeMetricFillSecondary} style={{ width: `${solvedPercent}%` }} />
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={`${styles.handle} ${styles.handleBottom}`}
        style={HIDDEN_HANDLE_STYLE}
      />
    </div>
  );
};

const NODE_TYPES = { unit: UnitNode };

const DEFAULT_EDGE_OPTIONS: Partial<Edge> = {
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border-primary)" },
  style: { stroke: "var(--border-primary)" },
};

const buildFlowNodes = (nodes: GraphNode[]): Node<UnitNodeData>[] =>
  nodes.map((node) => ({
    id: node.unitId,
    type: "unit",
    position: node.position,
    style: { border: "none", background: "transparent", padding: 0 },
    data: {
      unitId: node.unitId,
      title: node.title,
      status: node.status,
      completionPercent: node.completionPercent,
      solvedPercent: node.solvedPercent,
    },
  }));

const scaleGraphNodePositions = (nodes: GraphNode[]): GraphNode[] => {
  if (nodes.length < 2) return nodes;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
  }

  return nodes.map((node) => ({
    ...node,
    position: {
      x: Math.round(minX + (node.position.x - minX) * NODE_SPACING_SCALE_X),
      y: Math.round(minY + (node.position.y - minY) * NODE_SPACING_SCALE_Y),
    },
  }));
};

const buildFlowEdges = (edges: GraphEdge[], nodes: GraphNode[]): Edge[] => {
  const nodesById = new Map(nodes.map((node) => [node.unitId, node]));

  return edges.map((edge) => {
    const sourceNode = nodesById.get(edge.fromUnitId);
    const targetNode = nodesById.get(edge.toUnitId);

    const isCompletedPath =
      sourceNode?.status === "completed" &&
      (targetNode?.status === "completed" || isCurrentUnitStatus(targetNode?.status));

    const isLockedPath = targetNode?.status === "locked";
    const stroke = isCompletedPath
      ? "color-mix(in srgb, #10b981 72%, var(--border-primary))"
      : isLockedPath
        ? "color-mix(in srgb, var(--text-muted) 45%, transparent)"
        : "color-mix(in srgb, var(--border-primary) 38%, transparent)";

    return {
      id: edge.id,
      source: edge.fromUnitId,
      target: edge.toUnitId,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
      style: {
        stroke,
        strokeWidth: isCompletedPath ? 1.8 : 1.35,
        opacity: isLockedPath ? 0.72 : 0.92,
      },
    };
  });
};

type GraphCanvasProps = {
  nodes: Node<UnitNodeData>[];
  edges: Edge[];
  onNodeClick: (...args: any[]) => void;
};

const GraphCanvas = memo(function GraphCanvas({
  nodes,
  edges,
  onNodeClick,
}: GraphCanvasProps) {
  const nodeTypesRef = useRef(NODE_TYPES);
  const defaultEdgeOptionsRef = useRef(DEFAULT_EDGE_OPTIONS);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      proOptions={{ hideAttribution: true }}
      nodeTypes={nodeTypesRef.current}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      onNodeClick={onNodeClick}
      fitView
      defaultEdgeOptions={defaultEdgeOptionsRef.current}
    >
      <Background gap={24} size={1} color="color-mix(in srgb, var(--text-muted) 22%, transparent)" />
    </ReactFlow>
  );
});

export default function StudentSectionGraphPanel({ sectionId, onBack, onNotFound }: Props) {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node<UnitNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lockedHint, setLockedHint] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  const nodesById = useMemo(
    () => new Map(nodes.map((item) => [item.id, item as Node<UnitNodeData>])),
    [nodes],
  );

  const pendingPrerequisitesByNodeId = useMemo(() => {
    const byTarget = new Map<string, string[]>();
    for (const edge of edges) {
      const sourceNode = nodesById.get(edge.source);
      if (!sourceNode || sourceNode.data.status === "completed") continue;
      const current = byTarget.get(edge.target) ?? [];
      current.push(sourceNode.data.title);
      byTarget.set(edge.target, current);
    }
    return byTarget;
  }, [edges, nodesById]);

  const fetchGraph = useCallback(async () => {
    setError(null);
    setLockedHint(null);
    setLoading(true);
    try {
      const graph = await studentApi.getSectionGraph(sectionId);
      const scaledNodes = scaleGraphNodePositions(graph.nodes);
      setNodes(buildFlowNodes(scaledNodes));
      setEdges(buildFlowEdges(graph.edges, graph.nodes));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        onNotFound();
        return;
      }
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError("Нужна авторизация");
        return;
      }
      setError(err instanceof Error ? err.message : "Ошибка загрузки графа");
    } finally {
      setLoading(false);
    }
  }, [onNotFound, sectionId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const clicked = nodesById.get(node.id);
      if (clicked?.data.status === "locked") {
        const lockedPrereqNames = pendingPrerequisitesByNodeId.get(node.id) ?? [];

        if (lockedPrereqNames.length > 0) {
          setLockedHint(
            `Чтобы открыть «${clicked.data.title}», завершите: ${lockedPrereqNames.join(", ")}.`,
          );
        } else {
          setLockedHint(
            `Юнит «${clicked.data.title}» пока заблокирован. Сначала завершите предыдущие юниты.`,
          );
        }
        return;
      }

      setLockedHint(null);
      router.push(`/student/units/${node.id}`);
    },
    [nodesById, pendingPrerequisitesByNodeId, router],
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.topActions}>
        <div className={styles.header}>
          <Button variant="ghost" onClick={onBack} className={styles.backButton}>
            ← К разделам
          </Button>
        </div>
      </div>

      {error ? (
        <div className={styles.error} role="status" aria-live="polite">
          {error}
        </div>
      ) : null}
      {lockedHint ? (
        <div className={styles.lockedHint} role="status" aria-live="polite">
          {lockedHint}
        </div>
      ) : null}

      <div className={styles.graphPanel} aria-busy={loading}>
        {loading ? (
          <div className={styles.loading}>Загрузка графа…</div>
        ) : nodes.length === 0 ? (
          <div className={styles.empty}>В разделе пока нет опубликованных юнитов</div>
        ) : (
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            onNodeClick={handleNodeClick}
          />
        )}
        <div className={styles.graphOverlay}>
          <button
            type="button"
            className={styles.legendToggle}
            onClick={() => setShowLegend((prev) => !prev)}
          >
            {showLegend ? "Скрыть легенду" : "Показать легенду"}
          </button>
          {showLegend ? (
            <div className={styles.legend} role="note" aria-label="Легенда статусов">
              <span className={`${styles.legendItem} ${styles.legendLocked}`}>Заблокирован</span>
              <span className={`${styles.legendItem} ${styles.legendAvailable}`}>Доступен</span>
              <span className={`${styles.legendItem} ${styles.legendInProgress}`}>В процессе</span>
              <span className={`${styles.legendItem} ${styles.legendCompleted}`}>Завершён</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
