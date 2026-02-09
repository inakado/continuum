"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, { Background, Controls, MarkerType, type Edge, type Node, type NodeProps } from "reactflow";
import "reactflow/dist/style.css";
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
  title: string;
  status: "draft" | "published";
};

const UnitNode = ({ data }: NodeProps<UnitNodeData>) => {
  return (
    <div className={styles.node}>
      <div className={styles.nodeTitle}>{data.title}</div>
      <div className={styles.nodeStatus}>{data.status === "published" ? "Опубликован" : "Черновик"}</div>
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
    data: { title: node.title, status: node.status },
  }));

const buildFlowEdges = (edges: GraphEdge[]): Edge[] =>
  edges.map((edge) => ({
    id: edge.id,
    source: edge.fromUnitId,
    target: edge.toUnitId,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border-primary)" },
    style: { stroke: "var(--border-primary)" },
  }));

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
      nodeTypes={nodeTypesRef.current}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      onNodeClick={onNodeClick}
      fitView
      defaultEdgeOptions={defaultEdgeOptionsRef.current}
    >
      <Background gap={20} color="var(--border-primary)" />
      <Controls />
    </ReactFlow>
  );
});

export default function StudentSectionGraphPanel({ sectionId, sectionTitle, onBack, onNotFound }: Props) {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node<UnitNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const graph = await studentApi.getSectionGraph(sectionId);
      setNodes(buildFlowNodes(graph.nodes));
      setEdges(buildFlowEdges(graph.edges));
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
      router.push(`/student/units/${node.id}`);
    },
    [router],
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.topActions}>
        <div className={styles.header}>
          <Button variant="ghost" onClick={onBack} className={styles.backButton}>
            ← К разделам
          </Button>
          <div>
            <div className={styles.kicker}>Раздел</div>
            <div className={styles.title}>{sectionTitle || "Раздел"}</div>
          </div>
        </div>
      </div>

      {error ? (
        <div className={styles.error} role="status" aria-live="polite">
          {error}
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
      </div>
    </div>
  );
}
